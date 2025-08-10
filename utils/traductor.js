const translate = require('translate-google');

/**
 * Traduce texto de inglés a español usando la librería local 'translate-google'.
 * Esto evita los problemas de límite de peticiones de las APIs externas.
 * @param {string} textoIngles El texto a traducir.
 * @returns {Promise<string>} El texto traducido.
 */
async function traducirTexto(textoIngles) {
    // Si el texto está vacío o no es válido, no hacemos nada.
    if (!textoIngles || typeof textoIngles !== 'string') {
        return '';
    }

    try {
        // Usamos la librería para traducir de inglés ('en') a español ('es')
        const traduccion = await translate(textoIngles, { from: 'en', to: 'es' });
        return traduccion;
    } catch (err) {
        // Si por alguna razón la librería falla, devolvemos el texto original.
        console.error(`Error al traducir "${textoIngles}": ${err.message}`);
        return textoIngles;
    }
}

module.exports = { traducirTexto };
