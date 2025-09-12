// controllers/cobrosController.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const { Cobro, StripeAccount } = require('../models/associations_cobros'); // Cobro + StripeAccount
const { Paciente } = require('../models/associations');                    // Paciente REAL

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

/* =========================
  Helpers
========================= */
async function getStripeAccountForUser(usuarioId) {
  const acc = await StripeAccount.findOne({ where: { usuario_id: usuarioId } });
  if (!acc) return null;

  // Refresca estado desde Stripe por si cambió
  try {
    const remote = await stripe.accounts.retrieve(acc.connected_account_id);
    const changed =
      acc.charges_enabled !== !!remote.charges_enabled ||
      acc.details_submitted !== !!remote.details_submitted;

    if (changed) {
      acc.charges_enabled = !!remote.charges_enabled;
      acc.details_submitted = !!remote.details_submitted;
      await acc.save();
    }
  } catch (e) {
    console.error('No pude recuperar cuenta Stripe:', e.message);
  }
  return acc;
}

/* =========================
  Vista principal /cobros
========================= */
exports.vistaPrincipal = async (req, res) => {
  const user = req.session?.usuario;
  if (!user) return res.redirect('/login');

  const stripeCuenta = await getStripeAccountForUser(user.id);

  let cobros = [];
  try {
    cobros = await Cobro.findAll({
      where: { usuario_id: user.id },
      include: [{ model: Paciente, attributes: ['nombre'] }],
      order: [['createdAt', 'DESC']]
    });
  } catch (e) {
    console.error('Error consultando cobros:', e);
    req.flash('error', 'No se pudieron cargar tus cobros.');
  }

  res.render('cobros', {
    user,
    cobros,
    stripeCuenta,
    active: 'cobros'
  });
};

/* =========================
  Stripe Connect onboarding
========================= */
exports.stripeConnectStart = async (req, res) => {
  const user = req.session?.usuario;
  if (!user) return res.redirect('/login');

  let acc = await StripeAccount.findOne({ where: { usuario_id: user.id } });

  if (!acc) {
    const created = await stripe.accounts.create({
      type: 'standard',
      email: user.email || undefined,
      business_type: 'individual'
    });

    acc = await StripeAccount.create({
      usuario_id: user.id,
      connected_account_id: created.id,
      charges_enabled: !!created.charges_enabled,
      details_submitted: !!created.details_submitted
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: acc.connected_account_id,
    refresh_url: `${BASE_URL}/cobros/stripe/refresh`,
    return_url:  `${BASE_URL}/cobros/stripe/return`,
    type: 'account_onboarding'
  });

  res.redirect(accountLink.url);
};

exports.stripeRefresh = (req, res) => {
  req.flash('error', 'Cancelaste la configuración. Puedes retomarla cuando quieras.');
  res.redirect('/cobros');
};

exports.stripeReturn = async (req, res) => {
  const user = req.session?.usuario;
  if (!user) return res.redirect('/login');

  await getStripeAccountForUser(user.id);
  req.flash('success', 'Tu cuenta de Stripe está conectada (o actualizada).');
  res.redirect('/cobros');
};

/* =========================
  Nuevo cobro vía Checkout
========================= */
exports.formNuevoCobro = async (req, res) => {
  const user = req.session?.usuario;
  if (!user) return res.redirect('/login');

  const stripeCuenta = await getStripeAccountForUser(user.id);
  if (!stripeCuenta || !stripeCuenta.charges_enabled) {
    req.flash('error', 'Primero conecta tu cuenta de Stripe.');
    return res.redirect('/cobros');
  }

  const pacientes = await Paciente.findAll({ attributes: ['id', 'nombre'] });

  res.render('cobros_nuevo', {
    pacientes,
    active: 'cobros',
    user
  });
};

exports.crearCobroCheckout = async (req, res) => {
  const user = req.session?.usuario;
  if (!user) return res.redirect('/login');

  const { paciente_id, concepto, monto } = req.body;

  const stripeCuenta = await getStripeAccountForUser(user.id);
  if (!stripeCuenta || !stripeCuenta.charges_enabled) {
    req.flash('error', 'Tu cuenta de Stripe no está lista para cobrar.');
    return res.redirect('/cobros');
  }

  // Validar y convertir monto a centavos
  const montoNumber = parseFloat(String(monto).replace(',', '.'));
  if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
    req.flash('error', 'Monto inválido.');
    return res.redirect('/cobros/nuevo');
  }
  const amount = Math.round(montoNumber * 100); // a centavos

  try {
    // Sesión de Checkout hacia la cuenta conectada
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        currency: 'mxn',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'mxn',
              unit_amount: amount,
              product_data: { name: concepto || 'Consulta nutricional' }
            }
          }
        ],
        // IMPORTANTE: include session_id para confirmar al volver
        success_url: `${BASE_URL}/cobros/confirm?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/cobros?cancel=1`
      },
      {
        stripeAccount: stripeCuenta.connected_account_id // cobra en la cuenta del nutriólogo
      }
    );

    // Guarda pre-cobro local como "pendiente"
    await Cobro.create({
      usuario_id: user.id,
      paciente_id,
      concepto,
      monto_centavos: amount,
      moneda: 'MXN',
      estado: 'pendiente',
      stripe_checkout_session_id: session.id, // compat
      stripe_session_id: session.id,         // preferido
      stripe_account_id: stripeCuenta.connected_account_id,
      url_cobro: session.url
    });

    return res.redirect(303, session.url);
  } catch (e) {
    console.error('Error creando checkout:', e);
    req.flash('error', 'No se pudo crear el cobro. Revisa los datos.');
    return res.redirect('/cobros/nuevo');
  }
};

