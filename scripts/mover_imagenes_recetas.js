// scripts/mover_imagenes_recetas.js
const fs = require('fs');
const path = require('path');

const origen = path.join(__dirname, '../public/uploads');
const destino = path.join(__dirname, '../public/uploads/recetas');

// Crear carpeta destino si no existe
if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
}

// Mover archivos
fs.readdirSync(origen).forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
        const oldPath = path.join(origen, file);
        const newPath = path.join(destino, file);

        fs.renameSync(oldPath, newPath);
        console.log(`✅ Movido: ${file}`);
    }
});

console.log('🎉 Todas las imágenes han sido movidas.');
