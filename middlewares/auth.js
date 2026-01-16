exports.requireAuth = (req, res, next) => {
  const usuario = req.session.usuario;

  if (!usuario || !usuario.id) {
    req.flash('error', 'Por favor inicia sesión para acceder');
    return res.redirect('/login');
  }

  res.locals.user = usuario;

  next();
};

exports.redirectIfAuthenticated = (req, res, next) => {
  if (req.session.usuario && req.session.usuario.id) {
    return res.redirect('/dashboard');
  }
  next();
};

exports.checkRol = (rolesPermitidos = []) => {
  return (req, res, next) => {
    const usuario = req.session.usuario;

    if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
      req.flash('error', 'No tienes permisos para acceder a esta sección');
      return res.redirect('/dashboard');
    }

    next();
  };
};
