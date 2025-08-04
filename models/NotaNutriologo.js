const { DataTypes } = require('sequelize');
const db = require('../config/db');

const NotaNutriologo = db.define('NotaNutriologo', {
    nota: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

module.exports = NotaNutriologo;
