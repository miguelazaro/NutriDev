const { calcularCalorias } = require('../controllers/recetaController');

test('debe sumar las calorías correctamente', () => {
    const ingredientes = [
        { nombre: 'Avena', calorias: 150 },
        { nombre: 'Plátano', calorias: 90 },
        { nombre: 'Leche', calorias: 120 },
    ];

    expect(calcularCalorias(ingredientes)).toBe(360);
});
