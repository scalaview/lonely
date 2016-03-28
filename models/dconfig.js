'use strict';
module.exports = function(sequelize, DataTypes) {
  var DConfig = sequelize.define('DConfig', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    value: {
      type: DataTypes.STRING
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });

  DConfig.dConfigs = [{
    name: 'vipLimit',
    value: '1'
  },{
    name: 'exchangeRate',
    value: '1'
  },{
    name: 'affiliate',
    value: '1'
  },{
    name: 'disable',
    value: 'false'
  }]

  return DConfig;
};