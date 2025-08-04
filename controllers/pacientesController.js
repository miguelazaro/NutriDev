const Paciente = require('../models/Paciente');
const ArchivoPaciente = require('../models/ArchivoPaciente');
const Progreso = require('../models/Progreso');

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
                // Verificar si la fecha es válida
                if (isNaN(nacimiento.getTime())) {
                    return;
                }

                let edad = hoy.getFullYear() - nacimiento.getFullYear();
                const mes = hoy.getMonth() - nacimiento.getMonth();

                if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
                    edad--;
                }

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

function contarNuevosEsteMes(pacientes) {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    return pacientes.filter(p => {
        if (!p.fecha_registro) return false;

        try {
            const registro = new Date(p.fecha_registro);
            // Verificar si la fecha es válida
            if (isNaN(registro.getTime())) {
                return false;
            }

            return (
                registro.getMonth() === mesActual &&
                registro.getFullYear() === añoActual
            );
        } catch (error) {
            console.error(`Error procesando fecha_registro para paciente ${p.id}:`, error);
            return false;
        }
    }).length;
}

exports.detalle = async (req, res) => {
    try {
        const paciente = await Paciente.findByPk(req.params.id, {
            include: [ArchivoPaciente, Progreso]
        });

        if (!paciente) {
            req.flash('error', 'Paciente no encontrado');
            return res.redirect('/pacientes');
        }

        res.render('pacientes/detalle', { paciente });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al cargar paciente');
        res.redirect('/pacientes');
    }
};

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
        res.redirect(`/pacientes/${pacienteId}`);
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al guardar el archivo');
        res.redirect(`/pacientes/${pacienteId}`);
    }
};

exports.index = async (req, res) => {
    try {
        const pacientes = await Paciente.findAll();

        // Calcular distribución por edades
        const distribucionEdades = calcularDistribucionEdades(pacientes);

        // Contar nuevos pacientes este mes
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

exports.guardarProgreso = async (req, res) => {
    const { peso, fecha, observaciones } = req.body;
    const pacienteId = req.params.id;

    try {
        await Progreso.create({ peso, fecha, observaciones, pacienteId });
        req.flash('success', 'Progreso registrado correctamente');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al guardar el progreso');
    }

    res.redirect(`/pacientes/${pacienteId}`);
};

// Formulario nuevo paciente
exports.form = (req, res) => {
    res.render('pacientes_form', { paciente: null });
};

// Guardar 
exports.guardar = async (req, res) => {
    try {
        // Recoger todos los campos del formulario
        const {
            nombre,
            genero,
            fecha_nacimiento,
            pais_residencia,
            telefono,
            enviar_cuestionario,
            lugar_consulta,
            ocupacion,
            codigo_postal,
            email,
            historial
        } = req.body;

        // Convertir email vacío a null
        const cleanedEmail = (email && email.trim() === '') ? null : email;

        await Paciente.create({
            nombre,
            genero,
            fecha_nacimiento,
            pais_residencia,
            telefono,
            enviar_cuestionario: enviar_cuestionario === 'on',
            lugar_consulta,
            ocupacion,
            codigo_postal,
            email: cleanedEmail,
            historial
        });

        res.redirect('/pacientes');
    } catch (error) {
        console.error('Error en guardar:', error);
        res.status(500).send('Error al guardar el paciente');
    }
};

// Formulario editar
exports.editar = async (req, res) => {
    try {
        const paciente = await Paciente.findByPk(req.params.id);
        if (!paciente) {
            return res.status(404).send('Paciente no encontrado');
        }
        res.render('pacientes_form', { paciente });
    } catch (error) {
        console.error('Error en editar:', error);
        res.status(500).send('Error al cargar el formulario de edición');
    }
};

// Actualizar 
exports.actualizar = async (req, res) => {
    try {
        // Recoger todos los campos del formulario
        const {
            nombre,
            genero,
            fecha_nacimiento,
            pais_residencia,
            telefono,
            enviar_cuestionario,
            lugar_consulta,
            ocupacion,
            codigo_postal,
            email,
            historial
        } = req.body;

        // Convertir email vacío a null
        const cleanedEmail = (email && email.trim() === '') ? null : email;

        await Paciente.update({
            nombre,
            genero,
            fecha_nacimiento,
            pais_residencia,
            telefono,
            enviar_cuestionario: enviar_cuestionario === 'on',
            lugar_consulta,
            ocupacion,
            codigo_postal,
            email: cleanedEmail,
            historial
        }, {
            where: { id: req.params.id }
        });

        res.redirect('/pacientes');
    } catch (error) {
        console.error('Error en actualizar:', error);
        res.status(500).send('Error al actualizar el paciente');
    }
};

// Eliminar
exports.eliminar = async (req, res) => {
    try {
        await Paciente.destroy({ where: { id: req.params.id } });
        res.redirect('/pacientes');
    } catch (error) {
        console.error('Error en eliminar:', error);
        res.status(500).send('Error al eliminar el paciente');
    }
};