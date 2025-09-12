// models/NotaNutriologo.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const NotaNutriologo = sequelize.define('NotaNutriologo', {
  nota: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // FK hacia Paciente (en tu tabla existe y puede ser NULL según DESCRIBE)
  pacienteId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'notanutriologos',
  timestamps: true,           
});

module.exports = NotaNutriologo;
