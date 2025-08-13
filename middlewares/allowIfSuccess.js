module.exports = function allowIfSuccess(req, res, next) {
  // Permite el acceso si viene de éxito/cancel del pago (?ok=1/0)
  if (req.query.ok === '1' || req.query.ok === '0') return next();
  // Si el usuario está logueado, también pasa
  if (req.session?.usuario) return next();
  // Si no, manda a login y conserva la URL de retorno
  return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
};
