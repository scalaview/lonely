'use strict';
module.exports = function(sequelize, DataTypes) {
  var PaymentMethod = sequelize.define('PaymentMethod', {
    name: DataTypes.STRING,
    code: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
      }
    }
  });
  return PaymentMethod;
};