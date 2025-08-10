// descargarImagenes.js
require('dotenv').config();
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sequelize = require('./config/db');
const Receta = require('./models/Receta');

const APP_ID = process.env.EDAMAM_APP_ID;
const APP_KEY = process.env.EDAMAM_APP_KEY;

const dir = path.join(__dirname, 'public', 'uploads', 'recetas');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const procesarReceta = async (receta, totalRecetas, intento = 1) => {
    try {
        const currentIndex = (await Receta.count({ where: { imagen: { [Op.notLike]: 'https://%' } } })) + 1;
        console.log(`[${currentIndex}/${totalRecetas}] Buscando en API: "${receta.titulo}"`);
        
        const searchUrl = `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(receta.titulo)}&app_id=${APP_ID}&app_key=${APP_KEY}`;
        const apiResponse = await axios.get(searchUrl);

        if (apiResponse.data.hits.length === 0) {
            console.log(`🟡 No se encontró en API: "${receta.titulo}"`);
            return;
        }

        const newImageUrl = apiResponse.data.hits[0].recipe.image;
        if (!newImageUrl) {
            console.log(`🟡 No se encontró URL de imagen para: "${receta.titulo}"`);
            return;
        }

        console.log(`🔽 Descargando imagen para ID: ${receta.id}`);
        const extension = path.extname(new URL(newImageUrl).pathname) || '.jpg';
        const nuevoNombre = `receta-${receta.id}${extension}`;
        const rutaLocal = path.join(dir, nuevoNombre);
        const rutaParaBD = `/uploads/recetas/${nuevoNombre}`;

        const imageResponse = await axios({ method: 'GET', url: newImageUrl, responseType: 'stream' });
        const writer = fs.createWriteStream(rutaLocal);
        imageResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        receta.imagen = rutaParaBD;
        await receta.save({ validate: false });
        console.log(`👍 Imagen para ID: ${receta.id} guardada como ${rutaParaBD}`);

    } catch (error) {
        if (error.response && error.response.status === 429 && intento <= 3) {
            console.error(`❌ Error 429 (Rate Limit). Esperando 60 segundos para reintentar (intento ${intento}/3)...`);
            await sleep(60000); // Espera 1 minuto
            await procesarReceta(receta, totalRecetas, intento + 1); // Reintenta la misma receta
        } else {
            console.error(`❌ Error final procesando ID ${receta.id} ("${receta.titulo}"): ${error.message}`);
        }
    }
};

const descargarTodas = async () => {
    if (!APP_ID || !APP_KEY) {
        console.error('❌ Error: Revisa las claves de Edamam en el archivo .env');
        return;
    }
    console.log('Iniciando script final para descargar imágenes...');

    try {
        const recetasAProcesar = await Receta.findAll({
            where: { imagen: { [Op.like]: 'https://edamam-product-images.s3.amazonaws.com%' } }
        });

        const totalRecetas = recetasAProcesar.length;
        console.log(`✅ Se encontraron ${totalRecetas} recetas pendientes.`);

        for (const receta of recetasAProcesar) {
            await procesarReceta(receta, totalRecetas);
            console.log('--- Pausa de 7 segundos entre recetas ---');
            await sleep(7000); // Pausa base de 7 segundos
        }

        console.log('🎉 Proceso completado.');
    } catch (error) {
        console.error('Error general en el script:', error);
    } finally {
        await sequelize.close();
    }
};

descargarTodas();