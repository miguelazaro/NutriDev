// middlewares/user.js
module.exports = (req, res, next) => {
  if (req.session.userId) {
    res.locals.user = {
      id: req.session.userId,
      nombre: req.session.nombreUsuario,
      rol: req.session.rol
    };
  } else {
    res.locals.user = null;
  }
  next();
};
