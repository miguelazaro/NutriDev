// controllers/pacientesController.js
const { Paciente, Progreso, NotaNutriologo, ArchivoPaciente } = require('../models/associations');

// Helper: id del usuario logueado
function uid(req) {
  return req.session?.usuario?.id;
}

// ---------------- Distribución por edades ----------------
function calcularDistribucionEdades(pacientes) {
  const hoy = new Date();
  const grupos = { '0-18': 0, '19-30': 0, '31-45': 0, '46-60': 0, '60+': 0 };

  pacientes.forEach(p => {
    if (!p.fecha_nacimiento) return;
    try {
      const nacimiento = new Date(p.fecha_nacimiento);
      if (isNaN(nacimiento.getTime())) return;

      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      const mes = hoy.getMonth() - nacimiento.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;

      if (edad <= 18) grupos['0-18']++;
      else if (edad <= 30) grupos['19-30']++;
      else if (edad <= 45) grupos['31-45']++;
      else if (edad <= 60) grupos['46-60']++;
      else grupos['60+']++;
    } catch (err) {
      console.error(`Error calculando edad para paciente ${p.id}:`, err);
    }
  });

  return grupos;
}

// ---------------- Nuevos del mes ----------------
function contarNuevosEsteMes(pacientes) {
  const hoy = new Date();
  const m = hoy.getMonth();
  const y = hoy.getFullYear();

  return pacientes.filter(p => {
    try {
      const base = p.fecha_registro ? new Date(p.fecha_registro) : null;
      if (!base || isNaN(base.getTime())) return false;
      return base.getMonth() === m && base.getFullYear() === y;
    } catch {
      return false;
    }
  }).length;
}

// ================== Vistas ==================

// Listado
exports.index = async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.redirect('/login');

  try {
    const pacientes = await Paciente.findAll({
      where: { usuario_id: userId },
      // IMPORTANTE: tu modelo usa createdAt: 'fecha_registro'
      order: [['fecha_registro', 'DESC']]
    });

    const distribucionEdades = calcularDistribucionEdades(pacientes);
    const nuevosEsteMes = contarNuevosEsteMes(pacientes);

    res.render('pacientes', { pacientes, distribucionEdades, nuevosEsteMes });
  } catch (error) {
    console.error('Error en index:', error);
    res.status(500).send('Error al cargar los pacientes');
  }
};

// Formulario nuevo
exports.form = (req, res) => {
  if (!uid(req)) return res.redirect('/login');
  res.render('../views/pacientes/create.ejs');
};

// Crear
exports.guardar = async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.redirect('/login');

  try {
    const {
      nombre, genero, fecha_nacimiento, pais_residencia, telefono,
      enviar_cuestionario, email, historial,
      estatura, actividad, objetivo, comidas_dia, preferencias
    } = req.body;

    const foto = req.files?.foto?.[0]?.filename || null;
    const archivo = req.files?.archivo?.[0]?.filename || null;

    await Paciente.create({
      nombre,
      genero,
      fecha_nacimiento,
      pais_residencia,
      telefono,
      enviar_cuestionario: enviar_cuestionario === 'on',
      email: email?.trim() || null,
      historial,
      foto,
      archivo,
      estatura: estatura ? parseInt(estatura) : null,
      actividad,
      objetivo,
      comidas_dia: comidas_dia ? parseInt(comidas_dia) : null,
      preferencias,
      usuario_id: userId
    });

    req.flash('success', 'Paciente creado.');
    res.redirect('/pacientes');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al guardar paciente');
  }
};

// Obtener un paciente propio (helper)
async function getPacientePropio(req) {
  const userId = uid(req);
  const id = Number(req.params.id);
  if (!userId || !id) return null;
  return Paciente.findOne({ where: { id, usuario_id: userId } });
}

// Form editar
exports.editar = async (req, res) => {
  try {
    const paciente = await getPacientePropio(req);
    if (!paciente) return res.status(404).send('Paciente no encontrado');
    res.render('pacientes/edit', { paciente });
  } catch (error) {
    console.error('Error en editar:', error);
    res.status(500).send('Error al cargar el formulario de edición');
  }
};

// Actualizar
exports.actualizar = async (req, res) => {
  try {
    const paciente = await getPacientePropio(req);
    if (!paciente) return res.status(404).send('Paciente no encontrado');

    const {
      nombre, genero, fecha_nacimiento, pais,
      telefono, email, historial,
      estatura, actividad, objetivo, comidas_dia, preferencias,
      enviar_anamnesis
    } = req.body;

    const foto = req.files?.foto?.[0]?.filename || paciente.foto;
    const archivo = req.files?.archivo?.[0]?.filename || paciente.archivo;

    await paciente.update({
      nombre,
      genero,
      fecha_nacimiento: fecha_nacimiento || null,
      estatura: estatura ? parseInt(estatura) : null,
      actividad,
      objetivo,
      comidas_dia: comidas_dia ? parseInt(comidas_dia) : null,
      pais_residencia: pais || 'México',
      telefono,
      enviar_cuestionario: enviar_anamnesis === '1' ? 1 : 0,
      email: email?.trim() || null,
      historial,
      preferencias,
      foto,
      archivo,
      fecha_actualizacion: new Date()
    });

    req.flash('success', 'Paciente actualizado correctamente');
    res.redirect('/pacientes');
  } catch (error) {
    console.error('Error en actualizar:', error);
    req.flash('error', 'Ocurrió un error al actualizar el paciente');
    res.redirect('/pacientes');
  }
};

