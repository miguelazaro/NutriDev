const express = require('express');
const router = express.Router();
const Receta = require('../models/Receta');
const upload = require('../middlewares/upload'); 

// Mostrar listado de recetas
router.get('/', async (req, res) => {
    try {
        const recetas = await Receta.findAll();
        res.render('recetas', { recetas, active: 'recetas' });
    } catch (error) {
        console.error('Error al cargar recetas:', error);
        res.status(500).send('Error al cargar las recetas');
    }
});

// Formulario para nueva receta
router.get('/nueva', (req, res) => {
    res.render('recetas_form', { receta: null, active: 'recetas' });
});

// Guardar receta nueva
router.post('/guardar', upload.single('imagen'), async (req, res) => {
    try {
        const {
            titulo,
            descripcion,
            ingredientes,
            calorias,
            categoria,
            preparacion
        } = req.body;

        const imagen = req.file ? req.file.filename : null;

        await Receta.create({
            titulo,
            descripcion,
            ingredientes,
            calorias: calorias ? parseInt(calorias) : null,
            categoria,
            preparacion,
            imagen,
            usuario_id: 1 // Temporal
        });

        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al guardar receta:', error);
        res.status(500).send('Error al guardar la receta');
    }
});

// Formulario para editar receta
router.get('/editar/:id', async (req, res) => {
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta) return res.status(404).send('Receta no encontrada');
        res.render('recetas_form', { receta, active: 'recetas' });
    } catch (error) {
        console.error('Error al cargar receta:', error);
        res.status(500).send('Error al cargar la receta');
    }
});

// Actualizar receta existente
router.post('/actualizar/:id', upload.single('imagen'), async (req, res) => {
    try {
        const {
            titulo,
            descripcion,
            ingredientes,
            calorias,
            categoria,
            preparacion
        } = req.body;

        const receta = await Receta.findByPk(req.params.id);
        if (!receta) return res.status(404).send('Receta no encontrada');

        receta.titulo = titulo;
        receta.descripcion = descripcion;
        receta.ingredientes = ingredientes;
        receta.calorias = calorias ? parseInt(calorias) : null;
        receta.categoria = categoria;
        receta.preparacion = preparacion;

        if (req.file) {
            receta.imagen = req.file.filename;
        }

        await receta.save();
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al actualizar receta:', error);
        res.status(500).send('Error al actualizar la receta');
    }
});

// Eliminar receta
router.post('/eliminar/:id', async (req, res) => {
    try {
        await Receta.destroy({ where: { id: req.params.id } });
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al eliminar receta:', error);
        res.status(500).send('Error al eliminar la receta');
    }
});

module.exports = router;
