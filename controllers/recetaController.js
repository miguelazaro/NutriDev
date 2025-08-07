const { Op } = require('sequelize');
const axios = require('axios');
const Receta = require('../models/Receta');
const { traducirTexto } = require('../utils/traductor');

const APP_ID = process.env.EDAMAM_APP_ID;
const APP_KEY = process.env.EDAMAM_APP_KEY;

// --- INDEX ---
const index = async (req, res) => {
    const busqueda = req.query.q || null;
    const esBusquedaExplicita = req.query.q !== undefined;
    const user = req.session.usuario || {};

    try {
        const whereLocal = { archivada: false };
        if (user.rol !== 'admin') {
            if (!user.id) {
                // Si no hay ID de usuario, no se buscan recetas locales para él.
                // Se mostrarán solo las de la API.
            } else {
                whereLocal.usuario_id = user.id;
            }
        }
        if (busqueda) {
            whereLocal.titulo = { [Op.like]: `%${busqueda}%` };
        }

        const recetasLocales = whereLocal.usuario_id || user.rol === 'admin' 
            ? await Receta.findAll({ where: whereLocal, order: [['id', 'DESC']] })
            : [];

        const recetasLocalesFormateadas = recetasLocales.map(r => ({
            id: r.id,
            titulo: r.titulo,
            categoria: r.categoria || 'Personalizada',
            imagen: r.imagen ? `/uploads/${r.imagen}` : null,
            usuario_id: r.usuario_id,
            origen: 'local'
        }));

        let recetasAPI = [];
        let mostrarSugerencias = !esBusquedaExplicita;

        if (mostrarSugerencias || busqueda) {
            try {
                const sugerencias = ['recetas saludables', 'ensaladas', 'comida mexicana saludable', 'dieta baja en carbohidratos', 'alto en proteína', 'vegetariano fácil', 'postres saludables'];
                const terminoBusquedaAPI = busqueda || sugerencias[Math.floor(Math.random() * sugerencias.length)];
                const url = `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(terminoBusquedaAPI)}&app_id=${APP_ID}&app_key=${APP_KEY}`;
                const response = await axios.get(url);

                recetasAPI = response.data.hits.map((hit, index) => {
                    const id = encodeURIComponent(hit.recipe.uri);
                    const calorias = Math.round(hit.recipe.calories / hit.recipe.yield);
                    const esRecomendacion = index < 2 || calorias < 400 || Math.random() < 0.3;
                    return {
                        id,
                        titulo: hit.recipe.label,
                        categoria: hit.recipe.mealType?.[0] || 'Externa',
                        imagen: hit.recipe.image,
                        origen: 'api',
                        dataAPI: JSON.stringify(hit.recipe),
                        esRecomendacion,
                        calorias,
                        etiquetas: hit.recipe.dietLabels?.join(', ') || ''
                    };
                });
                req.session.recetasAPI = recetasAPI;
            } catch (apiError) {
                console.error('Error al contactar la API de Edamam:', apiError.message);
                req.flash('error', 'No se pudieron cargar recetas externas.');
            }
        }

        const recetasFinales = [...recetasLocalesFormateadas, ...recetasAPI];
        res.render('recetas', { layout: 'layouts/sistema', recetas: recetasFinales, busqueda, mostrarSugerencias, active: 'recetas', user, messages: req.flash() });
    } catch (error) {
        console.error('Error general:', error.message);
        req.flash('error', 'Hubo un problema al cargar tus recetas.');
        res.render('recetas', { layout: 'layouts/sistema', recetas: [], busqueda, active: 'recetas', user, messages: req.flash() });
    }
};

