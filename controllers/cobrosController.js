// controllers/cobrosController.js

// Esta función se encarga de mostrar la página principal de la sección de Cobros.
exports.vistaPrincipal = (req, res) => {
  const user = req.session.usuario;

  // En el futuro, aquí buscaremos en la base de datos la lista de cobros
  // que el nutriólogo ha generado para sus pacientes.
  const listaDeCobros = []; 

  res.render('cobros', {
    user,
    cobros: listaDeCobros,
    active: 'cobros', // Para que se ilumine la sección en el menú lateral
    messages: req.flash()
  });
};
