const axios = require('axios');
const { Op } = require('sequelize');
const Receta = require('../models/Receta');

// Mostrar recetas personalizadas + API externa)
const index = async (req, res) => {
    const busqueda = req.query.q || '';

    try {
        
        const recetasLocales = await Receta.findAll({
            where: {
                titulo: { [Op.like]: `%${busqueda}%` }
            }
        });

        
        const respuesta = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${busqueda}`);
        const recetasAPI = respuesta.data.meals || [];

        
        const recetasLocalesFormateadas = recetasLocales.map(r => ({
            strMeal: r.titulo,
            strCategory: r.categoria || 'Personalizada',
            strArea: 'Usuario',
            strMealThumb: r.imagen ? `/uploads/${r.imagen}` : '/img/default.png',
            strSource: null,
            strYoutube: null
        }));

        
        const recetasAPIFormateadas = recetasAPI.map(r => ({
            strMeal: r.strMeal,
            strCategory: r.strCategory,
            strArea: r.strArea,
            strMealThumb: r.strMealThumb,
            strSource: r.strSource,
            strYoutube: r.strYoutube
        }));

        const recetas = [...recetasLocalesFormateadas, ...recetasAPIFormateadas];

        res.render('recetas', {
            recetas,
            active: 'recetas',
            busqueda
        });

    } catch (error) {
        console.error('Error al obtener recetas:', error.message);
        res.status(500).send('Error al mostrar recetas');
    }
};


const nueva = (req, res) => {
    res.render('recetas_form', { receta: null, active: 'recetas' });
};


const guardar = async (req, res) => {
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
            usuario_id: req.session.userId 
        });

        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al guardar receta:', error);
        res.status(500).send('Error del servidor');
    }
};


const editar = async (req, res) => {
    const receta = await Receta.findByPk(req.params.id);
    if (!receta) return res.status(404).send('Receta no encontrada');
    res.render('recetas_form', { receta, active: 'recetas' });
};


const actualizar = async (req, res) => {
    try {
        const { titulo, descripcion, ingredientes, calorias, categoria, preparacion } = req.body;
        const receta = await Receta.findByPk(req.params.id);
        if (!receta) return res.status(404).send('Receta no encontrada');

        receta.titulo = titulo;
        receta.descripcion = descripcion;
        receta.ingredientes = ingredientes;
        receta.calorias = calorias;
        receta.categoria = categoria;
        receta.preparacion = preparacion;

        if (req.file) {
            receta.imagen = req.file.filename;
        }

        await receta.save();
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al actualizar receta:', error);
        res.status(500).send('Error del servidor');
    }
};


const eliminar = async (req, res) => {
    try {
        await Receta.destroy({ where: { id: req.params.id } });
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al eliminar receta:', error);
        res.status(500).send('Error del servidor');
    }
};

module.exports = {
    index,
    nueva,
    guardar,
    editar,
    actualizar,
    eliminar
};
