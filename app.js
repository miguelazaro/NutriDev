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
const PDFDocument = require('pdfkit'); // 👈 para generar PDF

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
app.set('trust proxy', 1);

const sequelize = require('./config/db');

// Sincronización puntual que ya tenías
const Progreso = require('./models/Progreso');
Progreso.sync({ alter: true });

/* ======================
   Crear carpetas uploads
====================== */
const uploadPacientesDir = path.join(__dirname, 'public', 'uploads', 'pacientes');
if (!fs.existsSync(uploadPacientesDir)) fs.mkdirSync(uploadPacientesDir, { recursive: true });

const uploadRecetasDir = path.join(__dirname, 'public', 'uploads', 'recetas');
if (!fs.existsSync(uploadRecetasDir)) fs.mkdirSync(uploadRecetasDir, { recursive: true });

/* ======================
   Middlewares base
====================== */
app.use(session({
  secret: process.env.SESSION_SECRET || 'nutridevSecret',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// Exponer mensajes flash en todas las vistas
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

/* ======================
   Stripe Webhook (RAW)
   ⚠️ Debe ir ANTES de express.json()
====================== */
const { Cobro } = require('./models/associations_cobros');
const { Paciente } = require('./models/associations');

// 👇 IMPORTANTE: aquí usamos /webhook para que coincida con la CLI
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const connectedAccountId = event.account || null; // para Connect
    console.log('👉 Webhook recibido:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('🧾 session.id', session.id, 'amount_total', session.amount_total, 'currency', session.currency);

        const cobro = await Cobro.findOne({
          where: {
            [Op.or]: [
              { stripe_session_id: session.id },
              { stripe_checkout_session_id: session.id }
            ]
          }
        });

        if (!cobro) {
          console.warn('⚠️ No encontré cobro para session.id:', session.id);
          break;
        }

        const amountCents = typeof session.amount_total === 'number' ? session.amount_total : 0;

        await cobro.update({
          estado: 'pagado',
          monto_centavos: amountCents,
          moneda: (session.currency || 'mxn').toUpperCase(),
          fecha: session.created ? new Date(session.created * 1000) : new Date(),
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id || cobro.stripe_payment_intent_id,
          stripe_account_id: connectedAccountId || cobro.stripe_account_id
        });

        console.log('✅ Cobro actualizado a pagado:', cobro.id);
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        console.log('💰 PI succeeded', pi.id, 'amount_received', pi.amount_received, 'currency', pi.currency);

        const cobro = await Cobro.findOne({ where: { stripe_payment_intent_id: pi.id } });
        if (!cobro) break;

        await cobro.update({
          estado: 'pagado',
          monto_centavos: typeof pi.amount_received === 'number' ? pi.amount_received : cobro.monto_centavos,
          moneda: (pi.currency || 'mxn').toUpperCase(),
          fecha: pi.created ? new Date(pi.created * 1000) : new Date(),
          stripe_account_id: connectedAccountId || cobro.stripe_account_id
        });

        console.log('✅ Cobro actualizado por PI:', cobro.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.log('❌ PI failed', pi.id);

        const cobro = await Cobro.findOne({ where: { stripe_payment_intent_id: pi.id } });
        if (cobro) await cobro.update({ estado: 'fallido' });
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        console.log('⌛ Session expired', session.id);
        const cobro = await Cobro.findOne({ where: { stripe_session_id: session.id } });
        if (cobro) await cobro.update({ estado: 'expirado' });
        break;
      }

      default:
        // otros eventos por ahora no los necesitamos
        console.log('ℹ️ Evento ignorado:', event.type);
        break;
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Error procesando webhook:', e);
    res.status(500).send('Webhook handler error');
  }
});

/* ======================
   Body parsers (después del webhook)
====================== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// method-override (por body _method o por query ?_method=PUT)
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
  if (req.query && '_method' in req.query) return req.query._method;
  return undefined;
}));

/* ======================
   Vistas / estáticos
====================== */
app.use(expressLayouts);
app.set('layout', 'layouts/sistema');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));

/* ======================
   Auth / User
====================== */
const { requireAuth, redirectIfAuthenticated } = require('./middlewares/auth');
const userMiddleware = require('./middlewares/user');
app.use(userMiddleware);

