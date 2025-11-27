// app.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const Stripe = require('stripe');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const helmet = require('helmet');
const compression = require('compression');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const sequelize = require('./config/db');

/* -----------------------------
   Crear carpetas uploads (si faltan)
------------------------------ */
for (const p of [
  path.join(__dirname, 'public', 'uploads', 'pacientes'),
  path.join(__dirname, 'public', 'uploads', 'recetas'),
]) fs.mkdirSync(p, { recursive: true });

/* -----------------------------
   Middlewares base
   (HSTS/CSP desactivados para evitar bloquear assets actuales)
------------------------------ */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: false,
}));
app.use(compression());

/* -----------------------------
   Sesiones + Flash
------------------------------ */
app.use(session({
  secret: process.env.SESSION_SECRET || 'nutridevSecret',
  resave: false,
  saveUninitialized: false,
  name: 'sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8, // 8h
  },
}));

app.use(flash());

// Variables flash disponibles en TODAS las vistas
app.use((req, res, next) => {
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  res.locals.old_email = req.flash('old_email');
  // alias de compatibilidad
  res.locals.messages = {
    success: res.locals.success,
    error: res.locals.error,
  };
  next();
});

/* -----------------------------
   Webhook de Stripe (RAW) — debe ir ANTES de json/urlencoded
------------------------------ */
const { Cobro } = require('./models/associations_cobros');
const { Paciente } = require('./models/associations');

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    console.log('[Webhook]', event.type, 'acct:', event.account || '—');
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const connectedAccountId = event.account || null;

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const cobro = await Cobro.findOne({
          where: { [Op.or]: [{ stripe_session_id: s.id }, { stripe_checkout_session_id: s.id }] },
        });
        if (cobro) {
          await cobro.update({
            estado: 'pagado',
            monto_centavos: Number(s.amount_total || 0),
            moneda: (s.currency || 'mxn').toUpperCase(),
            fecha: s.created ? new Date(s.created * 1000) : new Date(),
            stripe_payment_intent_id: typeof s.payment_intent === 'string'
              ? s.payment_intent
              : s.payment_intent?.id || cobro.stripe_payment_intent_id,
            stripe_account_id: connectedAccountId || cobro.stripe_account_id,
          });
        } else {
          console.warn('No se encontró Cobro para session.id:', s.id);
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const cobro = await Cobro.findOne({ where: { stripe_payment_intent_id: pi.id } });
        if (cobro) {
          await cobro.update({
            estado: 'pagado',
            monto_centavos: Number(pi.amount_received || cobro.monto_centavos || 0),
            moneda: (pi.currency || 'mxn').toUpperCase(),
            fecha: pi.created ? new Date(pi.created * 1000) : new Date(),
            stripe_account_id: connectedAccountId || cobro.stripe_account_id,
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const cobro = await Cobro.findOne({ where: { stripe_payment_intent_id: pi.id } });
        if (cobro) await cobro.update({ estado: 'fallido' });
        break;
      }
      case 'checkout.session.expired': {
        const s = event.data.object;
        const cobro = await Cobro.findOne({ where: { stripe_session_id: s.id } });
        if (cobro) await cobro.update({ estado: 'expirado' });
        break;
      }
      default:
        // ignorar eventos no usados
        break;
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Error procesando webhook:', e);
    res.status(500).send('Webhook handler error');
  }
});

// Health-check opcional
app.get('/webhook', (req, res) => {
  res.status(200).send('Stripe webhook OK (POST only)');
});

/* -----------------------------
   Parsers (después del webhook)
------------------------------ */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* method-override */
app.use(methodOverride(req => {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const m = req.body._method; delete req.body._method; return m;
  }
  if (req.query && '_method' in req.query) return req.query._method;
  return undefined;
}));

/* -----------------------------
   Vistas / estáticos
------------------------------ */
app.use(expressLayouts);
app.set('layout', 'layouts/sistema');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

/* -----------------------------
   Auth / User
------------------------------ */
const { requireAuth, redirectIfAuthenticated } = require('./middlewares/auth');
const userMiddleware = require('./middlewares/user');
app.use(userMiddleware);

const authController = require('./controllers/authController');

app.get('/login', redirectIfAuthenticated, (req, res) =>
  res.render('login', { layout: 'layouts/auth', title: 'Iniciar sesión' })
);
app.get('/register', redirectIfAuthenticated, (req, res) =>
  res.render('register', { layout: 'layouts/auth', title: 'Registro' })
);
app.post('/login', authController.loginUser);
app.post('/register', authController.registerUser);
app.get('/logout', authController.logout);

/* -----------------------------
   Rutas principales
------------------------------ */
app.get('/', authController.vistaBienvenida);

