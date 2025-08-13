// models/PlanAlimenticio.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PlanAlimenticio = sequelize.define('PlanAlimenticio', {
  titulo:     { type: DataTypes.STRING, allowNull: false },
  contenido:  { type: DataTypes.TEXT('long'), allowNull: false },
  tipo:       { type: DataTypes.ENUM('manual', 'ia'), allowNull: false, defaultValue: 'manual' },

  // FK al paciente (puede ser null si el plan no está ligado)
  paciente_id: { type: DataTypes.INTEGER, allowNull: true },

  // 👇 DUEÑO del plan (multi-usuario). En BD ya lo forzamos NOT NULL.
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { isInt: true, min: 1 },
    comment: 'ID del usuario (nutriólogo) dueño del plan',
  }
}, {
  tableName: 'planes_alimenticios',
  timestamps: true,
  indexes: [
    { fields: ['usuario_id'] },
    { fields: ['paciente_id'] },
  ]
});

module.exports = PlanAlimenticio;
