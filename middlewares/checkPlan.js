exports.requirePlan = (planesPermitidos = []) => {
  return (req, res, next) => {
    const usuario = req.session.usuario;

    // 1. Si no hay un usuario en la sesión, no puede pasar.
    if (!usuario) {
      req.flash('error', 'Por favor, inicia sesión para continuar.');
      return res.redirect('/login');
    }

    // 2. El 'admin' siempre tiene acceso a todo. ¡Es el jefe!
    if (usuario.rol === 'admin') {
      return next(); // El admin no necesita revisión, pasa directo.
    }

    // 3. Revisamos si el plan del usuario está en la lista de los permitidos.
    if (usuario.plan && planesPermitidos.includes(usuario.plan)) {
      // ¡Sí tiene permiso! Lo dejamos pasar a la siguiente función (el controlador).
      return next();
    }

    // 4. Si llegamos hasta aquí, es porque no tiene el plan requerido.
    req.flash('error', 'Esta función requiere un plan Premium. ¡Actualiza tu cuenta para disfrutar de más beneficios!');
    res.redirect('/planes'); // Lo mandamos a la página de planes para que compre.
  };
};
