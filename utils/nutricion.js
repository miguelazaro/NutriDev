// utils/nutricion.js
const INGREDIENTES_NUTRICION = {
    'azúcar': { calorias: 387, proteinas: 0, carbohidratos: 100, grasas: 0 },
    'huevo': { calorias: 155, proteinas: 13, carbohidratos: 1.1, grasas: 11 },
    // Añade más ingredientes con sus valores nutricionales
};

function calcularValoresNutricionales(ingredientes) {
    let total = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
    
    ingredientes.forEach(ing => {
        const nombre = ing.ingrediente.toLowerCase();
        if (INGREDIENTES_NUTRICION[nombre]) {
            const factor = ing.cantidad || 1;
            total.calorias += INGREDIENTES_NUTRICION[nombre].calorias * factor;
            total.proteinas += INGREDIENTES_NUTRICION[nombre].proteinas * factor;
            total.carbohidratos += INGREDIENTES_NUTRICION[nombre].carbohidratos * factor;
            total.grasas += INGREDIENTES_NUTRICION[nombre].grasas * factor;
        }
    });
    
    return total;
}

module.exports = {
    calcularValoresNutricionales
};