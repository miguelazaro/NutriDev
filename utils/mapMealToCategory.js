module.exports = function mapMealToCategory(mealName) {
    const m = mealName.toLowerCase();

    if (m.includes("desayuno")) return "desayuno";
    if (m.includes("comida") || m.includes("almuerzo")) return "comida";
    if (m.includes("cena")) return "cena";
    if (m.includes("snack") || m.includes("colación") || m.includes("colacion")) return "snack";
    return "comida"; 
};
