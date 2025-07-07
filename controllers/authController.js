const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

exports.loginView = (req, res) => {
  res.render('login', { error: req.flash('error') });
};

exports.registerView = (req, res) => {
  res.render('register', { error: req.flash('error') });
};

exports.registerUser = async (req, res) => {
  const { nombre, email, password } = req.body;
  try {
    const exists = await Usuario.findOne({ where: { email } });
    if (exists) {
      req.flash('error', 'Este correo ya está registrado.');
      return res.redirect('/register');
    }

    const hashed = await bcrypt.hash(password, 10);
    await Usuario.create({ nombre, email, password: hashed });

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error al registrar usuario');
    res.redirect('/register');
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await Usuario.findOne({ where: { email } });
    if (!user || !await bcrypt.compare(password, user.password)) {
      req.flash('error', 'Credenciales incorrectas');
      return res.redirect('/login');
    }

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

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
