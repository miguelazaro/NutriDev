// models/ArchivoPaciente.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Paciente = require('./Paciente');

const ArchivoPaciente = sequelize.define('ArchivoPaciente', {
    nombre_archivo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tipo: {
        type: DataTypes.ENUM('imagen', 'documento'),
        allowNull: false
    },
    ruta: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fecha_subida: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'archivos_pacientes',
    timestamps: false
});

ArchivoPaciente.belongsTo(Paciente, { foreignKey: 'pacienteId' });
Paciente.hasMany(ArchivoPaciente, { foreignKey: 'pacienteId' });

module.exports = ArchivoPaciente;
