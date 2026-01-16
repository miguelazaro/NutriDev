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
<<<<<<< Updated upstream
    underscored: true
=======
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// ================================
// ASOCIACIONES NECESARIAS
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
>>>>>>> Stashed changes
});

module.exports = PlanReceta;
