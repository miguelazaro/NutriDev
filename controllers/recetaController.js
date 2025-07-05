const Receta = require('../models/Receta');

exports.index = async (req, res) => {
    const recetas = await Receta.findAll();
    res.render('recetas', { recetas, active: 'recetas' });
};

exports.nueva = (req, res) => {
    res.render('recetas_form', { receta: null, active: 'recetas' });
};

exports.guardar = async (req, res) => {
    try {
        const { titulo, descripcion, ingredientes, calorias, categoria, preparacion } = req.body;
        const imagen = req.file ? req.file.filename : null;

        await Receta.create({
            titulo,
            descripcion,
            ingredientes,
            calorias,
            categoria,
            preparacion,
            imagen,
            usuario_id: req.session.userId // ajusta esto a tu sistema de auth
        });

        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al guardar receta:', error);
        res.status(500).send('Error del servidor');
    }
};

exports.editar = async (req, res) => {
    const receta = await Receta.findByPk(req.params.id);
    res.render('recetas_form', { receta, active: 'recetas' });
};

exports.actualizar = async (req, res) => {
    try {
        const { titulo, descripcion, ingredientes, calorias, categoria, preparacion } = req.body;
        const { id } = req.params;
        const receta = await Receta.findByPk(id);

        if (!receta) return res.status(404).send('Receta no encontrada');

        if (req.file) {
            receta.imagen = req.file.filename;
        }

        receta.titulo = titulo;
        receta.descripcion = descripcion;
        receta.ingredientes = ingredientes;
        receta.calorias = calorias;
        receta.categoria = categoria;
        receta.preparacion = preparacion;

        await receta.save();
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al actualizar receta:', error);
        res.status(500).send('Error del servidor');
    }
};


exports.eliminar = async (req, res) => {
    await Receta.destroy({ where: { id: req.params.id } });
    res.redirect('/recetas');
};


function calcularCalorias(ingredientes) {
    return ingredientes.reduce((total, ing) => total + ing.calorias, 0);
}
module.exports = { calcularCalorias };


