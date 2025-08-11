// models/PlanReceta.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PlanReceta = sequelize.define('PlanReceta', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    plan_id: { type: DataTypes.INTEGER, allowNull: false },
    receta_id: { type: DataTypes.INTEGER, allowNull: false },
    paciente_id: { type: DataTypes.INTEGER, allowNull: false },
    fecha: { type: DataTypes.DATEONLY, allowNull: true },
    momento: {
        type: DataTypes.ENUM('desayuno', 'comida', 'cena', 'colacion'),
        allowNull: false
    },
    porciones: { type: DataTypes.DECIMAL(4, 2), defaultValue: 1.0 },
    notas: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'plan_recetas',
    underscored: true
});

module.exports = PlanReceta;
