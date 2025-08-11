// controllers/authController.js
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

const isValidEmail = (email) => {
  // validación sencilla para evitar depender de librerías nuevas
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

exports.vistaBienvenida = (req, res) => {
  res.render('bienvenida', {
    layout: 'layouts/auth',
    title: 'Bienvenido a NutriDev'
  });
};

exports.loginView = (req, res) => {
  res.render('login', { error: req.flash('error'), success: req.flash('success') });
};

exports.registerView = (req, res) => {
  res.render('register', { error: req.flash('error'), success: req.flash('success') });
};

exports.registerUser = async (req, res) => {
  try {
    const nombre = (req.body.nombre || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const terms = req.body.terms;

    // Validaciones mínimas
    if (!terms) {
      req.flash('error', 'Debes aceptar los Términos y la Política de Privacidad para continuar.');
      return res.redirect('/register');
    }
    if (!nombre || !email || !password) {
      req.flash('error', 'Todos los campos son obligatorios.');
      return res.redirect('/register');
    }
    if (!isValidEmail(email)) {
      req.flash('error', 'Correo electrónico no válido.');
      return res.redirect('/register');
    }
    if (password.length < 8) {
      req.flash('error', 'La contraseña debe tener al menos 8 caracteres.');
      return res.redirect('/register');
    }

    // ¿Ya existe el correo?
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
      rol: 'nutriologo',    // mantenemos tu rol por defecto
      plan: 'basico'        // asegura que exista un plan por defecto (puedes quitarlo si tu modelo ya tiene default)
    });

    req.flash('success', '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.');
    return res.redirect('/login');
  } catch (err) {
    console.error('Error registerUser:', err);
    req.flash('error', 'Error al registrar usuario');
    return res.redirect('/register');
  }
};

exports.loginUser = async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      req.flash('error', 'Correo y contraseña son obligatorios.');
      return res.redirect('/login');
    }

    const user = await Usuario.findOne({ where: { email } });

    // Comparación segura
    const isValidPassword = user && await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      req.flash('error', 'Credenciales incorrectas');
      return res.redirect('/login');
    }

    // Prevención de fijación de sesión
    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerating session:', err);
        req.flash('error', 'Error de sesión');
        return res.redirect('/login');
      }

      // Guardamos solo lo necesario en sesión
      req.session.usuario = {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        plan: user.plan || 'basico'
      };

      // Si guardaste una ruta antes de forzar login, respétala
      const redirectTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;

      req.session.save(() => res.redirect(redirectTo));
    });
  } catch (err) {
    console.error('Error loginUser:', err);
    req.flash('error', 'Error al iniciar sesión');
    return res.redirect('/login');
  }
};

exports.logout = (req, res) => {
  // Opcional: limpiar datos sensibles antes
  req.session.usuario = null;
  req.session.destroy(() => {
    // Si configuraste cookie custom (p.ej. name: 'sid'), puedes limpiarla:
    // res.clearCookie('sid');
    return res.redirect('/login');
  });
};
