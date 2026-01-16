const Receta = require('../models/Receta');
const { Op } = require('sequelize');
const PUBLIC_OWNER_ID = 2; 

module.exports = async function selectRecipe(categoria) {
    const recetas = await Receta.findAll({
        where: {
            categoria: { [Op.like]: `%${categoria}%` },
            archivada: false,
            usuario_id: { [Op.in]: [PUBLIC_OWNER_ID] }
        },
        limit: 50
    });

    if (!recetas.length) return null;

    return recetas[Math.floor(Math.random() * recetas.length)];
};
