const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Paciente = sequelize.define('Paciente', {
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    edad: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    historial: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'pacientes',
    timestamps: true,
});

module.exports = Paciente;
