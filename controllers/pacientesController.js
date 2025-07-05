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
    const { nombre, edad, historial } = req.body;
    await Paciente.create({ nombre, edad, historial });
    res.redirect('/pacientes');
};

// Formulario editar
exports.editar = async (req, res) => {
    const paciente = await Paciente.findByPk(req.params.id);
    res.render('pacientes_form', { paciente });
};

// Actualizar paciente
exports.actualizar = async (req, res) => {
    const { nombre, edad, historial } = req.body;
    await Paciente.update({ nombre, edad, historial }, {
        where: { id: req.params.id }
    });
    res.redirect('/pacientes');
};

// Eliminar
exports.eliminar = async (req, res) => {
    await Paciente.destroy({ where: { id: req.params.id } });
    res.redirect('/pacientes');
};
