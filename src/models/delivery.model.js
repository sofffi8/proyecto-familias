const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Family = require('./family.model'); // Importamos familias para relacionarlas

const Delivery = sequelize.define('Delivery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  date: {
    type: DataTypes.DATEONLY, // Guarda solo la fecha (YYYY-MM-DD) sin la hora, ideal para agrupar
    allowNull: false,
    defaultValue: DataTypes.NOW // Por defecto toma el día de hoy
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'deliveries',
  timestamps: true
});

// RELACIONES: Una familia puede tener muchas entregas en distintas fechas
Family.hasMany(Delivery, { foreignKey: 'FamilyId', onDelete: 'CASCADE' });
Delivery.belongsTo(Family, { foreignKey: 'FamilyId' });

module.exports = Delivery;