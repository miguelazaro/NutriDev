const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Receta = sequelize.define('Receta', {
    titulo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT
    },
    ingredientes: {
        type: DataTypes.TEXT
    },
    calorias: {
        type: DataTypes.INTEGER
    },
    categoria: {
        type: DataTypes.STRING
    },
    preparacion: {
        type: DataTypes.TEXT
    },
    imagen: {
        type: DataTypes.STRING
    },
    usuario_id: {
        type: DataTypes.INTEGER
    },
    archivada: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    etiquetas: {
        type: DataTypes.STRING
    },
    tiempo_preparacion: {
        type: DataTypes.STRING
    },
    dificultad: {
        type: DataTypes.STRING
    },
    porciones: {
        type: DataTypes.INTEGER
    },
    tamano_porcion: {
        type: DataTypes.STRING
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
    updatedAt: false
});

module.exports = Receta;
