const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

// Mostrar vista de login
exports.loginView = (req, res) => {
  res.render('login', { error: req.flash('error') });
};

// Mostrar vista de registro
exports.registerView = (req, res) => {
  res.render('register', { error: req.flash('error') });
};

// Registrar nuevo usuario
exports.registerUser = async (req, res) => {
  const { nombre, email, password } = req.body;
  try {
    const exists = await Usuario.findOne({ where: { email } });
    if (exists) {
      req.flash('error', 'Este correo ya está registrado.');
      return res.redirect('/register');
    }

    const hashed = await bcrypt.hash(password, 10);
    await Usuario.create({
      nombre,
      email,
      password: hashed,
      rol: 'user' // ✅ Asignar rol por defecto
    });

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error al registrar usuario');
    res.redirect('/register');
  }
};

// Iniciar sesión
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await Usuario.findOne({ where: { email } });
    const isValidPassword = user && await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      req.flash('error', 'Credenciales incorrectas');
      return res.redirect('/login');
    }

    // ✅ Guardar datos en sesión
    req.session.userId = user.id;
    req.session.rol = user.rol;
    req.session.nombreUsuario = user.nombre;

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error al iniciar sesión');
    res.redirect('/login');
  }
};

// Cerrar sesión
exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
