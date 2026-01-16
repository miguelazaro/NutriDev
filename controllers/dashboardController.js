const { Cobro } = require('../models/associations_cobros');
const Paciente = require('../models/Paciente');
const Cita = require('../models/Cita'); // Modelo de citas

exports.renderDashboard = async (req, res) => {
  const user = req.session?.usuario;
  const uid = user?.id;

  try {
    // Pacientes activos del usuario
    const pacientesActivos = await Paciente.count({ where: { usuario_id: uid } });

    // Cobros pagados
    const whereCobros = { usuario_id: uid, estado: 'pagado' };
    const totalIngresosCents = (await Cobro.sum('monto_centavos', { where: whereCobros })) || 0;

    // Último cobro
    const ultimoCobro = await Cobro.findOne({
      where: whereCobros,
      order: [
        ['fecha', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
    const ultimoIngreso = ultimoCobro ? (ultimoCobro.monto_centavos || 0) / 100 : 0;

    // Placeholders
    const menusCreados = 0;
    const progresosRegistrados = 0;

    // Total de citas
    const totalCitasDashboard = await Cita.count({ where: { usuario_id: uid } });

    res.render('dashboard', {
      pacientesActivos,
      menusCreados,
      progresosRegistrados,
      ultimoIngreso,
      totalIngresos: totalIngresosCents / 100,
      totalCitasDashboard
    });
  } catch (err) {
    console.error('Error al cargar dashboard:', err);
    res.render('dashboard', {
      pacientesActivos: 0,
      menusCreados: 0,
      progresosRegistrados: 0,
      ultimoIngreso: 0,
      totalIngresos: 0,
      totalCitasDashboard: 0
    });
  }
};
