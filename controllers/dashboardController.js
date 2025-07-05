const Paciente = require('../models/Paciente'); // ajusta la ruta si es necesario

exports.renderDashboard = async (req, res) => {
  try {
    const totalPacientes = await Paciente.count();

    res.render('dashboard', {
      pacientesActivos: totalPacientes
    });
  } catch (err) {
    console.error('Error al cargar dashboard:', err);
    res.render('dashboard', {
      pacientesActivos: 0
    });
  }
};
