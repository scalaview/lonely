'use strict';
var _ = require('lodash')
var async = require("async")
var config = require("../config")

module.exports = function(sequelize, DataTypes) {
  var Coupon = sequelize.define('Coupon', {
    name: {
      type: DataTypes.STRING
    },
    trafficPlanId: {
      type: DataTypes.INTEGER
    },
    discount: {
      type: DataTypes.FLOAT,
      defaultValue: 0.00
    },
    extend: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    ignoreLevel: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    expiredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      },
      getAllActive: function(models, params){
        var condition = {
          where: {
            isActive: true,
            expiredAt: {
              $gt: (new Date()).begingOfDate()
            }
          },
          order: [
                  ['updatedAt', 'DESC']
                 ]
        }
        if(params){
          condition = _.merge(condition, params)
        }
        return models.Coupon.findAll(condition)
      }
    }
  });
  return Coupon;
};