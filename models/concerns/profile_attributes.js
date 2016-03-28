'use strict';
var crypto = require('crypto');

module.exports = {
  classMethods: {
    authorization: function(username, password, callback) {
      this.find({ where: {username: username} }).on('success', function(user) {
        if(user.verifyPassword(password)){
          callback(user)
        }
      }).on('error', function(error) {
        callback(error)
      })
    },
    encryptPassword: function(password, salt) {
      return crypto.createHmac('sha1', salt).update(password).digest('hex');
    }
  },
  instanceMethods: {
    resetPassword: function(password) {
      this.password = password
      return this.save()
    },
    verifyPassword: function(password) {
      return this.encryptPassword(password) == this.password_hash
    },
    makeSalt: function(){
      return Math.round((new Date().valueOf() * Math.random())) + '';
    },
    encryptPassword: function(password) {
      return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
    }
  }
}