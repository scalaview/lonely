'use strict';
var async = require("async")

module.exports = function(sequelize, DataTypes) {
  var FlowHistory = sequelize.define('FlowHistory', {
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    state: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: true },
    typeId: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
    comment: { type: DataTypes.STRING, allowNull: false },
    source: {
      type: DataTypes.VIRTUAL,
      get: function(){
        return this.order || this.extractOrder || this.apk || this.customer
      }
    },
    trafficType:{
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "remainingTraffic"
    }
  }, {
    classMethods: {
      associate: function(models) {
        models.FlowHistory.belongsTo(models.Customer, { foreignKey: 'customerId' });
        models.FlowHistory.belongsTo(models.ExtractOrder, {
          foreignKey: 'typeId',
          scope: {
            type: 'ExtractOrder'
          }
        });

        models.FlowHistory.belongsTo(models.Customer, {
          foreignKey: 'typeId',
          scope: {
            type: 'Customer'
          }
        });
      },
      histories: function(options, state, successCallBack, errCallBack){
        FlowHistory.scope(state).findAll(options || {}).then(function(flowHistories) {
          async.map(flowHistories, function(flowHistory, next){
            if( state === 'income' ){
              flowHistory.getOrder().then(function(order) {
                flowHistory.source = order
                next(null, flowHistory)
              }).catch(function(err){
                next(err)
              })
            }else{
              flowHistory.getExtractOrder().then(function(extractOrder) {
                flowHistory.source = extractOrder
                next(null, flowHistory)
              }).catch(function(err){
                next(err)
              })
            }
          } , function(err, flowHistories){
            if(err){
              errCallBack(err)
            }else{
              successCallBack(flowHistories)
            }
          })
        })
      },
      incomeHistories: function(options, successCallBack, errCallBack){
        this.histories(options, 'income', successCallBack, errCallBack)
      },
      reduceHistories: function(options, successCallBack, errCallBack){
        this.histories(options, 'reduce', successCallBack, errCallBack)
      }
    },
    scopes: {
      income: {
        where: {
          state: 1
        },
        order: [
          ['createdAt', 'DESC']
        ]
      },
      reduce: {
        where: {
          state: 0
        },
        order: [
          ['createdAt', 'DESC']
        ]
      }
    },
    instanceMethods: {
      getSource: function(conditions){
        if(this.type){
          return this['get' + this.type].call(this, conditions)
        }
      },
      stateName: function(){
        switch(this.state){
          case 1:
            return "增加"
          case 0:
            return "减少"
        }
      }
    }
  });
  FlowHistory.STATE = {
    ADD: 1,
    REDUCE: 0
  };

  FlowHistory.TRAFFICTYPE = {
    REMAININGTRAFFIC: 'remainingTraffic',
    SALARY: 'salary'
  };

  return FlowHistory;
};