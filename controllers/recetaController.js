const axios = require('axios');
const { Op } = require('sequelize');
const Receta = require('../models/Receta');
const { translate } = require('@vitalets/google-translate-api');


async function traducir(texto) {
    try {
        if (!texto || typeof texto !== 'string') return '';
        const { text } = await translate(texto, { to: 'es' });
        return text;
    } catch (error) {
        console.error('Error de traducción:', error);
        return texto;
    }
}


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
            id: r.id,
            titulo: r.titulo,
            categoria: r.categoria || 'Personalizada',
            origen: r.origen || 'Usuario',
            imagen: r.imagen ? `/uploads/${r.imagen}` : '/img/default.png',
            usuarioId: r.usuario_id
        }));

        const recetasAPIFormateadas = recetasAPI.map(r => ({
            strMeal: r.strMeal,
            strCategory: r.strCategory,
            strArea: r.strArea,
            strMealThumb: r.strMealThumb,
            idMeal: r.idMeal,
        }));

        const recetas = [...recetasLocalesFormateadas, ...recetasAPIFormateadas];

        res.render('recetas', {
            recetas,
            busqueda,
            active: 'recetas',
            usuario: req.user || null
        });

    } catch (error) {
        console.error('Error al obtener recetas:', error.message);
        res.status(500).send('Error al mostrar recetas');
    }
};


const detalleApi = async (req, res) => {
    const id = req.params.idMeal;
    try {
        const respuesta = await axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
        const recetaAPI = respuesta.data.meals ? respuesta.data.meals[0] : null;

        if (!recetaAPI) return res.status(404).send('Receta no encontrada');

        // Traducir campos importantes
        const [instruccionesTraducidas, tituloTraducido, categoriaTraducida, areaTraducida] = await Promise.all([
            traducir(recetaAPI.strInstructions),
            traducir(recetaAPI.strMeal),
            traducir(recetaAPI.strCategory),
            traducir(recetaAPI.strArea)
        ]);

        // Normalizar la receta con las traducciones
        const receta = {
            strMeal: tituloTraducido,
            strCategory: categoriaTraducida,
            strArea: areaTraducida,
            strMealThumb: recetaAPI.strMealThumb,
            strInstructions: instruccionesTraducidas,
            strTags: recetaAPI.strTags,
            strYoutube: recetaAPI.strYoutube,
            idMeal: recetaAPI.idMeal
        };

        // Traducir ingredientes
        for (let i = 1; i <= 20; i++) {
            const ingrediente = recetaAPI[`strIngredient${i}`];
            const medida = recetaAPI[`strMeasure${i}`];
            
            if (ingrediente && ingrediente.trim() !== '') {
                const ingredienteTraducido = await traducir(ingrediente);
                receta[`strIngredient${i}`] = ingredienteTraducido;
                receta[`strMeasure${i}`] = medida;
            } else {
                receta[`strIngredient${i}`] = '';
                receta[`strMeasure${i}`] = '';
            }
        }

        res.render('receta_detalle_api', { 
            receta,
            active: 'recetas' 
        });
    } catch (error) {
        console.error('Error al obtener receta externa:', error.message);
        res.status(500).send('Error al mostrar receta externa');
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

    if (receta.usuario_id !== req.session.userId) {
        return res.status(403).send('No autorizado');
    }

    res.render('recetas_form', { receta, active: 'recetas' });
};

const actualizar = async (req, res) => {
    try {
        const { titulo, descripcion, ingredientes, calorias, categoria, preparacion } = req.body;
        const receta = await Receta.findByPk(req.params.id);
        if (!receta) return res.status(404).send('Receta no encontrada');

        if (receta.usuario_id !== req.session.userId) {
            return res.status(403).send('No autorizado');
        }

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
        const receta = await Receta.findByPk(req.params.id);
        if (!receta) return res.status(404).send('Receta no encontrada');

        if (receta.usuario_id !== req.session.userId) {
            return res.status(403).send('No autorizado');
        }

        await receta.destroy();
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
    eliminar,
    detalleApi
};