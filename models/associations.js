const Paciente = require('./Paciente');
const NotaNutriologo = require('./NotaNutriologo');
const Progreso = require('./Progreso');
const ArchivoPaciente = require('./ArchivoPaciente');

// Relación: Paciente → Progreso
Paciente.hasMany(Progreso, { foreignKey: 'pacienteId', onDelete: 'CASCADE', as: 'Progresos' });
Progreso.belongsTo(Paciente, { foreignKey: 'pacienteId' });

// Relación: Paciente → ArchivoPaciente
Paciente.hasMany(ArchivoPaciente, { foreignKey: 'pacienteId', onDelete: 'CASCADE' });
ArchivoPaciente.belongsTo(Paciente, { foreignKey: 'pacienteId' });

// Relación: Paciente → NotaNutriologo
Paciente.hasMany(NotaNutriologo, { foreignKey: 'pacienteId', onDelete: 'CASCADE', as: 'NotaNutriologos' });
NotaNutriologo.belongsTo(Paciente, { foreignKey: 'pacienteId' });

module.exports = {
    Paciente,
    NotaNutriologo,
    Progreso,
    ArchivoPaciente,
};
