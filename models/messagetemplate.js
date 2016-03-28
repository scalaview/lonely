'use strict';
module.exports = function(sequelize, DataTypes) {
  var MessageTemplate = sequelize.define('MessageTemplate', {
    name: DataTypes.STRING,
    content: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return MessageTemplate;
};