// scripts/fixRecipes.js
const Receta = require('../models/Receta');
const { Op } = require('sequelize');

const corregirRecetasImportadas = async () => {
  try {
    console.log('🔍 Buscando recetas para corregir...');
    
    const recetas = await Receta.findAll({
      where: {
        [Op.or]: [
          { imagen: { [Op.like]: '%?%' } },
          { ingredientes: { [Op.like]: '%<br>%' } }
        ]
      }
    });

    console.log(`✅ Encontradas ${recetas.length} recetas para corregir`);

    for (const [index, receta] of recetas.entries()) {
      console.log(`\n📝 Procesando receta ${index + 1}/${recetas.length}: ${receta.titulo}`);
      
      // Corregir imagen
      if (receta.imagen && receta.imagen.includes('?')) {
        const nuevaImagen = receta.imagen.split('?')[0];
        console.log(`🖼️  Imagen: ${receta.imagen.substring(0, 30)}... -> ${nuevaImagen.substring(0, 30)}...`);
        receta.imagen = nuevaImagen;
      }
      
      // Corregir ingredientes
      if (receta.ingredientes) {
        const originalLength = receta.ingredientes.length;
        receta.ingredientes = receta.ingredientes
          .replace(/<br>/g, '\n')
          .replace(/-bro-/g, '• ')
          .replace(/-cbr-/g, '\n');
        
        if (originalLength !== receta.ingredientes.length) {
          console.log(`🧂 Ingredientes corregidos (longitud: ${originalLength} -> ${receta.ingredientes.length})`);
        }
      }
      
      await receta.save();
      console.log(`💾 Receta guardada correctamente`);
    }
    
    console.log(`\n🎉 Proceso completado! Recetas corregidas: ${recetas.length}`);
  } catch (error) {
    console.error('❌ Error al corregir recetas:', error);
  } finally {
    process.exit();
  }
};

// Verificar conexión a la base de datos primero
(async () => {
  try {
    await Receta.sequelize.authenticate();
    console.log('🔌 Conexión a la base de datos establecida correctamente');
    await corregirRecetasImportadas();
  } catch (error) {
    console.error('❌ No se pudo conectar a la base de datos:', error);
    process.exit(1);
  }
})();