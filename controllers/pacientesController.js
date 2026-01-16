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
      // INFO BÁSICA
      nombre,
      genero,
      fecha_nacimiento,
      pais,              // select del formulario
      telefono,
      email,
      ocupacion,

      // MOTIVO DE CONSULTA
      objetivo,
      meta_especifica,
      prioridad_objetivo,

      // INFO MÉDICA
      diabetes,
      hipertension,
      higado_graso,
      gastritis,
      otras_enfermedades,
      diabetes_familiar,
      hipertension_familiar,
      obesidad_familiar,
      cancer_familiar,
      otros_antecedentes,
      alergias,
      medicacion_actual,
      cirugias_previas,

      // MEDICIÓN FÍSICA
      peso,
      estatura,
      porcentaje_grasa,
      circunferencia_cintura,
      presion_arterial,

      // ESTILO DE VIDA
      actividad,
      frecuencia_ejercicio,
      tipo_ejercicio,
      horas_sueno,
      calidad_sueno,
      estres,

      // HÁBITOS ALIMENTICIOS
      comidas_dia,
      preferencia_alimentaria,
      consumo_agua,
      apetito,

      // HISTORIAL
      historial
    } = req.body;

    const foto = req.files?.foto?.[0]?.filename || null;
    const archivo = req.files?.archivo?.[0]?.filename || null;

    console.log('BODY:', req.body);
