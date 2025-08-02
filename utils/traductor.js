const axios = require('axios');

// Diccionario de términos culinarios específicos
const DICCIONARIO_CULINARIO = {
  'olive oil': 'aceite de oliva',
  'mayonnaise': 'mayonesa',
  'lemon juice': 'jugo de limón',
  'kosher salt': 'sal kosher',
  'hot paprika': 'pimentón picante',
  'roasted garlic': 'ajo asado',
  'garlic powder': 'ajo en polvo',
  'fire roasted onion': 'cebilla asada',
  'onion powder': 'cebolla en polvo',
  'cayenne pepper': 'pimienta de cayena',
  'dried thyme': 'tomillo seco',
  'dried oregano': 'orégano seco',
  'cumin seeds': 'semillas de comino',
  'ground nutmeg': 'nuez moscada molida',
  'Italian or Po\' Boy rolls': 'panecillos italianos o tipo Po\' Boy'
};

async function traducirTexto(textoIngles) {
  // Primero reemplazar términos del diccionario culinario
  let textoTraducido = textoIngles;
  for (const [en, es] of Object.entries(DICCIONARIO_CULINARIO)) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    textoTraducido = textoTraducido.replace(regex, es);
  }

  // Luego traducir el resto con MyMemory
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textoTraducido)}&langpair=en|es`;
  
  try {
    const response = await axios.get(url);
    let traduccion = response.data.responseData.translatedText;
    
    // Post-procesamiento para mejorar la traducción
    traduccion = traduccion
      .replace(/\btablespoons?\b/gi, 'cucharadas')
      .replace(/\bteaspoons?\b/gi, 'cucharaditas')
      .replace(/\bcups?\b/gi, 'tazas')
      .replace(/\bpounds?\b/gi, 'libras')
      .replace(/\bounces?\b/gi, 'onzas');
      
    return traduccion;
  } catch (err) {
    console.error('Error al traducir:', err.message);
    return textoTraducido; // fallback con lo que tengamos
  }
}

module.exports = { traducirTexto };