// Dashboard
const dashboardController = require('./controllers/dashboardController');
app.get('/dashboard', requireAuth, (req, res, next) => {
  res.locals.active = 'dashboard';
  next();
}, dashboardController.renderDashboard);

// Progreso
app.get('/progreso', requireAuth, (req, res) => res.render('progreso', { active: 'progreso' }));

// IA
app.use('/ia', require('./routes/ia'));

// Pacientes
const pacientesRouter = require('./routes/pacientes');
app.use('/pacientes', requireAuth, (req, res, next) => { res.locals.active = 'pacientes'; next(); }, pacientesRouter);

// Citas
const citasRouter = require('./routes/citas');
app.use('/citas', requireAuth, (req, res, next) => { res.locals.active = 'citas'; next(); }, citasRouter);

// Recetas
const recetasRouter = require('./routes/recetas');
app.use('/recetas', requireAuth, (req, res, next) => { res.locals.active = 'recetas'; next(); }, recetasRouter);

// Planes alimenticios (protegido)
const planesAlimenticiosRoutes = require('./routes/planesAlimenticios');
app.use('/planes-alimenticios',
  requireAuth,
  (req, res, next) => { res.locals.active = 'planes-alimenticios'; next(); },
  planesAlimenticiosRoutes
);

// Planes (protegido)
const planesRouter = require('./routes/planes');
app.use('/planes', requireAuth, (req, res, next) => { res.locals.active = 'planes'; next(); }, planesRouter);

// Cobros
const cobrosRouter = require('./routes/cobros');
app.use('/cobros', cobrosRouter);

/* -----------------------------
   Recibo PDF de Cobro
------------------------------ */
app.get('/cobros/:id/recibo.pdf', requireAuth, async (req, res) => {
  try {
    const user = req.session?.usuario;
    const id = Number(req.params.id);

    const cobro = await Cobro.findOne({
      where: { id, usuario_id: user.id },
      include: [{ model: Paciente, attributes: ['nombre', 'email'] }],
    });
    if (!cobro) return res.status(404).send('Cobro no encontrado');

    const monto = (cobro.monto_centavos || 0) / 100;
    const fecha = cobro.fecha || cobro.createdAt;
    const fechaStr = new Date(fecha).toLocaleString('es-MX');
    const estado = (cobro.estado || '').toUpperCase();
    const paciente = cobro.Paciente?.nombre || '—';
    const pacienteEmail = cobro.Paciente?.email || '—';
    const moneda = (cobro.moneda || 'MXN').toUpperCase();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recibo_${id}.pdf"`);

    const doc = new PDFDocument({ margin: 48 });
    doc.pipe(res);

    doc.fontSize(18).text('Recibo de Pago', { align: 'right' })
      .moveDown(0.3).fontSize(10).fillColor('#555')
      .text('NutriDev', { align: 'right' })
      .text(`Emitido por: ${user?.nombre || 'Nutriólogo'}`, { align: 'right' })
      .text(`Correo: ${user?.email || '—'}`, { align: 'right' })
      .moveDown();

    doc.fillColor('#000').fontSize(12)
      .text(`ID Cobro: ${id}`)
      .text(`Fecha: ${fechaStr}`)
      .text(`Estado: ${estado}`)
      .moveDown(0.5)
      .text(`Paciente: ${paciente}`)
      .text(`Correo paciente: ${pacienteEmail}`)
      .moveDown(1);

    doc.fontSize(12).text('Detalle del pago', { underline: true }).moveDown(0.5);
    doc.text(`Concepto: ${cobro.concepto}`)
      .text(`Monto: ${moneda} ${monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      .moveDown(1);

    if (cobro.stripe_payment_intent_id) doc.fontSize(10).fillColor('#555').text(`Stripe PaymentIntent: ${cobro.stripe_payment_intent_id}`);
    if (cobro.stripe_session_id || cobro.stripe_checkout_session_id) doc.fontSize(10).fillColor('#555').text(`Stripe Checkout Session: ${cobro.stripe_session_id || cobro.stripe_checkout_session_id}`);

    doc.end();
  } catch (err) {
    console.error('Error generando PDF:', err);
    res.status(500).send('No se pudo generar el PDF');
  }
});

/* -----------------------------
   Asociaciones y conexión BD
------------------------------ */
require('./models/associations');
require('./models/associations_cobros');

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await sequelize.authenticate();
      console.log('BD conectada ✅');
    } catch (err) {
      console.error('Error al conectar con la BD:', err);
    }
  })();
}

/* -----------------------------
   Servidor (solo si se ejecuta directamente)
------------------------------ */
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}
