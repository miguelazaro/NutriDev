const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Paciente = sequelize.define('Paciente', {
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1 }
    },

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
        validate: { isDate: true }
    },

    pais_residencia: {
        type: DataTypes.STRING,
        defaultValue: 'México',
        allowNull: true
    },

    estatura: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 50, max: 250 }
    },

    peso: {
        type: DataTypes.FLOAT,
        allowNull: true,
        validate: { min: 20, max: 400 }
    },

    actividad: { type: DataTypes.STRING, allowNull: true },
    objetivo: { type: DataTypes.STRING, allowNull: true },

    comidas_dia: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 1, max: 10 }
    },

    preferencias: { type: DataTypes.TEXT, allowNull: true },

    porcentaje_grasa: { type: DataTypes.FLOAT, allowNull: true },
    circunferencia_cintura: { type: DataTypes.FLOAT, allowNull: true },
    presion_arterial: { type: DataTypes.STRING, allowNull: true },

    tipo_ejercicio: { type: DataTypes.STRING, allowNull: true },
    horas_sueno: { type: DataTypes.INTEGER, allowNull: true },
    calidad_sueno: { type: DataTypes.STRING, allowNull: true },
    estres: { type: DataTypes.STRING, allowNull: true },

    preferencia_alimentaria: { type: DataTypes.STRING, allowNull: true },
    consumo_agua: { type: DataTypes.FLOAT, allowNull: true },
    apetito: { type: DataTypes.STRING, allowNull: true },

    otras_enfermedades: { type: DataTypes.TEXT, allowNull: true },

    telefono: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { len: [0, 20] }
    },

    email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { isEmail: true }
    },

    enviar_cuestionario: { type: DataTypes.BOOLEAN, defaultValue: false },

    historial: { type: DataTypes.TEXT, allowNull: true },

    foto: { type: DataTypes.STRING, allowNull: true },
    archivo: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'pacientes',
    timestamps: true,
    createdAt: 'fecha_registro',
    updatedAt: 'fecha_actualizacion',
    indexes: [
        { fields: ['usuario_id'] }
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
