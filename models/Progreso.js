const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Paciente = require('./Paciente');

const Progreso = sequelize.define('Progreso', {
    peso: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    fecha: {
        type: DataTypes.DATEONLY,
        defaultValue: DataTypes.NOW,
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'progresos',
    timestamps: false,
});

Progreso.belongsTo(Paciente, { foreignKey: 'pacienteId' });

module.exports = Progreso;