// --- VER RECETA ---
const ver = async (req, res) => {
    const { tipo, id } = req.params;
    const user = req.session.usuario || {};

    try {
        if (tipo === 'local') {
            const receta = await Receta.findByPk(id);
            if (!receta) return res.status(404).send('Receta no encontrada');

            const formatearImagen = (imagen) => {
                if (!imagen) return null;
                if (imagen.startsWith('http')) return imagen;
                return `/uploads/${imagen}`;
            };

            const recetaFormateada = {
                ...receta.dataValues,
                imagen: formatearImagen(receta.imagen),
                tiempo: receta.tiempo_preparacion || 'N/A',
                tamanoPorcion: receta.tamano_porcion || 'N/A',
                etiquetas: receta.etiquetas || 'N/A',
                calorias: receta.calorias || 'N/A',
                porciones: receta.porciones || 'N/A',
                dificultad: receta.dificultad || 'N/A',
                categoria: receta.categoria || 'Sin categoría',
                descripcion: receta.descripcion || 'Sin descripción',
                ingredientes: receta.ingredientes || 'Ingredientes no especificados',
                preparacion: receta.preparacion || 'Preparación no especificada'
            };

            return res.render('recetas_ver', {
                layout: 'layouts/sistema',
                receta: recetaFormateada,
                origen: 'local',
                user,
                messages: req.flash()
            });
        }

        if (tipo === 'api') {
            const recetasCache = req.session.recetasAPI || [];
            const recetaAPI = recetasCache.find(r => r.id === id);
            if (!recetaAPI) return res.status(404).send('Receta no encontrada');

            const data = JSON.parse(recetaAPI.dataAPI);
            const tituloTraducido = await traducirTexto(data.label);
            const categoriaTraducida = await traducirTexto(data.mealType?.[0] || 'Externa');
            
            const ingredientesTraducidos = await Promise.all(
                data.ingredientLines.map(linea => traducirTexto(linea))
            );

            const recetaAPIFormateada = {
                ...recetaAPI,
                titulo: tituloTraducido,
                categoria: categoriaTraducida,
                ingredientes: ingredientesTraducidos.join('\n'), // Mantenemos la versión string por si acaso
                preparacion: 'Preparación detallada no disponible desde la API. Ver instrucciones en el sitio original.',
                tiempo: data.totalTime ? `${data.totalTime} minutos` : 'N/A',
                tamanoPorcion: data.calories && data.yield ? `${Math.round(data.calories / data.yield)} cal c/u` : 'N/A',
                etiquetas: data.dietLabels?.join(', ') || 'Ninguna',
                calorias: Math.round(data.calories) || 'N/A',
                porciones: data.yield || 'N/A',
                dificultad: 'Fácil',
                imagen: data.image,
                descripcion: `Receta importada desde ${data.source || 'fuente externa'}.`,
                urlOriginal: data.url || null,
                ingredientesTraducidos: ingredientesTraducidos, // Esta es la propiedad clave
                dataAPI: recetaAPI.dataAPI
            };

            return res.render('recetas_ver', {
                layout: 'layouts/sistema',
                receta: recetaAPIFormateada,
                origen: 'api',
                user,
                puedeImportar: user.id !== undefined,
                messages: req.flash()
            });
        }

        res.status(400).send('Tipo inválido');
    } catch (error) {
        console.error('Error al ver receta:', error.message);
        req.flash('error', 'Error al cargar la receta');
        res.status(500).redirect('/recetas');
    }
};


// --- IMPORTAR ---
const importarDesdeAPI = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO

    // Verificación de seguridad: el usuario debe estar logueado para importar.
    if (!user.id) {
        req.flash('error', 'Debes iniciar sesión para importar recetas.');
        // Es mejor redirigir al login si no hay sesión.
        return res.redirect('/login'); 
    }

    try {
        const { titulo, categoria, dataAPI } = req.body;
        const recetaData = JSON.parse(dataAPI);

        const procesarImagenImportar = (url) => {
            if (!url) return null;
            try {
                if (url.includes('edamam-product-images')) {
                    const cleanUrl = url.split('?')[0];
                    return cleanUrl.startsWith('http') ? cleanUrl : `https:${cleanUrl}`;
                }
                new URL(url);
                return url;
            } catch (e) {
                console.error('URL de imagen no válida al importar:', url);
                return null;
            }
        };

        const descripcion = `Receta importada automáticamente. Contiene ${Math.round(recetaData.calories)} calorías en total y rinde aproximadamente ${recetaData.yield || 'N/A'} porciones.`;
        const ingredientes = recetaData.ingredientLines?.join('\n') || '';
        const calorias = Math.round(recetaData.calories || 0);
        const porciones = recetaData.yield || null;
        const tiempoPreparacion = recetaData.totalTime ? `${recetaData.totalTime} minutos` : null;
        
        const etiquetas = [...(recetaData.dietLabels || []), ...(recetaData.healthLabels || [])]
            .filter((value, index, self) => self.indexOf(value) === index)
            .join(', ') || null;
            
        const dificultad = 'Fácil';
        const tamanoPorcion = porciones ? `${Math.round(calorias / porciones)} cal c/u` : null;
        const imagen = procesarImagenImportar(recetaData.image?.trim());

        await Receta.create({
            titulo,
            categoria,
            descripcion,
            ingredientes,
            preparacion: 'Pasos de preparación no disponibles desde la API. Añadir manualmente.',
            calorias,
            porciones,
            tiempo_preparacion: tiempoPreparacion,
            etiquetas,
            dificultad,
            tamano_porcion: tamanoPorcion,
            imagen,
            equivalentes_simplificados: false,
            equivalentes_smae: false,
            usuario_id: user.id, // CORRECTO: Usamos el id del objeto user
            archivada: false
        });

        req.flash('success', 'Receta importada y guardada en tu recetario.');
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al importar receta desde API:', error);
        req.flash('error', 'No se pudo importar la receta. Verifica los datos e intenta nuevamente.');
        res.redirect('/recetas');
    }
};


