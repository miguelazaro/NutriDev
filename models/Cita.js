const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Cita = sequelize.define('Cita', {
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  paciente_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },

  hora: {
    type: DataTypes.TIME,
    allowNull: false
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
    type: DataTypes.ENUM('pendiente', 'confirmada', 'cancelada'),
    defaultValue: 'pendiente'
  }
}, {
  tableName: 'citas',
  timestamps: true,
  createdAt: 'fecha_creacion',
  updatedAt: 'fecha_actualizacion'
});

module.exports = Cita;
