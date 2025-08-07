const { Paciente, Progreso, NotaNutriologo, ArchivoPaciente } = require('../models/associations');
// Distribución por edades
function calcularDistribucionEdades(pacientes) {
    const hoy = new Date();
    const grupos = {
        '0-18': 0,
        '19-30': 0,
        '31-45': 0,
        '46-60': 0,
        '60+': 0
    };

    pacientes.forEach(p => {
        if (p.fecha_nacimiento) {
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
            } catch (error) {
                console.error(`Error calculando edad para paciente ${p.id}:`, error);
            }
        }
    });

    return grupos;
}

// Contar nuevos del mes
function contarNuevosEsteMes(pacientes) {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    return pacientes.filter(p => {
        if (!p.fecha_registro) return false;

        try {
            const registro = new Date(p.fecha_registro);
            if (isNaN(registro.getTime())) return false;
            return registro.getMonth() === mesActual && registro.getFullYear() === añoActual;
        } catch (error) {
            console.error(`Error procesando fecha_registro para paciente ${p.id}:`, error);
            return false;
        }
    }).length;
}

// Vista principal
exports.index = async (req, res) => {
    try {
        const pacientes = await Paciente.findAll();

        const distribucionEdades = calcularDistribucionEdades(pacientes);
        const nuevosEsteMes = contarNuevosEsteMes(pacientes);

        res.render('pacientes', {
            pacientes,
            distribucionEdades,
            nuevosEsteMes
        });
    } catch (error) {
        console.error('Error en index:', error);
        res.status(500).send('Error al cargar los pacientes');
    }
};

// Formulario nuevo
exports.form = (req, res) => {
    res.render('../views/pacientes/create.ejs');
};

// Nuevo paciente
exports.guardar = async (req, res) => {
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
            preferencias
        });

        res.redirect('/pacientes');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al guardar paciente');
    }
};


// Formulario editar
exports.editar = async (req, res) => {
    try {
        const paciente = await Paciente.findByPk(req.params.id);
        if (!paciente) return res.status(404).send('Paciente no encontrado');
        res.render('pacientes/edit', { paciente });
    } catch (error) {
        console.error('Error en editar:', error);
        res.status(500).send('Error al cargar el formulario de edición');
    }
};

// Actualizar paciente
exports.actualizar = async (req, res) => {
    try {
        const {
            nombre, genero, fecha_nacimiento, pais_residencia, telefono,
            enviar_cuestionario, email, historial,
            estatura, actividad, objetivo, comidas_dia, preferencias
        } = req.body;

        const paciente = await Paciente.findByPk(req.params.id);
        if (!paciente) return res.status(404).send('Paciente no encontrado');

        const foto = req.files?.foto?.[0]?.filename || paciente.foto;
        const archivo = req.files?.archivo?.[0]?.filename || paciente.archivo;

        await paciente.update({
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
            preferencias
        });

        res.redirect('/pacientes');
    } catch (error) {
        console.error('Error en actualizar:', error);
        res.status(500).send('Error al actualizar el paciente');
    }
};

// Eliminar paciente
exports.eliminar = async (req, res) => {
    try {
        await Paciente.destroy({ where: { id: req.params.id } });
        res.redirect('/pacientes');
    } catch (error) {
        console.error('Error en eliminar:', error);
        res.status(500).send('Error al eliminar el paciente');
    }
};

// Vista detalle
exports.detalle = async (req, res) => {
    try {
        const paciente = await Paciente.findByPk(req.params.id, {
            include: [
                { model: ArchivoPaciente },
                { model: Progreso, as: 'Progresos' },
                { model: NotaNutriologo, as: 'NotaNutriologos' }
            ],
            order: [
                [{ model: Progreso, as: 'Progresos' }, 'fecha', 'ASC']
            ]
        });

        if (!paciente) {
            req.flash('error', 'Paciente no encontrado');
            return res.redirect('/pacientes');
        }

        res.render('pacientes/detalle', {
            paciente: paciente.get({ plain: true })
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

    if (!file) {
        req.flash('error', 'No se subió ningún archivo');
        return res.redirect(`/pacientes/${pacienteId}`);
    }

    try {
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

//Guardar progreso
exports.guardarProgreso = async (req, res) => {
    const { peso, fecha, observaciones } = req.body;
    const pacienteId = req.params.id;

    try {
        // Crear el nuevo progreso
        await Progreso.create({ peso, fecha, observaciones, pacienteId });

        // Obtener TODOS los progresos del paciente
        const progresos = await Progreso.findAll({
            where: { pacienteId },
            order: [['fecha', 'ASC']]
        });

        console.log('Progresos del paciente:', progresos);

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

    try {
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
    try {
        await NotaNutriologo.destroy({ where: { id: notaId, pacienteId: id } });
        req.flash('success', 'Nota eliminada');
    } catch (error) {
        console.error('Error eliminando nota:', error);
        req.flash('error', 'No se pudo eliminar la nota');
    }
    res.redirect(`/pacientes/${id}`);
};