// --- RESTO DE FUNCIONES ---
const papelera = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO

    try {
        const busquedaNombre = req.query.q || '';
        const busquedaCategoria = req.query.categoria || '';
        const busquedaEtiqueta = req.query.etiqueta || '';

        const where = { archivada: true };
        
        // Se asegura de que solo los usuarios logueados vean su propia papelera
        if (user.rol !== 'admin') {
            if (!user.id) {
                // Si no hay un usuario en sesión, no puede ver ninguna receta archivada.
                // Se le mostrará una papelera vacía.
                return res.render('papelera', {
                    layout: 'layouts/sistema',
                    recetas: [],
                    categorias: [],
                    etiquetas: [],
                    busquedaNombre: '',
                    busquedaCategoria: '',
                    busquedaEtiqueta: '',
                    user,
                    messages: req.flash()
                });
            }
            where.usuario_id = user.id; // CORRECTO
        }

        if (busquedaNombre) where.titulo = { [Op.like]: `%${busquedaNombre}%` };
        if (busquedaCategoria) where.categoria = busquedaCategoria;
        if (busquedaEtiqueta) where.etiquetas = { [Op.like]: `%${busquedaEtiqueta}%` };

        const recetasBD = await Receta.findAll({ where });
        const recetas = recetasBD.map(r => ({
            ...r.dataValues,
            imagen: r.imagen ? `/uploads/${r.imagen}` : null
        }));

        const categoriasRaw = await Receta.aggregate('categoria', 'DISTINCT', { plain: false });
        const etiquetasRaw = await Receta.aggregate('etiquetas', 'DISTINCT', { plain: false });

        const categorias = categoriasRaw.map(c => c.DISTINCT).filter(Boolean);
        const etiquetas = etiquetasRaw.map(e => e.DISTINCT).filter(Boolean);

        res.render('papelera', {
            layout: 'layouts/sistema',
            recetas,
            categorias,
            etiquetas,
            busquedaNombre,
            busquedaCategoria,
            busquedaEtiqueta,
            user,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error al cargar la papelera:', error);
        res.status(500).send('Error interno al cargar la papelera');
    }
};

const archivar = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== user.id && user.rol !== 'admin')) { // CORRECTO
            return res.status(403).send('No autorizado');
        }
        receta.archivada = true;
        await receta.save();
        req.flash('success', 'Receta archivada correctamente.');
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al archivar receta:', error);
        req.flash('error', 'No se pudo archivar la receta.');
        res.redirect('/recetas');
    }
};

const nueva = (req, res) => {
    res.render('recetas_form', { layout: 'layouts/sistema', receta: null, active: 'recetas', messages: req.flash() });
};

const guardar = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO
    if (!user.id) {
        req.flash('error', 'Debes iniciar sesión para guardar recetas.');
        return res.redirect('/login');
    }
    try {
        const { titulo, ingredientes, preparacion, categoria, ...otrosDatos } = req.body;
        if (!titulo || !ingredientes || !preparacion || !categoria) {
            req.flash('error', 'Los campos marcados con * son obligatorios');
            return res.redirect('/recetas/nueva');
        }
        await Receta.create({
            ...otrosDatos,
            titulo, ingredientes, preparacion, categoria,
            imagen: req.file ? req.file.filename : null,
            usuario_id: user.id, // CORRECTO
            archivada: false
        });
        req.flash('success', 'Receta creada exitosamente.');
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al guardar receta:', error);
        req.flash('error', 'No se pudo crear la receta.');
        res.redirect('/recetas/nueva');
    }
};

const editar = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO
    const receta = await Receta.findByPk(req.params.id);
    if (!receta || (receta.usuario_id !== user.id && user.rol !== 'admin')) { // CORRECTO
        return res.status(403).send('No autorizado');
    }
    res.render('recetas_form', { layout: 'layouts/sistema', receta, active: 'recetas', messages: req.flash() });
};

const actualizar = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== user.id && user.rol !== 'admin')) { // CORRECTO
            return res.status(403).send('No autorizado');
        }
        // ...lógica para actualizar
        await receta.save(req.body);
        req.flash('success', 'Receta actualizada correctamente.');
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al actualizar receta:', error);
        req.flash('error', 'No se pudo actualizar la receta.');
        res.redirect(`/recetas/editar/${req.params.id}`);
    }
};

const eliminar = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== user.id && user.rol !== 'admin')) { // CORRECTO
            return res.status(403).send('No autorizado');
        }
        await receta.destroy();
        req.flash('success', 'Receta eliminada permanentemente.');
        res.redirect('/recetas/papelera');
    } catch (error) {
        console.error('Error al eliminar receta:', error);
        req.flash('error', 'No se pudo eliminar la receta.');
        res.redirect('/recetas/papelera');
    }
};

const restaurar = async (req, res) => {
    const user = req.session.usuario || {}; // CORRECTO
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== user.id && user.rol !== 'admin')) { // CORRECTO
            return res.status(403).send('No autorizado');
        }
        receta.archivada = false;
        await receta.save();
        req.flash('success', 'Receta restaurada correctamente.');
        res.redirect('/recetas/papelera');
    } catch (error) {
        console.error('Error al restaurar receta:', error);
        req.flash('error', 'No se pudo restaurar la receta.');
        res.redirect('/recetas/papelera');
    }
};

module.exports = {
    index, ver, importarDesdeAPI, papelera, archivar, nueva, guardar, editar, actualizar, eliminar, restaurar
};
