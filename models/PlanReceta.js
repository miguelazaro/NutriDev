// models/PlanReceta.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Importar modelos para asociar
const PlanAlimenticio = require('./PlanAlimenticio');
const Receta = require('./Receta');
const Paciente = require('./Paciente');

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
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// ================================
// 🔥 ASOCIACIONES NECESARIAS
// ================================
PlanReceta.belongsTo(PlanAlimenticio, {
    foreignKey: 'plan_id',
    as: 'plan'
});

PlanReceta.belongsTo(Receta, {
    foreignKey: 'receta_id',
    as: 'receta'
});

PlanReceta.belongsTo(Paciente, {
    foreignKey: 'paciente_id',
    as: 'paciente'
});

module.exports = PlanReceta;
