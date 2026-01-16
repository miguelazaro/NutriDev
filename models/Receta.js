// models/Receta.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Receta = sequelize.define('Receta', {
    titulo: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'El título de la receta es requerido' }
        }
    },
    descripcion: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    // Sequelize ahora solo leerá y escribirá el texto plano.
    ingredientes: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    preparacion: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    categoria: {
        type: DataTypes.STRING,
        defaultValue: 'general',
        set(value) {
            this.setDataValue('categoria', value.toLowerCase());
        }
    },
    etiquetas: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    tiempo_preparacion: {
        type: DataTypes.INTEGER,
    },
    tiempo_coccion: {
        type: DataTypes.INTEGER,
    },
    porciones: {
        type: DataTypes.INTEGER,
    },
    dificultad: {
        type: DataTypes.ENUM('fácil', 'medio', 'difícil'),
        defaultValue: 'fácil'
    },
    calorias: {
        type: DataTypes.INTEGER,
    },
    proteinas: {
        type: DataTypes.FLOAT,
    },
    carbohidratos: {
        type: DataTypes.FLOAT,
    },
    grasas: {
        type: DataTypes.FLOAT,
    },
    imagen: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    archivada: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    equivalentes_simplificados: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    equivalentes_smae: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'recetas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
});

module.exports = Receta;
