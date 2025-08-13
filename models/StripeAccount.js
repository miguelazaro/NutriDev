const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StripeAccount = sequelize.define('StripeAccount', {
    usuario_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    connected_account_id: { type: DataTypes.STRING, allowNull: false }, // acct_xxx
    charges_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    payouts_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    details_submitted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'stripe_connect_accounts',
    underscored: true
});

module.exports = StripeAccount;
