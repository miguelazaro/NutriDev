const Cobro = require('./cobro');
const StripeAccount = require('./StripeAccount');
const Paciente = require('./Paciente');

// Si tienes Usuario.js puedes relacionarlo también,
// si no, simplemente dejamos usuario_id como entero.
try {
  const Usuario = require('./Usuario'); // si existe
  Usuario.hasMany(Cobro, { foreignKey: 'usuario_id' });
  Cobro.belongsTo(Usuario, { foreignKey: 'usuario_id' });

  Usuario.hasOne(StripeAccount, { foreignKey: 'usuario_id' });
  StripeAccount.belongsTo(Usuario, { foreignKey: 'usuario_id' });
} catch (_) {
  // sin modelo Usuario, no pasa nada
}

// Relación con Paciente (sí lo tienes)
Paciente.hasMany(Cobro, { foreignKey: 'paciente_id' });
Cobro.belongsTo(Paciente, { foreignKey: 'paciente_id' });

module.exports = { Cobro, StripeAccount };
