'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar la columna "peso" a la tabla pacientes
    await queryInterface.addColumn('pacientes', 'peso', {
      type: Sequelize.FLOAT,
      allowNull: true,
      validate: { min: 20, max: 500 },
      comment: 'Peso actual del paciente en kilogramos'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir: eliminar la columna "peso"
    await queryInterface.removeColumn('pacientes', 'peso');
  }
};
