// models/Cobro.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ESTADOS = [
  'pendiente',
  'pagado',
  'fallido',
  'cancelado',
  'expirado',
  'reembolsado',
];

const Cobro = sequelize.define(
  'Cobro',
  {
    // Quién creó el cobro (nutriólogo/usuario dueño de la cuenta conectada)
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },

    // Paciente (opcional)
    paciente_id: { type: DataTypes.INTEGER, allowNull: true },

    // Texto corto visible en Checkout / recibos
    concepto: { type: DataTypes.STRING, allowNull: false },

    // Guardamos en centavos para precisión. Al crear el cobro puede ir 0 y
    // al confirmar el pago se actualiza con el webhook.
    monto_centavos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // Moneda en ISO (usamos MXN por defecto)
    moneda: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'MXN',
    },

    // Estado del cobro
    estado: {
      type: DataTypes.ENUM(...ESTADOS),
      allowNull: false,
      defaultValue: 'pendiente',
    },

    // Fecha efectiva del pago (se setea cuando se marca pagado)
    fecha: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // IDs de Stripe para trazabilidad
    stripe_payment_link_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Si usas Payment Links (opcional)',
    },

    // Recomendado: usar stripe_session_id.
    // Si ya tenías este campo, puedes mantenerlo por compatibilidad:
    stripe_checkout_session_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Legacy: preferir stripe_session_id',
    },

    // Checkout Session id (cuando creas la sesión de pago)
    stripe_session_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Checkout Session ID asociado al cobro',
    },

    // PaymentIntent id (confirmado desde el webhook)
    stripe_payment_intent_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // ID de la cuenta conectada de Stripe (acct_xxx)
    stripe_account_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Cuenta conectada (Connect) donde se cobró',
    },

    // URL de pago/checkout (por si quieres guardar el link)
    url_cobro: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'cobros',
    underscored: true,
    timestamps: true, // created_at, updated_at

    indexes: [
      { fields: ['usuario_id'] },
      { fields: ['paciente_id'] },
      { fields: ['estado'] },
      { fields: ['stripe_session_id'] },
      { fields: ['stripe_payment_intent_id'] },
      { fields: ['stripe_account_id'] },
    ],

    // "Virtual" helper para leer el monto en pesos ya convertido
    getterMethods: {
      // Nota: en Sequelize v6 puedes usar get() { ... } dentro de field
      monto() {
        const cents = this.getDataValue('monto_centavos') || 0;
        return cents / 100;
      },
    },
  }
);

module.exports = Cobro;
