const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PlanAlimenticio = sequelize.define('PlanAlimenticio', {
    titulo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    contenido: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    tipo: {
        type: DataTypes.ENUM('manual', 'ia'),
        allowNull: false,
        defaultValue: 'manual'
    },
    paciente_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'planes_alimenticios',
    timestamps: true
});

module.exports = PlanAlimenticio;