/* =========================
  Confirmación al volver del Checkout (fallback si el webhook tarda)
========================= */
exports.confirmarDesdeSession = async (req, res) => {
  const user = req.session?.usuario;
  if (!user) return res.redirect('/login');

  const sessionId = req.query.session_id;
  if (!sessionId) return res.redirect('/cobros');

  try {
    // Busca el cobro para conocer la cuenta conectada
    const cobro = await Cobro.findOne({
      where: { stripe_checkout_session_id: sessionId, usuario_id: user.id }
    });

    if (!cobro) {
      req.flash('error', 'No se encontró el cobro de esta sesión.');
      return res.redirect('/cobros');
    }

    // Recupera la sesión desde la cuenta conectada
    const s = await stripe.checkout.sessions.retrieve(sessionId, {
      stripeAccount: cobro.stripe_account_id || undefined
    });

    // Si está pagado, actualiza
    const paid = (s.payment_status === 'paid') || (s.status === 'complete');
    if (paid && cobro.estado !== 'pagado') {
      await cobro.update({
        estado: 'pagado',
        moneda: (s.currency || cobro.moneda || 'mxn').toUpperCase(),
        monto_centavos: Number(s.amount_total || cobro.monto_centavos || 0),
        fecha: s.created ? new Date(s.created * 1000) : new Date(),
        stripe_payment_intent_id: typeof s.payment_intent === 'string'
          ? s.payment_intent
          : s.payment_intent?.id || cobro.stripe_payment_intent_id
      });
      req.flash('success', 'Pago confirmado.');
    } else if (!paid) {
      req.flash('error', 'El pago no se completó.');
    }

    return res.redirect('/cobros');
  } catch (e) {
    console.error('Error confirmando sesión:', e);
    req.flash('error', 'No se pudo confirmar el pago.');
    return res.redirect('/cobros');
  }
};

/* =========================
  Extras (placeholders)
========================= */
exports.verCobro = async (req, res) => {
  req.flash('error', 'Vista de detalle no implementada aún.');
  res.redirect('/cobros');
};

exports.reenviarRecibo = async (req, res) => {
  req.flash('error', 'Reenvío de recibo no implementado aún.');
  res.redirect('/cobros');
};

exports.eliminarCobro = async (req, res) => {
  await Cobro.destroy({ where: { id: req.params.id } });
  req.flash('success', 'Cobro eliminado.');
  res.redirect('/cobros');
};
