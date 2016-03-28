'use strict';

var request = require("request")
var async = require("async")
var helpers = require("../helpers")
var config = require("../config")
var crypto = require('crypto')


var YiliuliangRecharger = function(phone, typeid, orderId){
  // type = 3
  this.phone = phone
  this.typeid = typeid
  this.orderId = orderId

  this.username = config.yiliuliang_user
  this.password = config.yiliuliang_pwd

  var host = 'http://' + config.yiliuliang + "/admin.php/Charged/apicharge"

  var params = {
    username: this.username,
    password: this.password,
    mobile: this.phone,
    typeid: this.typeid
  }

  this.options = {
    uri: host,
    method: 'GET',
    qs: params
  }

  console.log(this.options)

  this.then = function(callback){
    this.successCallback = callback
    return this
  }

  this.catch = function(callback){
   this.errCallback = callback
   return this
  }

  this.do = function(){

  var inerSuccessCallback = this.successCallback;
  var inerErrCallback = this.errCallback;

  request(this.options, function (error, res) {
    if (!error && res.statusCode == 200) {
      if(inerSuccessCallback){
        console.log(res.body)
        var data = JSON.parse(res.body.trim())
        inerSuccessCallback.call(this, res, data)
      }
     }else{
      if(inerErrCallback){
        inerErrCallback.call(this, error)
      }
     }
   });

   return this
 }
 return this
}

module.exports = function(sequelize, DataTypes) {
  var ExtractOrder = sequelize.define('ExtractOrder', {
    state: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    exchangerType: { type: DataTypes.STRING, allowNull: false },
    exchangerId: { type: DataTypes.INTEGER, allowNull: false },
    phone: {  type: DataTypes.STRING, allowNull: true },
    cost: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0.0 },
    extend: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    value: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    type: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    bid: { type: DataTypes.STRING, allowNull: true },
    customerId: { type: DataTypes.INTEGER, allowNull: true },
    chargeType: { type: DataTypes.STRING, allowNull: false, defaultValue: "balance" },
    transactionId: { type: DataTypes.INTEGER },
    paymentMethodId: { type: DataTypes.INTEGER },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0.0 },
    taskid: { type: DataTypes.STRING, allowNull: true }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        models.ExtractOrder.belongsTo(models.TrafficPlan, {
          foreignKey: 'exchangerId',
          scope: {
            exchangerType: 'TrafficPlan'
          }
        });
        models.ExtractOrder.belongsTo(models.Customer, {
          foreignKey: 'customerId',
          scope: {
            exchangerType: 'Customer'
          }
        });
      }
    },
    instanceMethods: {
      isDone: function() {
        return (this.state === ExtractOrder.STATE.SUCCESS)
      },
      className: function() {
        return "ExtractOrder";
      },
      getExchanger: function(conditions){
        return this['get' + this.exchangerType].call(this, conditions)
      },
      stateName: function(){
        if(this.state === ExtractOrder.STATE.INIT){
          return "等待付款"
        }else if(this.state === ExtractOrder.STATE.SUCCESS){
          return "充值任务提交成功"
        }else if(this.state === ExtractOrder.STATE.FAIL){
          return "失败"
        }else if(this.state === ExtractOrder.STATE.PAID){
          return "付款成功"
        }else if(this.state === ExtractOrder.STATE.UNPAID){
          return "付款失败"
        }else if(this.state === ExtractOrder.STATE.REFUNDED){
          return "退款"
        }else if(this.state === ExtractOrder.STATE.FINISH){
          return "充值成功"
        }
      },
      autoRecharge: function(trafficPlan){
        return new YiliuliangRecharger(this.phone, this.bid, this.id)
      },
      isPaid: function(){
        return (this.state === ExtractOrder.STATE.PAID)
      }
    }
  });

  ExtractOrder.STATE = {
    INIT: 0,
    PAID: 1,
    UNPAID: 2,
    SUCCESS: 3,
    FAIL: 4,
    REFUNDED: 5,
    FINISH: 6
  }

  ExtractOrder.STATEARRAY = Object.keys(ExtractOrder.STATE).map(function(k) { return [ExtractOrder.STATE[k], k] });

  return ExtractOrder;
};