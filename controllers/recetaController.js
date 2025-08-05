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

    const user = {
        id: req.session.userId,
        nombre: req.session.nombreUsuario,
        rol: req.session.rol
    };

    try {
        // 1. Recetas locales desde la base de datos (se mantiene igual)
        const whereLocal = { archivada: false };
        if (user.rol !== 'admin') {
            whereLocal.usuario_id = user.id;
        }
        if (busqueda) {
            whereLocal.titulo = { [Op.like]: `%${busqueda}%` };
        }

        const recetasLocales = await Receta.findAll({
            where: whereLocal,
            order: [['id', 'DESC']]
        });

        const recetasLocalesFormateadas = recetasLocales.map(r => ({
            id: r.id,
            titulo: r.titulo,
            categoria: r.categoria || 'Personalizada',
            imagen: r.imagen ? `/uploads/${r.imagen}` : null,
            usuario_id: r.usuario_id,
            origen: 'local'
        }));

        // 2. Recetas externas desde la API de Edamam
        let recetasAPI = [];
        let mostrarSugerencias = !esBusquedaExplicita;

        if (mostrarSugerencias || busqueda) {
            try {
                const sugerencias = [
                    'recetas saludables',
                    'ensaladas',
                    'comida mexicana saludable',
                    'dieta baja en carbohidratos',
                    'alto en proteína',
                    'vegetariano fácil',
                    'postres saludables'
                ];

                const terminoBusquedaAPI = busqueda || sugerencias[Math.floor(Math.random() * sugerencias.length)];
                const url = `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(terminoBusquedaAPI)}&app_id=${APP_ID}&app_key=${APP_KEY}`;

                const response = await axios.get(url);

                recetasAPI = response.data.hits.map((hit, index) => {
                    const id = encodeURIComponent(hit.recipe.uri);
                    const calorias = Math.round(hit.recipe.calories / hit.recipe.yield);

                    // Criterios para determinar si es recomendación:
                    // 1. Las primeras 2 recetas siempre son recomendadas
                    // 2. Recetas bajas en calorías (< 400 cal por porción)
                    // 3. 30% de probabilidad para las demás
                    const esRecomendacion = index < 2 ||
                        calorias < 400 ||
                        Math.random() < 0.3;

                    return {
                        id,
                        titulo: hit.recipe.label,
                        categoria: hit.recipe.mealType?.[0] || 'Externa',
                        imagen: hit.recipe.image,
                        origen: 'api',
                        dataAPI: JSON.stringify(hit.recipe),
                        esRecomendacion, // Nuevo campo para identificar recomendaciones
                        calorias: calorias,
                        etiquetas: hit.recipe.dietLabels?.join(', ') || ''
                    };
                });

                req.session.recetasAPI = recetasAPI;

            } catch (apiError) {
                console.error('Error al contactar la API de Edamam:', apiError.message);
                req.flash('error', 'No se pudieron cargar recetas externas. Inténtalo más tarde.');
            }
        }

        const recetasFinales = [...recetasLocalesFormateadas, ...recetasAPI];

        res.render('recetas', {
            layout: 'layouts/sistema',
            recetas: recetasFinales,
            busqueda,
            mostrarSugerencias,
            active: 'recetas',
            user,
            messages: req.flash()
        });

    } catch (error) {
        console.error('Error general:', error.message);
        req.flash('error', 'Hubo un problema al cargar tus recetas.');
        res.render('recetas', {
            layout: 'layouts/sistema',
            recetas: [],
            busqueda,
            active: 'recetas',
            user,
            messages: req.flash()
        });
    }
};
// --- VER RECETA ---
const ver = async (req, res) => {
    const { tipo, id } = req.params;
    const user = {
        id: req.session.userId,
        nombre: req.session.nombreUsuario,
        rol: req.session.rol
    };

    try {
        if (tipo === 'local') {
            const receta = await Receta.findByPk(id);
            if (!receta) return res.status(404).send('Receta no encontrada');

            // Función para formatear correctamente la imagen
            const formatearImagen = (imagen) => {
                if (!imagen) return null;
                // Si ya es una URL completa (http o https)
                if (imagen.startsWith('http://') || imagen.startsWith('https://')) {
                    return imagen;
                }
                // Si es un nombre de archivo local
                return `/uploads/${imagen}`;
            };

            // Formatear los datos para la vista
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

            // Diccionario de términos culinarios completos
            const diccionarioCulinario = {
                'tablespoon': 'cucharada',
                'teaspoon': 'cucharadita',
                'cup': 'taza',
                'pound': 'libra',
                'ounce': 'onza',
                'blackening seasoning': 'mezcla de especias para blackening',
                'paprika': 'pimentón',
                'thyme': 'tomillo',
                'oregano': 'orégano',
                'cumin': 'comino',
                'nutmeg': 'nuez moscada',
                'cayenne pepper': 'pimienta de cayena',
                'kosher salt': 'sal kosher',
                'mayonnaise': 'mayonesa',
                'olive oil': 'aceite de oliva',
                'unsalted butter': 'mantequilla sin sal',
                'fresh shrimp': 'camarones frescos',
                'peeled and deveined': 'pelados y desvenados',
                'medium tomato': 'tomate mediano',
                'rough dice': 'cortado en cubos',
                'Romaine lettuce': 'lechuga romana',
                'Italian or Po\' Boy rolls': 'panecillos italianos o tipo Po\' Boy',
                'lemon juice': 'jugo de limón',
                'roasted garlic': 'ajo asado',
                'garlic powder': 'ajo en polvo',
                'fire roasted onion': 'cebolla asada',
                'onion powder': 'cebolla en polvo',
                'dried thyme': 'tomillo seco',
                'dried oregano': 'orégano seco',
                'cumin seeds': 'semillas de comino',
                'ground nutmeg': 'nuez moscada molida'
            };

            // Función para traducir con diccionario prioritario
            const traducirConDiccionario = (texto) => {
                let resultado = texto;
                for (const [en, es] of Object.entries(diccionarioCulinario)) {
                    const regex = new RegExp(`\\b${en}\\b`, 'gi');
                    resultado = resultado.replace(regex, es);
                }
                return resultado;
            };

            // Traducción completa
            const tituloTraducido = await traducirTexto(data.label);
            const categoriaTraducida = await traducirTexto(data.mealType?.[0] || 'Externa');
            
            // Traducción profunda de ingredientes
            const ingredientesTraducidos = await Promise.all(
                data.ingredientLines.map(async linea => {
                    // Primero aplicar diccionario culinario
                    let lineaTraducida = traducirConDiccionario(linea);
                    
                    // Luego traducir el resto con la API
                    lineaTraducida = await traducirTexto(lineaTraducida);
                    
                    // Post-procesamiento para consistencia
                    lineaTraducida = lineaTraducida
                        .replace(/\(recipe below\)/gi, '(receta abajo)')
                        .replace(/\(optional\)/gi, '(opcional)')
                        .replace(/\b(\d+)\s(tazas?)\b/gi, '$1 $2')
                        .replace(/\b(\d+)\s(cucharadas?)\b/gi, '$1 $2')
                        .replace(/\b(\d+)\s(cucharaditas?)\b/gi, '$1 $2');
                    
                    return lineaTraducida;
                })
            );

            // Procesar imagen para la vista
            const procesarImagenVista = (url) => {
                if (!url) return null;
                try {
                    // Si es una URL de Edamam, asegurarse de que tenga el protocolo correcto
                    if (url.includes('edamam-product-images')) {
                        return url.startsWith('http') ? url : `https:${url}`;
                    }
                    return url;
                } catch (e) {
                    console.error('Error procesando imagen:', e);
                    return null;
                }
            };

            // Formatear datos para la vista
            const recetaAPIFormateada = {
                ...recetaAPI,
                titulo: tituloTraducido,
                categoria: categoriaTraducida,
                ingredientes: ingredientesTraducidos.join('\n'),
                preparacion: 'Preparación detallada no disponible desde la API. Ver instrucciones en el sitio original.',
                tiempo: data.totalTime ? `${data.totalTime} minutos` : 'N/A',
                tamanoPorcion: data.calories && data.yield ? 
                    `${Math.round(data.calories / data.yield)} cal c/u` : 'N/A',
                etiquetas: data.dietLabels?.map(etiqueta => {
                    return traducirConDiccionario(etiqueta);
                }).join(', ') || 'Ninguna',
                calorias: Math.round(data.calories) || 'N/A',
                porciones: data.yield || 'N/A',
                dificultad: 'Fácil',
                imagen: procesarImagenVista(data.image),
                descripcion: `Receta importada desde ${data.source || 'fuente externa'}.`,
                urlOriginal: data.url || null,
                ingredientesTraducidos: ingredientesTraducidos,
                dataAPI: recetaAPI.dataAPI // Mantener los datos originales para posible reimportación
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
    try {
        const { titulo, categoria, dataAPI } = req.body;
        const recetaData = JSON.parse(dataAPI);

        // Función mejorada para procesar imágenes al importar
        const procesarImagenImportar = (url) => {
            if (!url) return null;
            try {
                // Si es una URL de Edamam, limpiar parámetros innecesarios
                if (url.includes('edamam-product-images')) {
                    const cleanUrl = url.split('?')[0];
                    return cleanUrl.startsWith('http') ? cleanUrl : `https:${cleanUrl}`;
                }
                // Para otras URLs, validar que sean correctas
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
        
        // Mejor manejo de etiquetas combinando dietLabels y healthLabels
        const etiquetas = [...(recetaData.dietLabels || []), ...(recetaData.healthLabels || [])]
            .filter((value, index, self) => self.indexOf(value) === index) // Eliminar duplicados
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
            usuario_id: req.session.userId,
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
    const user = {
        id: req.session.userId,
        nombre: req.session.nombreUsuario,
        rol: req.session.rol
    };

    try {
        const busquedaNombre = req.query.q || '';
        const busquedaCategoria = req.query.categoria || '';
        const busquedaEtiqueta = req.query.etiqueta || '';

        const where = { archivada: true };
        if (user.rol !== 'admin') where.usuario_id = user.id;
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
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== req.session.userId && req.session.rol !== 'admin')) {
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
    try {
        const { 
            titulo, 
            descripcion, 
            ingredientes, 
            calorias, 
            categoria, 
            preparacion, 
            etiquetas, 
            tiempo_preparacion, 
            dificultad, 
            porciones,
            equivalentes_simplificados, 
            equivalentes_smae 
        } = req.body;

        const imagen = req.file ? req.file.filename : null;

        // Validación de campos requeridos
        if (!titulo || !ingredientes || !preparacion || !categoria) {
            req.flash('error', 'Los campos marcados con * son obligatorios');
            return res.redirect('/recetas/nueva');
        }

        // Calcular tamaño de porción automáticamente si hay calorías y porciones
        let tamano_porcion_calculado = null;
        if (calorias && porciones) {
            tamano_porcion_calculado = `${Math.round(calorias / porciones)} cal c/u`;
        }

        // Crear la receta con los datos procesados
        await Receta.create({
            titulo, 
            descripcion: descripcion || null,
            ingredientes,
            calorias: calorias || null,
            categoria,
            preparacion,
            etiquetas: etiquetas || null,
            tiempo_preparacion: tiempo_preparacion || null,
            dificultad: dificultad || 'Fácil',
            porciones: porciones || null,
            tamano_porcion: tamano_porcion_calculado, // Usamos el valor calculado
            equivalentes_simplificados: equivalentes_simplificados === 'on' ? true : false,
            equivalentes_smae: equivalentes_smae === 'on' ? true : false,
            imagen,
            usuario_id: req.session.userId,
            archivada: false
        });

        req.flash('success', 'Receta creada exitosamente.');
        res.redirect('/recetas');

    } catch (error) {
        console.error('Error al guardar receta:', error);
        
        // Manejo específico de errores de validación
        if (error.name === 'SequelizeValidationError') {
            const mensajesError = error.errors.map(err => err.message).join(', ');
            req.flash('error', `Error de validación: ${mensajesError}`);
        } else {
            req.flash('error', 'No se pudo crear la receta. Por favor intente nuevamente.');
        }
        
        res.redirect('/recetas/nueva');
    }
};
const editar = async (req, res) => {
    const receta = await Receta.findByPk(req.params.id);
    if (!receta || (receta.usuario_id !== req.session.userId && req.session.rol !== 'admin')) {
        return res.status(403).send('No autorizado');
    }
    res.render('recetas_form', { layout: 'layouts/sistema', receta, active: 'recetas', messages: req.flash() });
};

const actualizar = async (req, res) => {
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== req.session.userId && req.session.rol !== 'admin')) {
            return res.status(403).send('No autorizado');
        }
        const { titulo, descripcion, ingredientes, calorias, categoria, preparacion, etiquetas, tiempo_preparacion, dificultad, porciones, tamano_porcion, equivalentes_simplificados, equivalentes_smae } = req.body;
        receta.titulo = titulo;
        receta.descripcion = descripcion;
        receta.ingredientes = ingredientes;
        receta.calorias = calorias;
        receta.categoria = categoria;
        receta.preparacion = preparacion;
        receta.etiquetas = etiquetas;
        receta.tiempo_preparacion = tiempo_preparacion || null;
        receta.dificultad = dificultad;
        receta.porciones = porciones || null;
        receta.tamano_porcion = tamano_porcion;
        receta.equivalentes_simplificados = equivalentes_simplificados ? true : false;
        receta.equivalentes_smae = equivalentes_smae ? true : false;
        if (req.file) receta.imagen = req.file.filename;

        await receta.save();
        req.flash('success', 'Receta actualizada correctamente.');
        res.redirect('/recetas');
    } catch (error) {
        console.error('Error al actualizar receta:', error);
        req.flash('error', 'No se pudo actualizar la receta.');
        res.redirect(`/recetas/editar/${req.params.id}`);
    }
};

const eliminar = async (req, res) => {
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== req.session.userId && req.session.rol !== 'admin')) {
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
    try {
        const receta = await Receta.findByPk(req.params.id);
        if (!receta || (receta.usuario_id !== req.session.userId && req.session.rol !== 'admin')) {
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

// --- EXPORTAR ---
module.exports = {
    index,
    ver,
    importarDesdeAPI,
    papelera,
    archivar,
    nueva,
    guardar,
    editar,
    actualizar,
    eliminar,
    restaurar
};
