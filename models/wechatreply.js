'use strict';
module.exports = function(sequelize, DataTypes) {
  var WechatReply = sequelize.define('WechatReply', {
    key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content: DataTypes.TEXT,
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return WechatReply;
};