// utils/parsePlanIA.js

module.exports = function parsePlanIA(md) {
    const dias = [
        "Lunes", "Martes", "Miércoles", "Jueves",
        "Viernes", "Sábado", "Domingo"
    ];

    const comidas = [
        "Desayuno", "Snack", "Snack 1", "Snack 2", "Comida", "Cena"
    ];

    const lines = md.split(/\r?\n/);

    let resultado = [];
    let currentDay = null;
    let currentMeal = null;

    const limpiar = (t) =>
        t.replace(/^#+\s*/, "").replace(/[:*`_-]/g, "").trim();

    for (let line of lines) {
        const clean = limpiar(line);

        // ¿Es día?
        if (dias.some(d => clean.startsWith(d))) {
            currentDay = {
                dia: clean.replace(":", ""),
                comidas: []
            };
            resultado.push(currentDay);
            continue;
        }

        // ¿Es comida?
        if (currentDay && comidas.some(c => clean.startsWith(c))) {
            currentMeal = {
                tipo: clean.replace(":", ""),
                items: []
            };
            currentDay.comidas.push(currentMeal);
            continue;
        }

        // ¿Es viñeta?
        if (currentMeal && line.trim().startsWith("-")) {
            currentMeal.items.push(line.replace(/^\s*-\s*/, "").trim());
        }
    }

    return resultado;
};
