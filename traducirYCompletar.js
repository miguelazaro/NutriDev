require('dotenv').config();
const { Op } = require('sequelize');
const axios = require('axios');
const sequelize = require('./config/db');
const Receta = require('./models/Receta');
const { traducirTexto } = require('./utils/traductor');

const APP_ID = process.env.EDAMAM_APP_ID;
const APP_KEY = process.env.EDAMAM_APP_KEY;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const procesarReceta = async (receta, totalPendientes, intentoEdamam = 1) => {
    try {
        const procesadas = totalPendientes - (await Receta.count({ where: { categoria: { [Op.or]: ['breakfast', 'lunch/dinner', 'snack'] } } }));
        console.log(`[${procesadas + 1}/${totalPendientes}] Procesando: "${receta.titulo}"`);

        // --- ESTA ES LA PARTE CRÍTICA: LLAMADA A EDAMAM ---
        const searchUrl = `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(receta.titulo)}&app_id=${APP_ID}&app_key=${APP_KEY}`;
        const apiResponse = await axios.get(searchUrl);
        // --- FIN DE LA LLAMADA A EDAMAM ---

        if (apiResponse.data.hits.length === 0) {
            console.log(`🟡 No se encontró en API: "${receta.titulo}".`);
            receta.categoria = 'General'; // Marcamos como procesada para no volver a buscarla
            await receta.save();
            return;
        }
        const hit = apiResponse.data.hits[0].recipe;

        console.log('  - Traduciendo textos...');
        const tituloTraducido = await traducirTexto(hit.label);

        const ingredientesTraducidosArray = [];
        for (const linea of hit.ingredientLines) {
            const traduccion = await traducirTexto(linea);
            ingredientesTraducidosArray.push(traduccion);
        }
        const ingredientesTraducidos = ingredientesTraducidosArray.join('\n');
        
        let categoriaTraducida = 'General';
        const dishType = hit.dishType?.[0]?.toLowerCase() || '';
        if (dishType.includes('breakfast')) categoriaTraducida = 'Desayuno';
        else if (dishType.includes('lunch') || dishType.includes('main course') || dishType.includes('dinner')) categoriaTraducida = 'Comida/Cena';
        else if (dishType.includes('snack')) categoriaTraducida = 'Colación';
        else if (dishType.includes('dessert')) categoriaTraducida = 'Postre';

        receta.set({
            titulo: tituloTraducido,
            descripcion: `Receta de ${hit.source} para ${Math.round(hit.yield)} porciones.`,
            ingredientes: ingredientesTraducidos,
            preparacion: `Instrucciones no disponibles. Ver receta original en: ${hit.url}`,
            categoria: categoriaTraducida,
            calorias: Math.round(hit.calories / hit.yield),
            proteinas: parseFloat((hit.totalNutrients.PROCNT.quantity / hit.yield).toFixed(1)),
            grasas: parseFloat((hit.totalNutrients.FAT.quantity / hit.yield).toFixed(1)),
            carbohidratos: parseFloat((hit.totalNutrients.CHOCDF.quantity / hit.yield).toFixed(1)),
            porciones: Math.round(hit.yield),
            tiempo_preparacion: hit.totalTime > 0 ? hit.totalTime : 30,
        });

        await receta.save();
        console.log(`👍 Receta ID ${receta.id} actualizada a: "${tituloTraducido}"`);

    } catch (error) {
        // --- MANEJO DE ERRORES INTELIGENTE ---
        if (error.response?.status === 429 && intentoEdamam <= 3) {
            console.error(`❌ Límite de API de Edamam alcanzado. Esperando 60 segundos para reintentar (intento ${intentoEdamam}/3)...`);
            await sleep(60000); // Espera 1 minuto
            await procesarReceta(receta, totalPendientes, intentoEdamam + 1); // Vuelve a intentar la MISMA receta
        } else {
            console.error(`❌ Error final procesando ID ${receta.id} ("${receta.titulo}"): ${error.message}`);
        }
    }
};

const traducirTodas = async () => {
    if (!APP_ID || !APP_KEY) {
        console.error('❌ Error: Revisa las claves de Edamam en el archivo .env');
        return;
    }
    console.log('Iniciando script final para traducir y completar recetas...');

    try {
        const recetasAProcesar = await Receta.findAll({
            where: { [Op.or]: [{ categoria: 'breakfast' }, { categoria: 'lunch/dinner' }, { categoria: 'snack' }] }
        });

        const totalPendientes = recetasAProcesar.length;
        if (totalPendientes === 0) {
            console.log('✅ ¡No hay recetas pendientes por traducir!');
            return;
        }
        console.log(`✅ Se encontraron ${totalPendientes} recetas pendientes.`);

        for (const receta of recetasAProcesar) {
            await procesarReceta(receta, totalPendientes);
            // La pausa principal ya no es necesaria, el manejo de errores se encarga del ritmo
        }

        console.log('🎉 ¡Proceso de traducción y actualización completado!');
    } catch (error) {
        console.error('Error general en el script:', error);
    } finally {
        await sequelize.close();
    }
};

traducirTodas();
