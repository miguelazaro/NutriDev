// utils/getDatesForWeek.js

module.exports = function getDatesForWeek() {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1);

    let fechas = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + i);
        fechas.push(d.toISOString().slice(0, 10));
    }

    return fechas;
};
