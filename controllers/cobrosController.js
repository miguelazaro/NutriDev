// controllers/cobrosController.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const { Cobro, StripeAccount } = require('../models/associations_cobros'); // Cobro + StripeAccount
const { Paciente } = require('../models/associations');                    // Paciente REAL

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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
      include: [{ model: Paciente, attributes: ['nombre'] }], // requiere la asociación Cobro.belongsTo(Paciente)
      order: [['createdAt', 'DESC']] // <- usar createdAt; no existe 'fecha'
    });
  } catch (e) {
    console.error('Error consultando cobros:', e);
    req.flash('error', 'No se pudieron cargar tus cobros.');
  }

  res.render('cobros', {
    user,
    cobros,
    stripeCuenta,
    active: 'cobros',
    messages: req.flash()
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
      type: 'standard',               // Connect Standard
      email: user.email || undefined, // ayuda a Stripe a precargar
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
    user,
    messages: req.flash()
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
        success_url: `${BASE_URL}/cobros?ok=1`,
        cancel_url: `${BASE_URL}/cobros?cancel=1`
        // application_fee_amount: Math.round(amount * 0.05), // si cobras comisión (Connect)
      },
      {
        stripeAccount: stripeCuenta.connected_account_id // cobra en la cuenta del nutriólogo
      }
    );

    // Guarda pre‑cobro local como "pendiente"
    await Cobro.create({
      usuario_id: user.id,
      paciente_id,
      concepto,
      monto_centavos: amount,                 // INTEGER en centavos
      moneda: 'MXN',
      estado: 'pendiente',
      stripe_checkout_session_id: session.id, // nombres alineados con tu modelo
      stripe_account_id: stripeCuenta.connected_account_id
      // NO 'fecha': usamos createdAt automático
    });

    return res.redirect(303, session.url);
  } catch (e) {
    console.error('Error creando checkout:', e);
    req.flash('error', 'No se pudo crear el cobro. Revisa los datos.');
    return res.redirect('/cobros/nuevo');
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
