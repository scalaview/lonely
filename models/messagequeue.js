'use strict';
var request = require("request")
var async = require("async")
var helpers = require("../helpers")
var config = require("../config")

var MessageSender = function(phone, content){
  this.phone = phone
  this.content = content
  this.headers = {
    'User-Agent':       'Super Agent/0.0.1',
    'Content-Type':     'application/x-www-form-urlencoded'
  }
  this.options = {
    uri: config.yunpian,
    method: 'POST',
    headers: this.headers,
    qs: {
      apikey: config.apikey,
      text: this.content,
      mobile: this.phone
    }
  }

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

  request(this.options, function (error, res, data) {
    if (!error && res.statusCode == 200) {
      if(inerSuccessCallback){
        inerSuccessCallback.call(this. res, data)
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
  var MessageQueue = sequelize.define('MessageQueue', {
    phone: {  type: DataTypes.STRING, allowNull: false},
    content: {  type: DataTypes.STRING, allowNull: true},
    state: {  type: DataTypes.INTEGER, allowNull: false, defaultValue: 0},
    type: {
      type: DataTypes.INTEGER,
      allowNull: false,
      set: function(val){
        if(MessageQueue.messageType[val] !== undefined){
          this.setDataValue('type', MessageQueue.messageType[val])
        }else{
          throw new Error("Please input a correct message type");
        }
      }
    },
    sendAt: { type: DataTypes.DATE, allowNull: true},
    verificationCode: { type: DataTypes.STRING, allowNull: true},
    retryTime: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0},
    typeName: {
      type: DataTypes.VIRTUAL,
      get: function(){
        switch(this.type){
          case MessageQueue.messageType.register:
            return "注册短信"
        }
      }
    },
    stateName: {
      type: DataTypes.VIRTUAL,
      get: function(){
        switch(this.state){
          case MessageQueue.stateType.onHold:
            return "待处理"
          case MessageQueue.stateType.send:
            return "已发送"
          case MessageQueue.stateType.fail:
            return "发送失败"
        }
      }
    },
    templateId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        models.MessageQueue.belongsTo(models.MessageTemplate, { foreignKey: 'templateId' });
      },
      canSendMessage: function(phone, type, callback) {
        if (MessageQueue.messageType[type] !== undefined){
          MessageQueue.findOne({ where: {
            phone: phone,
            type: MessageQueue.messageType[type],
            $or: [
              { sendAt: {gt: new Date((new Date()).getTime() - 60 * 1000)} },
              { createdAt: {gt: new Date((new Date()).getTime() - 60 * 1000)} }
            ]
          } }).then(callback);
        } else {
          throw new Error("Please input a correct message type");
        }
      },
      sendRegisterMessage: function(models, phone, successCallBack, errorCallBack){

        async.waterfall([function(next){
          models.MessageTemplate.findOne({
            where: {
              name: "register message"
            }
          }).then(function(messageTemplate) {
            if(messageTemplate){
              next(null, messageTemplate)
            }else{
              next(null, null)
            }
          })
        }, function(messageTemplate, next) {
          var num = Math.floor(Math.random() * 90000) + 10000;
          if(messageTemplate){
            // var content = messageTemplate.content.format({ code: num, company: '云片网'  })
            var content = messageTemplate.content.format({ code: num, company: '广州孚技网络科技'  })
          }else{
            var content = "易流量注册。你的注册验证码：{{code}}".format({ code: num })
          }
          MessageQueue.build({
            phone: phone,
            content: content,
            type: "register",
            verificationCode: num + '',
            templateId: messageTemplate.id
          }).save().then(function(messageQueue) {
            next(null, messageQueue)
          }).catch(function(err) {
            next(err)
          })
        }, function(messageQueue, next) {
          async.waterfall([function(next) {
            var sender = messageQueue.sender()
            sender.then(function(dataStr) {
              console.log('data: ' + dataStr)
              var data = JSON.parse(dataStr)
              if(data.code === 0){
                var sendState = MessageQueue.stateType.send
              }else{
                var sendState = MessageQueue.stateType.fail
              }
              messageQueue.updateAttributes({
                state: sendState,
                sendAt: new Date()
              }).then(function(messageQueue){
                next(null, messageQueue)
              }).catch(function(err){
                next(err)
              })
            }).catch(function(err) {
              console.log(err)
              if(messageQueue.retryTime < MessageQueue.MAXRETRYTIME){
                messageQueue.updateAttributes({
                  retryTime: messageQueue.retryTime + 1
                }).then(function(messageQueue){
                  setTimeout(function(){
                    sender.do()
                  }, MessageQueue.RETRYINTERVAL)
                }).catch(function(err){
                  console.log("update retry time fail")
                  content.log(err)
                })
              }else{
                messageQueue.updateAttributes({
                  state: MessageQueue.stateType.fail,
                }).then(function(messageQueue){
                }).catch(function(err){
                  next(err)
                })
              }
            }).do()
          }], function(err, messageQueue) {
            if(err){
              console.log(err)
            }
          })
          next(null, messageQueue)
        }], function(err, messageQueue) {
          if(err){
            console.log(err)
            errorCallBack(err)
          }else{
            successCallBack(messageQueue)
          }
        })

        //TODO
      },
      sendRechargeMsg: function(models, trafficPlan, phone, successCallBack, errorCallBack) {
        async.waterfall([function(next) {
          models.MessageTemplate.findOne({
            where: {
              name: "recharge message"
            }
          }).then(function(messageTemplate) {
            if(messageTemplate){
              next(null, messageTemplate)
            }else{
              next(null, null)
            }
          })
        }, function(messageTemplate, next) {
          if(messageTemplate){
            var content = messageTemplate.content.format({ phone: phone, plan: trafficPlan.name })
          }else{
            var content = "尊敬的{{phone}}用户，您好，您通过[星客万维]微信公众号充值的{{plan}}已经提交，将在两个小时内到账。如未成功到账，请关注[星客万维]公众号查询流量充值进度。".format({ phone: phone, plan: trafficPlan.name })
          }
          console.log(phone)
          MessageQueue.build({
            phone: phone,
            content: content,
            type: "recharge",
            templateId: messageTemplate.id
          }).save().then(function(messageQueue) {
            next(null, messageQueue)
          }).catch(function(err) {
            next(err)
          })
        }, function(messageQueue, next) {
          //
          async.waterfall([function(next) {
            var sender = messageQueue.sender()
            sender.then(function(dataStr) {
              console.log('data: ' + dataStr)
              var data = JSON.parse(dataStr)
              if(data.code === 0){
                var sendState = MessageQueue.stateType.send
              }else{
                var sendState = MessageQueue.stateType.fail
              }
              messageQueue.updateAttributes({
                state: sendState,
                sendAt: new Date()
              }).then(function(messageQueue){
                next(null, messageQueue)
              }).catch(function(err){
                next(err)
              })
            }).catch(function(err) {
              console.log(err)
              if(messageQueue.retryTime < MessageQueue.MAXRETRYTIME){
                messageQueue.updateAttributes({
                  retryTime: messageQueue.retryTime + 1
                }).then(function(messageQueue){
                  setTimeout(function(){
                    sender.do()
                  }, MessageQueue.RETRYINTERVAL)
                }).catch(function(err){
                  console.log("update retry time fail")
                  content.log(err)
                })
              }else{
                messageQueue.updateAttributes({
                  state: MessageQueue.stateType.fail,
                }).then(function(messageQueue){
                }).catch(function(err){
                  next(err)
                })
              }
            }).do()
          }], function(err, messageQueue) {
            if(err){
              console.log(err)
            }
          })
          next(null, messageQueue)
          //
        }], function(err, messageQueue) {
          if(err){
            console.log(err)
            errorCallBack(err)
          }else{
            successCallBack(messageQueue)
          }
        })
      },
      verifyCode: function(phone, code, type, successCallBack, errorCallBack){
        if (MessageQueue.messageType[type] !== undefined){
          MessageQueue.findOne({ where: {
            phone: phone,
            type: MessageQueue.messageType[type],
            verificationCode: code,
            sendAt: {gt: new Date((new Date()).getTime() - 30 * 60 * 1000)}
          } }).then(successCallBack).catch(errorCallBack)
        }else{
          throw new Error("Please input a correct message type");
        }
      }
    },
    instanceMethods: {
      sender: function(){
        return new MessageSender(this.phone, this.content)
      }
    }
  });
  MessageQueue.messageType = {
    register: 0,
    recharge: 1
  }

  MessageQueue.stateType = {
    onHold: 0,
    send: 1,
    fail: 2
  }
  MessageQueue.MAXRETRYTIME = 3
  MessageQueue.RETRYINTERVAL = 20000


  return MessageQueue;
};