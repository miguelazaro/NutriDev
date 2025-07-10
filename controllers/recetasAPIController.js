const axios = require('axios');
const { translate } = require('@vitalets/google-translate-api');

// Diccionario de términos de búsqueda (Español → Inglés)
const diccionarioBusqueda = {
  "pollo": "chicken",
  "res": "beef",
  "pasta": "pasta",
  "pescado": "fish",
  "mariscos": "seafood",
  "cerdo": "pork",
  "postre": "dessert",
  "vegetariano": "vegetarian",
  "vegano": "vegan",
  "cordero": "lamb",
  "arroz": "rice",
  "huevo": "egg"
};

exports.obtenerDesdeAPI = async (req, res) => {
  try {
  
    let query = req.query.q?.toLowerCase() || 'chicken';
    const originalQuery = query;
    query = diccionarioBusqueda[query] || query;

    
    const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${query}`);
    const recetas = response.data.meals || [];

  
    const recetasTraducidas = await Promise.all(
      recetas.map(async (receta) => {
        try {
          const [tituloTraducido, categoriaTraducida, origenTraducido] = await Promise.all([
            translate(receta.strMeal, { to: 'es' }),
            translate(receta.strCategory, { to: 'es' }),
            translate(receta.strArea, { to: 'es' })
          ]);

          return {
            ...receta,
            strMeal: tituloTraducido.text,
            strCategory: categoriaTraducida.text,
            strArea: origenTraducido.text
          };
        } catch (error) {
          // En caso de error de traducción, se muestra sin traducir
          return receta;
        }
      })
    );

    // Renderizar vista con recetas traducidas
    res.render('recetas', {
      recetas: recetasTraducidas,
      active: 'recetas',
      busqueda: originalQuery
    });

  } catch (error) {
    console.error('Error al obtener o traducir recetas:', error.message);
    res.status(500).send('Error al mostrar las recetas');
  }
};
