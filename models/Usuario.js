const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Usuario = sequelize.define('Usuario', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rol: {
    type: DataTypes.ENUM('nutriologo', 'admin'),
    defaultValue: 'nutriologo'
  },
  // --- AÑADE ESTA SECCIÓN ---
  plan: {
    type: DataTypes.ENUM('basico', 'premium'),
    allowNull: false,
    defaultValue: 'basico'
  }
  // -------------------------
}, {
  tableName: 'usuarios',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false // sequelize no manejará la columna updatedAt
});

module.exports = Usuario;
