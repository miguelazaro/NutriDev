// --- CORRECCIÓN AQUÍ ---
// Movemos dotenv.config() al principio de todo para asegurar que las variables
// de entorno estén disponibles para toda la aplicación desde el inicio.
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');

const app = express();
const sequelize = require('./config/db');

// Middlewares
app.use(session({
    secret: 'nutridevSecret',
    resave: false,
    saveUninitialized: false
}));

app.use(flash());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(expressLayouts);
app.set('layout', 'layouts/sistema');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));

// Autenticación
const { requireAuth, redirectIfAuthenticated } = require('./middlewares/auth');
const userMiddleware = require('./middlewares/user');
app.use(userMiddleware);

// Controladores de autenticación
const authController = require('./controllers/authController');

app.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('login', {
        layout: 'layouts/auth',
        title: 'Iniciar sesión',
        error: req.flash('error')
    });
});

app.get('/register', redirectIfAuthenticated, (req, res) => {
    res.render('register', {
        layout: 'layouts/auth',
        title: 'Registro',
        error: req.flash('error')
    });
});

app.post('/login', authController.loginUser);
app.post('/register', authController.registerUser);
app.get('/logout', authController.logout);

// Página principal
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Dashboard
const dashboardController = require('./controllers/dashboardController');
app.get('/dashboard', requireAuth, (req, res, next) => {
    res.locals.active = 'dashboard';
    next();
}, dashboardController.renderDashboard);

// Otras vistas
app.get('/progreso', requireAuth, (req, res) => {
    res.render('progreso', { active: 'progreso' });
});

app.get('/cobros', requireAuth, (req, res) => {
    res.render('cobros', { active: 'cobros' });
});

// Rutas: Pacientes
const pacientesRouter = require('./routes/pacientes');
app.use('/pacientes', requireAuth, (req, res, next) => {
    res.locals.active = 'pacientes';
    next();
}, pacientesRouter);

// Rutas: Recetas (Ahora maneja todo)
const recetasRouter = require('./routes/recetas');
app.use('/recetas', requireAuth, (req, res, next) => {
    res.locals.active = 'recetas';
    next();
}, recetasRouter);

// Conexión BD
sequelize.sync({ force: false })
    .then(() => console.log('Bd conectada'))
    .catch(err => console.error('Error al conectar con la BD:', err));

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
