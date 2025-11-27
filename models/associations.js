const Usuario          = require('./Usuario');
const Paciente         = require('./Paciente');
const Cita             = require('./Cita');  
const NotaNutriologo   = require('./NotaNutriologo');
const Progreso         = require('./Progreso');
const ArchivoPaciente  = require('./ArchivoPaciente');
const PlanAlimenticio  = require('./PlanAlimenticio');

/* ========= Relaciones por USUARIO (multi-tenant) ========= */
Usuario.hasMany(Paciente, {
  foreignKey: 'usuario_id',
  as: 'pacientes',
});
Paciente.belongsTo(Usuario, {
  foreignKey: 'usuario_id',
  as: 'dueno',
});

Usuario.hasMany(PlanAlimenticio, {
  foreignKey: 'usuario_id',
  as: 'planesAlimenticios',
});
PlanAlimenticio.belongsTo(Usuario, {
  foreignKey: 'usuario_id',
  as: 'dueno',
});

/* ========= Relaciones PACIENTE -> hijos ========= */

// Paciente → Progreso
Paciente.hasMany(Progreso, {
  foreignKey: 'pacienteId',
  onDelete: 'CASCADE',
  as: 'Progresos',
});
Progreso.belongsTo(Paciente, {
  foreignKey: 'pacienteId',
});

// Paciente → ArchivoPaciente
Paciente.hasMany(ArchivoPaciente, {
  foreignKey: 'pacienteId',
  onDelete: 'CASCADE',
});
ArchivoPaciente.belongsTo(Paciente, {
  foreignKey: 'pacienteId',
});

// Paciente → NotaNutriologo
Paciente.hasMany(NotaNutriologo, {
  foreignKey: 'pacienteId',
  onDelete: 'CASCADE',
  as: 'NotaNutriologos',
});
NotaNutriologo.belongsTo(Paciente, {
  foreignKey: 'pacienteId',
});

// Paciente → PlanAlimenticio
Paciente.hasMany(PlanAlimenticio, {
  foreignKey: 'paciente_id',
  onDelete: 'CASCADE',
  as: 'planes',
});
PlanAlimenticio.belongsTo(Paciente, {
  foreignKey: 'paciente_id',
  as: 'paciente',
});

// Un paciente puede tener muchas citas
Paciente.hasMany(Cita, {
  foreignKey: 'paciente_id',
  as: 'citas'
});

// Una cita pertenece a un paciente
Cita.belongsTo(Paciente, {
  foreignKey: 'paciente_id',
  as: 'paciente'
});

module.exports = {
  Usuario,
  Paciente,
  Cita,
  NotaNutriologo,
  Progreso,
  ArchivoPaciente,
  PlanAlimenticio,
};
