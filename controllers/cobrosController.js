
exports.vistaPrincipal = (req, res) => {
  const user = req.session.usuario;

  const listaDeCobros = []; 

  res.render('cobros', {
    user,
    cobros: listaDeCobros,
    active: 'cobros', 
    messages: req.flash()
  });
};
