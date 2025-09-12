// controllers/authController.js
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

exports.vistaBienvenida = (req, res) => {
  res.render('bienvenida', { layout: 'layouts/auth', title: 'Bienvenido a NutriDev' });
};

exports.loginView = (req, res) => {
  // error/success/old_email ya vienen por res.locals (middleware de app.js)
  res.render('login', { layout: 'layouts/auth' });
};

exports.registerView = (req, res) => {
  res.render('register', { layout: 'layouts/auth' });
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
      rol: 'nutriologo',
      plan: 'basico'
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
      req.flash('old_email', email);
      return res.redirect('/login');
    }

    const user = await Usuario.findOne({ where: { email } });
    const isValidPassword = user && await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      req.flash('error', 'Credenciales incorrectas. Verifica tu correo o contraseña.');
      req.flash('old_email', email);
      return res.redirect('/login');
    }

    // Regenerar sesión para evitar fijación
    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerating session:', err);
        req.flash('error', 'Error de sesión');
        return res.redirect('/login');
      }

      // Guardar datos mínimos del usuario
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
    // si definiste cookie de sesión personalizada, podrías limpiar aquí con res.clearCookie('sid')
    return res.redirect('/login');
  });
};
