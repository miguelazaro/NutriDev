const express = require('express');
const path = require('path');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');

const app = express();
const sequelize = require('./config/db');

// Controladores
const dashboardController = require('./controllers/dashboardController'); // <<--- IMPORTADO AQUÍ

// Middlewares
app.use(session({
    secret: 'nutridevSecret',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());
app.use(express.urlencoded({ extended: true }));

// EJS y layouts
app.use(expressLayouts);
app.set('layout', 'layouts/sistema');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));



// Rutas de autenticación
const authRoutes = require('./routes/authRoutes');
app.use('/', authRoutes);

// Redirección base
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Dashboard con contador de pacientes
app.get('/dashboard', (req, res, next) => {
    res.locals.active = 'dashboard';
    next();
}, dashboardController.renderDashboard);

// Rutas de vistas estáticas con variable de menú activo

app.get('/progreso', (req, res) => {
    res.render('progreso', { active: 'progreso' });
});
app.get('/cobros', (req, res) => {
    res.render('cobros', { active: 'cobros' });
});

// Ruta de pacientes (con clase activa)
const pacientesRouter = require('./routes/pacientes');
app.use('/pacientes', (req, res, next) => {
    res.locals.active = 'pacientes';
    next();
}, pacientesRouter);

// Rutas de recetas (con controlador)
// Rutas de recetas (con clase activa)
const recetasRouter = require('./routes/recetas');
app.use('/recetas', (req, res, next) => {
    res.locals.active = 'recetas';
    next();
}, recetasRouter);


// Conexión a la base de datos
sequelize.sync({ alter: true })
    .then(() => console.log('Bd conectada '))
    .catch(err => console.error('Error al conectar con la BD:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
