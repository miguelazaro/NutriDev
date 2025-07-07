// middlewares/user.js
module.exports = (req, res, next) => {
  // Pasar datos de usuario a todas las vistas
  if (req.session.userId) {
    res.locals.user = {
      id: req.session.userId,
      nombre: req.session.nombreUsuario,
      rol: req.session.rol
    };
  }
  next();
};