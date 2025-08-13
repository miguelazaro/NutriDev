// models/Paciente.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Paciente = sequelize.define('Paciente', {
  // 👇 DUEÑO del registro (multi-usuario)
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isInt: true,
      min: 1,
    },
    comment: 'ID del usuario (nutriólogo) dueño del paciente',
  },

  // Información básica
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: { msg: 'El nombre es obligatorio' } }
  },
  genero: {
    type: DataTypes.ENUM('Masculino', 'Femenino', 'Otro'),
    allowNull: true
  },
  fecha_nacimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: { isDate: { msg: 'Fecha de nacimiento inválida' } }
  },
  pais_residencia: {
    type: DataTypes.STRING,
    defaultValue: 'México',
    allowNull: true
  },

  // Datos para plan alimenticio (IA)
  estatura: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 50, max: 250 }
  },
  actividad: { type: DataTypes.STRING, allowNull: true },
  objetivo:  { type: DataTypes.STRING, allowNull: true },
  comidas_dia: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 10 }
  },
  preferencias: { type: DataTypes.TEXT, allowNull: true },

  // Contacto
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: { args: [0, 20], msg: 'El teléfono no puede exceder los 20 caracteres' } }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: { msg: 'Debe ser un correo válido' } }
  },
  enviar_cuestionario: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Historial médico
  historial: { type: DataTypes.TEXT, allowNull: true },

  // Archivos del paciente
  foto:   { type: DataTypes.STRING, allowNull: true },
  archivo:{ type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'pacientes',
  timestamps: true,
  createdAt: 'fecha_registro',
  updatedAt: 'fecha_actualizacion',
  indexes: [
    { fields: ['usuario_id'] },
  ],
  hooks: {
    beforeCreate: (paciente) => {
      if (paciente.email && paciente.email.trim() === '') paciente.email = null;
    },
    beforeUpdate: (paciente) => {
      if (paciente.email && paciente.email.trim() === '') paciente.email = null;
    }
  }
});

module.exports = Paciente;
