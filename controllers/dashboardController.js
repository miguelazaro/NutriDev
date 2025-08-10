// controllers/dashboardController.js
const { Cobro } = require('../models/associations_cobros');
const Paciente = require('../models/Paciente'); // ajusta si tu ruta difiere

exports.renderDashboard = async (req, res) => {
  const user = req.session?.usuario;

  try {
    // Pacientes: SIN filtro por usuario porque la tabla no tiene usuario_id
    const pacientesActivos = await Paciente.count();

    // Ingresos: suma de cobros pagados (centavos) del usuario actual
    const totalIngresosCents =
      (await Cobro.sum('monto_centavos', {
        where: user ? { usuario_id: user.id, estado: 'pagado' } : { estado: 'pagado' }
      })) || 0;

    // Último cobro pagado (para la card "Último ingreso")
    const ultimoCobro = await Cobro.findOne({
      where: user ? { usuario_id: user.id, estado: 'pagado' } : { estado: 'pagado' },
      order: [
        ['fecha', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    const ultimoIngreso = ultimoCobro ? (ultimoCobro.monto_centavos || 0) / 100 : 0;

    // Mantengo tus números de ejemplo para estas tarjetas
    const menusCreados = 0;          // reemplaza con tu lógica real cuando la tengas
    const progresosRegistrados = 0;  // reemplaza con tu lógica real cuando la tengas

    res.render('dashboard', {
      pacientesActivos,
      menusCreados,
      progresosRegistrados,
      ultimoIngreso,
      totalIngresos: totalIngresosCents / 100
    });
  } catch (err) {
    console.error('Error al cargar dashboard:', err);
    res.render('dashboard', {
      pacientesActivos: 0,
      menusCreados: 0,
      progresosRegistrados: 0,
      ultimoIngreso: 0,
      totalIngresos: 0
    });
  }
};
