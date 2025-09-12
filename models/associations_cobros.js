const Cobro = require('./Cobro');
const StripeAccount = require('./StripeAccount');
const Paciente = require('./Paciente');

try {
  const Usuario = require('./Usuario'); // si existe
  Usuario.hasMany(Cobro, { foreignKey: 'usuario_id' });
  Cobro.belongsTo(Usuario, { foreignKey: 'usuario_id' });

  Usuario.hasOne(StripeAccount, { foreignKey: 'usuario_id' });
  StripeAccount.belongsTo(Usuario, { foreignKey: 'usuario_id' });
} catch (_) {
  // sin modelo Usuario, no pasa nada
}

// Relación con Paciente 
Paciente.hasMany(Cobro, { foreignKey: 'paciente_id' });
Cobro.belongsTo(Paciente, { foreignKey: 'paciente_id' });

module.exports = { Cobro, StripeAccount };
