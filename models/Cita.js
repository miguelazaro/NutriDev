// models/Cita.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Cita = sequelize.define('Cita', {
  // Relación con el nutriólogo (usuario)
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { isInt: true, min: 1 },
    comment: 'ID del usuario (nutriólogo) dueño de la cita'
  },

  // Relación con el paciente
  paciente_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { isInt: true, min: 1 },
    comment: 'ID del paciente asociado a la cita'
  },

  // Información de la cita
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: { isDate: { msg: 'Debe ser una fecha válida' } }
  },
  hora: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: { msg: 'La hora es obligatoria' } }
  },
  motivo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  estado: {
    type: DataTypes.ENUM('Pendiente', 'Confirmada', 'Cancelada', 'Completada'),
    defaultValue: 'Pendiente'
  }
}, {
  tableName: 'citas',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'fecha_actualizacion',
  indexes: [
    { fields: ['usuario_id'] },
    { fields: ['paciente_id'] }
  ]
});

module.exports = Cita;
