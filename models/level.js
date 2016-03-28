'use strict';
module.exports = function(sequelize, DataTypes) {
  var Level = sequelize.define('Level', {
      name: {
        type: DataTypes.STRING
      },
      discount: {
        type: DataTypes.FLOAT,
        defaultValue: 0.00
      },
      extend: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      code: {
        type: DataTypes.STRING
      }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Level;
};