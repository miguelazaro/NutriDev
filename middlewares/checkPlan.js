// middlewares/checkPlan.js
exports.requirePlan = (planesPermitidos = []) => {
  return (req, res, next) => {
    const usuario = req.session?.usuario;

    // 1) sin sesión
    if (!usuario) {
      req.flash('error', 'Por favor, inicia sesión para continuar.');
      return res.redirect('/login');
    }

    // 2) admin pasa siempre
    if (usuario.rol === 'admin') return next();

    // 3) si su plan está permitido, pasa
    if (usuario.plan && planesPermitidos.includes(usuario.plan)) {
      return next();
    }

    // 4) si no tiene plan requerido, mensaje y back útil
    req.flash('error', 'Necesitas plan Premium para usar esta función.');

    // intenta regresar a la ficha del paciente si la ruta lo tiene
    const pid =
      (req.params && req.params.id) ||
      (req.body && req.body.paciente_id) ||
      null;

    if (pid) {
      return res.redirect(`/pacientes/${pid}`);
    }

    // fallback: página de planes / precios
    return res.redirect('/planes');
  };
};
