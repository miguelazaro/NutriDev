require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const methodOverride = require('method-override');

const Progreso = require('./models/Progreso');
Progreso.sync({ alter: true });

const app = express();
const sequelize = require('./config/db');

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
  secret: 'nutridevSecret',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// Exponer mensajes flash en todas las vistas
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Body parsers
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

// Planes alimenticios (nuevo de tu compa)
const planesAlimenticiosRoutes = require('./routes/planesAlimenticios');
app.use('/planes-alimenticios', planesAlimenticiosRoutes);

// Planes (precios)
const planesRouter = require('./routes/planes');
app.use('/planes', planesRouter);

// Cobros
const cobrosRouter = require('./routes/cobros');
app.use('/cobros', cobrosRouter);

/* ======================
   Relaciones y BD
====================== */
require('./models/associations');

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
