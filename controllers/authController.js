const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');


exports.vistaBienvenida = (req, res) => {
  res.render('bienvenida', {
    layout: 'layouts/auth',
    title: 'Bienvenido a NutriDev'
  });
};
exports.loginView = (req, res) => {
  res.render('login', { error: req.flash('error') });
};

exports.registerView = (req, res) => {
  res.render('register', { error: req.flash('error') });
};

exports.registerUser = async (req, res) => {
  const { nombre, email, password, terms } = req.body; 

  if (!terms) {
    req.flash('error', 'Debes aceptar los Términos y la Política de Privacidad para continuar.');
    return res.redirect('/register');
  }

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
      rol: 'nutriologo' 
    });

    req.flash('success', '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.');
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
    const isValidPassword = user && await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      req.flash('error', 'Credenciales incorrectas');
      return res.redirect('/login');
    }

    req.session.usuario = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      plan: user.plan 
    };

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
