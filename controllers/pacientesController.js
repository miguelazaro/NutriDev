const Paciente = require('../models/Paciente');

// Mostrar lista de pacientes
exports.index = async (req, res) => {
    const pacientes = await Paciente.findAll();
    res.render('pacientes', { pacientes });
};

// Formulario nuevo paciente
exports.form = (req, res) => {
    res.render('pacientes_form', { paciente: null });
};

// Guardar paciente nuevo
exports.guardar = async (req, res) => {
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
};

// Formulario editar
exports.editar = async (req, res) => {
    const paciente = await Paciente.findByPk(req.params.id);
    res.render('pacientes_form', { paciente });
};

// Actualizar paciente
exports.actualizar = async (req, res) => {
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
};

// Eliminar
exports.eliminar = async (req, res) => {
    await Paciente.destroy({ where: { id: req.params.id } });
    res.redirect('/pacientes');
};