console.log('FILES:', req.files);


    await Paciente.create({
      // INFO BÁSICA
      nombre,
      genero,
      fecha_nacimiento: fecha_nacimiento || null,
      pais_residencia: pais || 'México',
      telefono,
      email: email?.trim() || null,
      ocupacion: ocupacion || null,

      // MOTIVO DE CONSULTA
      objetivo,
      meta_especifica: meta_especifica || null,
      prioridad_objetivo: prioridad_objetivo || null,

      // INFO MÉDICA (checkbox -> boolean)
      diabetes: !!diabetes,
      hipertension: !!hipertension,
      higado_graso: !!higado_graso,
      gastritis: !!gastritis,
      otras_enfermedades: otras_enfermedades || null,
      diabetes_familiar: !!diabetes_familiar,
      hipertension_familiar: !!hipertension_familiar,
      obesidad_familiar: !!obesidad_familiar,
      cancer_familiar: !!cancer_familiar,
      otros_antecedentes: otros_antecedentes || null,
      alergias: alergias || null,
      medicacion_actual: medicacion_actual || null,
      cirugias_previas: cirugias_previas || null,

      // MEDICIÓN FÍSICA
      peso: peso ? Number(peso) : null,
      estatura: estatura ? Number(estatura) : null,
      porcentaje_grasa: porcentaje_grasa ? Number(porcentaje_grasa) : null,
      circunferencia_cintura: circunferencia_cintura ? Number(circunferencia_cintura) : null,
      presion_arterial: presion_arterial || null,

      // ESTILO DE VIDA
      actividad,
      frecuencia_ejercicio: frecuencia_ejercicio || null,
      tipo_ejercicio: tipo_ejercicio || null,
      horas_sueno: horas_sueno ? Number(horas_sueno) : null,
      calidad_sueno: calidad_sueno || null,
      estres: estres || null,

      // HÁBITOS ALIMENTICIOS
      comidas_dia: comidas_dia ? Number(comidas_dia) : null,
      preferencia_alimentaria: preferencia_alimentaria || null,
      consumo_agua: consumo_agua ? Number(consumo_agua) : null,
      apetito: apetito || null,

      // HISTORIAL
      historial: historial || null,

      // ARCHIVOS Y USER
      foto,
      archivo,
      estatura: estatura ? parseInt(estatura) : null,
      actividad,
      objetivo,
      comidas_dia: comidas_dia ? parseInt(comidas_dia) : null,
      preferencias,
      enviar_cuestionario: 0, // ya no tienes checkbox, lo dejamos en 0
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
      // INFO BÁSICA
      nombre,
      genero,
      fecha_nacimiento,
      pais,
      telefono,
      email,
      ocupacion,

      // MOTIVO DE CONSULTA
      objetivo,
      meta_especifica,
      prioridad_objetivo,

      // INFO MÉDICA
      diabetes,
      hipertension,
      higado_graso,
      gastritis,
      otras_enfermedades,
      diabetes_familiar,
      hipertension_familiar,
      obesidad_familiar,
      cancer_familiar,
      otros_antecedentes,
      alergias,
      medicacion_actual,
      cirugias_previas,

      // MEDICIÓN FÍSICA
      peso,
      estatura,
      porcentaje_grasa,
      circunferencia_cintura,
      presion_arterial,

      // ESTILO DE VIDA
      actividad,
      frecuencia_ejercicio,
      tipo_ejercicio,
      horas_sueno,
      calidad_sueno,
      estres,

      // HÁBITOS ALIMENTICIOS
      comidas_dia,
      preferencia_alimentaria,
      consumo_agua,
      apetito,

      // HISTORIAL + checkbox antiguo
      historial,
      enviar_anamnesis
    } = req.body;

    const foto = req.files?.foto?.[0]?.filename || paciente.foto;
    const archivo = req.files?.archivo?.[0]?.filename || paciente.archivo;

    await paciente.update({
      // INFO BÁSICA
      nombre,
      genero,
      fecha_nacimiento: fecha_nacimiento || null,
      pais_residencia: pais || 'México',
      telefono,
      email: email?.trim() || null,
      ocupacion: ocupacion || null,

      // MOTIVO DE CONSULTA
      objetivo,
      meta_especifica: meta_especifica || null,
      prioridad_objetivo: prioridad_objetivo || null,

      // INFO MÉDICA
      diabetes: !!diabetes,
      hipertension: !!hipertension,
      higado_graso: !!higado_graso,
      gastritis: !!gastritis,
      otras_enfermedades: otras_enfermedades || null,
      diabetes_familiar: !!diabetes_familiar,
      hipertension_familiar: !!hipertension_familiar,
      obesidad_familiar: !!obesidad_familiar,
      cancer_familiar: !!cancer_familiar,
      otros_antecedentes: otros_antecedentes || null,
      alergias: alergias || null,
      medicacion_actual: medicacion_actual || null,
      cirugias_previas: cirugias_previas || null,

      // MEDICIÓN FÍSICA
      peso: peso ? Number(peso) : null,
      estatura: estatura ? Number(estatura) : null,
      porcentaje_grasa: porcentaje_grasa ? Number(porcentaje_grasa) : null,
      circunferencia_cintura: circunferencia_cintura ? Number(circunferencia_cintura) : null,
      presion_arterial: presion_arterial || null,

      // ESTILO DE VIDA
      actividad,
      frecuencia_ejercicio: frecuencia_ejercicio || null,
      tipo_ejercicio: tipo_ejercicio || null,
      horas_sueno: horas_sueno ? Number(horas_sueno) : null,
      calidad_sueno: calidad_sueno || null,
      estres: estres || null,

      // HÁBITOS ALIMENTICIOS
      comidas_dia: comidas_dia ? Number(comidas_dia) : null,
      preferencia_alimentaria: preferencia_alimentaria || null,
      consumo_agua: consumo_agua ? Number(consumo_agua) : null,
      apetito: apetito || null,

      // HISTORIAL
      historial,
      enviar_cuestionario: enviar_anamnesis === '1' ? 1 : 0,

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

      // ---------- Cálculo de edad ----------
      function calcularEdad(fecha) {
        if (!fecha) return null;
        const nac = new Date(fecha);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nac.getFullYear();
        const m = hoy.getMonth() - nac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
        return edad;
      }

      const edad = calcularEdad(paciente.fecha_nacimiento);

      // ---------- Cálculo de TMB ----------
      let TMB = null;

      if (paciente.peso && paciente.estatura && edad) {
        if (paciente.genero === 'Masculino') {
          TMB = 88.362 + (13.397 * paciente.peso) + (4.799 * paciente.estatura) - (5.677 * edad);
        } else if (paciente.genero === 'Femenino') {
          TMB = 447.593 + (9.247 * paciente.peso) + (3.098 * paciente.estatura) - (4.330 * edad);
        }
      }

      // ---------- Cálculo TDEE ----------
      let factorActividad = {
        sedentario: 1.2,
        ligero: 1.375,
        moderado: 1.55,
        intenso: 1.725,
        muy_intenso: 1.9
      }[paciente.actividad] || 1.2;

      let TDEE = TMB ? TMB * factorActividad : null;

      // Calorías objetivo según meta
      let caloriasObjetivo = null;
      if (TDEE) {
          if (paciente.objetivo === 'bajar_peso') caloriasObjetivo = TDEE - 450;
          else if (paciente.objetivo === 'ganar_musculo') caloriasObjetivo = TDEE + 300;
          else caloriasObjetivo = TDEE; // mantener peso
      }

      // Enviar a la vista
      res.render('pacientes/detalle', {
        paciente: paciente.get({ plain: true }),
        edad,
        TMB: TMB ? Math.round(TMB) : null,
        TDEE: TDEE ? Math.round(TDEE) : null,
        caloriasObjetivo: caloriasObjetivo ? Math.round(caloriasObjetivo) : null
      });
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
