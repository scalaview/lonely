'use strict';

module.exports = function(sequelize, DataTypes) {
  var concern = require('./concerns/profile_attributes')
  var User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false},
    password_hash: { type: DataTypes.STRING, allowNull: false},
    password: {
      type: DataTypes.VIRTUAL,
      set: function (val) {
        this.setDataValue('password', val);
        this.setDataValue('salt', this.makeSalt())
        this.setDataValue('password_hash', this.encryptPassword(this.password));
      },
      validate: {
         isLongEnough: function (val) {
           if (val.length < 7) {
             throw new Error("Please choose a longer password")
          }
       }
      }
    },
    salt: { type: DataTypes.STRING, allowNull: false}
  }, {
    classMethods: concern.classMethods,
    instanceMethods: concern.instanceMethods
  });
  return User;
};