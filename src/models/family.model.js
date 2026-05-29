const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user.model');

const Family = sequelize.define('Family', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dni: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  compFamiliar: {
  type: DataTypes.INTEGER, // O STRING, depende si ponés "3" o "3 personas"
  allowNull: true,
  defaultValue: 0
},
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'families',
  timestamps: true
});

User.hasMany(Family, { foreignKey: 'UserId' });
Family.belongsTo(User, { foreignKey: 'UserId' });

module.exports = Family;