const authController = require('./controllers/authController');

app.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', { layout: 'layouts/auth', title: 'Iniciar sesión', error: req.flash('error') });
});

app.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('register', { layout: 'layouts/auth', title: 'Registro', error: req.flash('error') });
});

app.post('/login', authController.loginUser);
app.post('/register', authController.registerUser);
app.get('/logout', authController.logout);

/* ======================
   Rutas principales
====================== */
app.get('/', authController.vistaBienvenida);

// Dashboard
const dashboardController = require('./controllers/dashboardController');
app.get('/dashboard', requireAuth, (req, res, next) => {
  res.locals.active = 'dashboard';
  next();
}, dashboardController.renderDashboard);

// Progreso
app.get('/progreso', requireAuth, (req, res) => {
  res.render('progreso', { active: 'progreso' });
});

// IA
app.use('/ia', require('./routes/ia')); // (solo una vez)

// Pacientes
const pacientesRouter = require('./routes/pacientes');
app.use('/pacientes', requireAuth, (req, res, next) => {
  res.locals.active = 'pacientes';
  next();
}, pacientesRouter);

// Recetas
const recetasRouter = require('./routes/recetas');
app.use('/recetas', requireAuth, (req, res, next) => {
  res.locals.active = 'recetas';
  next();
}, recetasRouter);

// Planes alimenticios
const planesAlimenticiosRoutes = require('./routes/planesAlimenticios');
app.use('/planes-alimenticios', planesAlimenticiosRoutes);

// Planes (precios)
const planesRouter = require('./routes/planes');
app.use('/planes', planesRouter);

// Cobros
const cobrosRouter = require('./routes/cobros');
app.use('/cobros', cobrosRouter);

/* ======================
   Recibo PDF de Cobro
====================== */
app.get('/cobros/:id/recibo.pdf', requireAuth, async (req, res) => {
  try {
    const user = req.session?.usuario;
    const id = Number(req.params.id);

    const cobro = await Cobro.findOne({
      where: { id, usuario_id: user.id },
      include: [{ model: Paciente, attributes: ['nombre', 'email'] }]
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

    // Header
    doc
      .fontSize(18).text('Recibo de Pago', { align: 'right' })
      .moveDown(0.3)
      .fontSize(10).fillColor('#555')
      .text(`NutriDev`, { align: 'right' })
      .text(`Emitido por: ${user?.nombre || 'Nutriólogo'}`, { align: 'right' })
      .text(`Correo: ${user?.email || '—'}`, { align: 'right' })
      .moveDown();

    // Datos principales
    doc
      .fillColor('#000').fontSize(12).text(`ID Cobro: ${id}`)
      .text(`Fecha: ${fechaStr}`)
      .text(`Estado: ${estado}`)
      .moveDown(0.5)
      .text(`Paciente: ${paciente}`)
      .text(`Correo paciente: ${pacienteEmail}`)
      .moveDown(1);

    // Concepto y monto
    doc
      .fontSize(12).text('Detalle del pago', { underline: true })
      .moveDown(0.5);

    doc
      .text(`Concepto: ${cobro.concepto}`)
      .text(`Monto: ${moneda} ${monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      .moveDown(1);

    // Referencias Stripe
    if (cobro.stripe_payment_intent_id) {
      doc.fontSize(10).fillColor('#555')
        .text(`Stripe PaymentIntent: ${cobro.stripe_payment_intent_id}`);
    }
    if (cobro.stripe_session_id || cobro.stripe_checkout_session_id) {
      doc.fontSize(10).fillColor('#555')
        .text(`Stripe Checkout Session: ${cobro.stripe_session_id || cobro.stripe_checkout_session_id}`);
    }

    // Footer
    doc.moveDown(2).fontSize(9).fillColor('#777')
      .text('Gracias por tu pago.', { align: 'center' })
      .text('Este comprobante es válido como recibo simple.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Error generando PDF:', err);
    res.status(500).send('No se pudo generar el PDF');
  }
});

/* ======================
   Relaciones y BD
====================== */
require('./models/associations');
require('./models/associations_cobros');

sequelize.sync({ force: false })
  .then(() => console.log('Bd conectada'))
  .catch(err => console.error('Error al conectar con la BD:', err));

/* ======================
   Servidor
====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
