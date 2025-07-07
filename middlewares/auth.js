// middlewares/auth.js
exports.requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    req.flash('error', 'Por favor inicia sesión para acceder');
    return res.redirect('/login');
  }
  
  // Guardar datos de usuario en res.locals para acceso en vistas
  res.locals.user = {
    id: req.session.userId,
    nombre: req.session.nombreUsuario,
    rol: req.session.rol
  };
  
  next();
};

exports.redirectIfAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
};

// Middleware para verificar rol de usuario
exports.checkRol = (rolesPermitidos = []) => {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.session.rol)) {
      req.flash('error', 'No tienes permisos para acceder a esta sección');
      return res.redirect('/dashboard');
    }
    next();
  };
};