// Eliminar
exports.eliminar = async (req, res) => {
  try {
    const userId = uid(req);
    if (!userId) return res.redirect('/login');

    const deleted = await Paciente.destroy({
      where: { id: req.params.id, usuario_id: userId }
    });

    if (!deleted) req.flash('error', 'Paciente no encontrado');
    else req.flash('success', 'Paciente eliminado.');

    res.redirect('/pacientes');
  } catch (error) {
    console.error('Error en eliminar:', error);
    res.status(500).send('Error al eliminar el paciente');
  }
};

// Detalle
exports.detalle = async (req, res) => {
  try {
    const paciente = await Paciente.findOne({
      where: { id: req.params.id, usuario_id: uid(req) },
      include: [
        { model: ArchivoPaciente },
        { model: Progreso, as: 'Progresos' },
        { model: NotaNutriologo, as: 'NotaNutriologos' }
      ],
      order: [[{ model: Progreso, as: 'Progresos' }, 'fecha', 'ASC']]
    });

    if (!paciente) {
      req.flash('error', 'Paciente no encontrado');
      return res.redirect('/pacientes');
    }

    res.render('pacientes/detalle', { paciente: paciente.get({ plain: true }) });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error al cargar paciente');
    res.redirect('/pacientes');
  }
};

// Subir archivo
exports.subirArchivo = async (req, res) => {
  const pacienteId = req.params.id;
  const file = req.file;

  if (!uid(req)) return res.redirect('/login');

  if (!file) {
    req.flash('error', 'No se subió ningún archivo');
    return res.redirect(`/pacientes/${pacienteId}`);
  }

  try {
    const p = await Paciente.findOne({ where: { id: pacienteId, usuario_id: uid(req) } });
    if (!p) {
      req.flash('error', 'Paciente no encontrado');
      return res.redirect('/pacientes');
    }

    await ArchivoPaciente.create({
      nombre_archivo: file.originalname,
      tipo: file.mimetype.includes('pdf') ? 'documento' : 'imagen',
      ruta: `/uploads/pacientes/${file.filename}`,
      pacienteId
    });
    req.flash('success', 'Archivo subido correctamente');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error al guardar el archivo');
  }

  res.redirect(`/pacientes/${pacienteId}`);
};

// Guardar progreso
exports.guardarProgreso = async (req, res) => {
  const { peso, fecha, observaciones } = req.body;
  const pacienteId = req.params.id;

  if (!uid(req)) return res.redirect('/login');

  try {
    const p = await Paciente.findOne({ where: { id: pacienteId, usuario_id: uid(req) } });
    if (!p) { req.flash('error', 'Paciente no encontrado'); return res.redirect('/pacientes'); }

    await Progreso.create({ peso, fecha, observaciones, pacienteId });

    req.flash('success', 'Progreso registrado correctamente');
  } catch (error) {
    console.error('Error al guardar progreso:', error);
    req.flash('error', 'Error al guardar el progreso');
  }

  res.redirect(`/pacientes/${pacienteId}`);
};

// Guardar nota
exports.guardarNota = async (req, res) => {
  const { nota } = req.body;
  const pacienteId = req.params.id;

  if (!uid(req)) return res.redirect('/login');

  try {
    const p = await Paciente.findOne({ where: { id: pacienteId, usuario_id: uid(req) } });
    if (!p) { req.flash('error', 'Paciente no encontrado'); return res.redirect('/pacientes'); }

    await NotaNutriologo.create({ nota, pacienteId });
    req.flash('success', 'Nota guardada correctamente');
  } catch (error) {
    console.error('Error al guardar nota:', error);
    req.flash('error', 'No se pudo guardar la nota');
  }

  res.redirect(`/pacientes/${pacienteId}`);
};

// Eliminar nota
exports.eliminarNota = async (req, res) => {
  const { id, notaId } = req.params;

  if (!uid(req)) return res.redirect('/login');

  try {
    const p = await Paciente.findOne({ where: { id, usuario_id: uid(req) } });
    if (!p) { req.flash('error', 'Paciente no encontrado'); return res.redirect('/pacientes'); }

    await NotaNutriologo.destroy({ where: { id: notaId, pacienteId: id } });
    req.flash('success', 'Nota eliminada');
  } catch (error) {
    console.error('Error eliminando nota:', error);
    req.flash('error', 'No se pudo eliminar la nota');
  }
  res.redirect(`/pacientes/${id}`);
};
