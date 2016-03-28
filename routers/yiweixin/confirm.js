var express = require('express');
var app = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var requireLogin = helpers.requireLogin
var config = require("../../config")
var WechatAPI = require('wechat-api');

var api = helpers.API

app.get("/taskconfirm/:id", function(req, res) {  //流量任务confirm接口
  var id = req.params.id,
      token = req.query.token,
      phone = req.query.phone
  if(! id.match(/\d/)){
    res.redirect('/404');
    return
  }
  if(!(id && token && phone)) {
    res.json({ err: 1 , code: 1001, msg: "参数缺失"})
  }

  async.waterfall([function(next){
    models.Seller.findOne({
      where: {
        accessToken: token
      }
    }).then(function(seller) {
      next(null, seller)
    }).catch(function(err) {
      next(err)
    })
  }, function(seller, next) {
    models.FlowTask.findOne({
      where: {
        id: id,
        seller_id: seller.id,
        isActive: true,
        expiredAt: {
          $gt: (new Date()).begingOfDate()
        }
      }
    }).then(function(flowtask) {
      if(flowtask){
        next(null, seller, flowtask)
      }else{
        res.json({ err: 1, code: 1004, msg: "没有找到对应的任务"})
      }
    }).catch(function(err) {
      next(err)
    })
  }, function(seller, flowtask, next) {
    models.TrafficPlan.findById(flowtask.trafficPlanId).then(function(trafficPlan) {
      next(null, seller, flowtask, trafficPlan)
    }).catch(function(err) {
      next(err)
    })
  }, function(seller, flowtask, trafficPlan, next){
    models.ExtractOrder.build({
      exchangerType: flowtask.className(),
      exchangerId: flowtask.id,
      phone: phone,
      cost: trafficPlan.purchasePrice,
      value: trafficPlan.value,
      bid: trafficPlan.bid
    }).save().then(function(extractOrder) {
      next(null, seller, flowtask, trafficPlan, extractOrder)
    }).catch(function(err) {
      next(err)
    })
  }, function(seller, flowtask, trafficPlan, extractOrder, next) {
    extractOrder.autoRecharge(trafficPlan).then(function(res, data) {
      console.log(data)
      if(trafficPlan.bid){  // 正规空中充值
        if(data.status == 1 || data.status == 2){
          next(null, seller, flowtask, trafficPlan, extractOrder)
        }else{
          extractOrder.updateAttributes({
            state: models.ExtractOrder.STATE.FAIL
          })
          next(new Error(data.msg))
        }
      }else{
        if(data.state == 1){
          extractOrder.updateAttributes({
            state: models.ExtractOrder.STATE.SUCCESS
          }).then(function(extractOrder){
            next(null, seller, flowtask, trafficPlan, extractOrder)
          }).catch(function(err) {
            next(err)
          })
        }else{
          extractOrder.updateAttributes({
            state: models.ExtractOrder.STATE.FAIL
          })
          next(new Error(data.msg))
        }
      }
    }).catch(function(err){
      next(err)
    }).do()
  }, function(seller, flowtask, trafficPlan, extractOrder, next) {
    // finishTime
    flowtask.updateAttributes({
      finishTime: flowtask.finishTime + 1
    }).then(function(flowtask) {
      next(null, seller, flowtask, trafficPlan, extractOrder)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, seller, flowtask, trafficPlan, extractOrder){
    if(err){
      console.log(err)
      res.json({ err: 1, code: 1003, msg: err.msg || "参数错误"})
    }else{
      res.json({
        err: 0, msg: "confirm success"
      })
    }
  })

})

app.get('/extractflowconfirm', function(req, res) {
  var id = req.query.orderid,
      phone = req.query.phone
  if(id === undefined || id === '' || phone === undefined || phone === '' ){
    res.send('error')
    return
  }
  async.waterfall([function(next) {
    models.ExtractOrder.findOne({
      where: {
        id: id,
        phone: phone,
        state: models.ExtractOrder.STATE.INIT
      }
    }).then(function(extractorder) {
      if(extractorder){
        next(null, extractorder)
      }else{
        res.send('success')
        return
      }
    }).catch(function(err) {
      next(err)
    })
  }, function(extractorder, next) {
    extractorder.updateAttributes({
      state: models.ExtractOrder.STATE.SUCCESS
    }).then(function(extractorder) {
      next(null, extractorder)
    }).catch(function(err) {
      next(err)
    })
  }, function(extractorder, next) {
    extractorder.getExchanger().then(function(trafficPlan) {
      next(null, extractorder, trafficPlan)
    }).catch(function(err) {
      next(err)
    })
  }, function(extractorder, trafficPlan, next) {
    models.MessageQueue.sendRechargeMsg(models, trafficPlan, extractorder.phone, function(messageQueue) {
      next(null)
    }, function(err) {
      next(err)
    })
  }], function(err, extractorder) {
    if(err){
      console.log(err)
      res.send('err')
    }else{
      res.send('success')
    }
  })
})

app.post('/extractflowdefaultconfirm', function(req, res) {
  var body = req.rawBody
      console.log(body)
  var id = body.dorderid,
      phone = body.mobile
  if(id === undefined || id === '' || phone === undefined || phone === '' ){
    res.send('error')
    return
  }
  async.waterfall([function(next) {
    models.ExtractOrder.findOne({
      where: {
        id: id,
        phone: phone,
        state: models.ExtractOrder.STATE.PAID
      }
    }).then(function(extractorder) {
      if(extractorder){
        next(null, extractorder)
      }else{
        res.send('0')
        return
      }
    }).catch(function(err) {
      next(err)
    })
  }, function(extractorder, next) {
    if(extractorder.customerId){  // 正规充值
      extractorder.getCustomer().then(function(customer) {
        next(null, extractorder, customer)
      }).catch(function(err) {
        next(err)
      })
    }else{  // 流量任务奖励
      next(null, extractorder, null)
    }
  },function(extractorder, customer, next) {
    var status = models.ExtractOrder.STATE.FAIL
    if(body.status === 1){
      status = models.ExtractOrder.STATE.SUCCESS
      next(null, extractorder, status)
    }else{
      if(customer){
        customer.refundTraffic(models, extractorder, body.msg, function(customer, extractorder, flowHistory) {

          // send notice
          sendRefundNotice(customer, extractorder, body.msg)

          next(null, extractorder, status)
        }, function(err) {
          next(err)
        })
      }else{
        next(null, extractorder, status)
      }
    }
  }, function(extractorder, status, next) {
    extractorder.updateAttributes({
      state: status
    }).then(function(extractorder) {
      next(null, extractorder)
    }).catch(function(err) {
      next(err)
    })
  }, function(extractorder, next) {
    extractorder.getExchanger().then(function(exchanger) {
      if(exchanger.className() === 'TrafficPlan'){
        next(null, extractorder, exchanger)
      }else{
        exchanger.getTrafficPlan().then(function(trafficPlan) {
          next(null, extractorder, trafficPlan)
        }).catch(function(err) {
          next(err)
        })
      }
    }).catch(function(err) {
      next(err)
    })
  }, function(extractorder, trafficPlan, next) {
    if(extractorder.status === models.ExtractOrder.STATE.SUCCESS){
      models.MessageQueue.sendRechargeMsg(models, trafficPlan, extractorder.phone, function(messageQueue) {
        next(null, extractorder)
      }, function(err) {
        next(err)
      })
    }else{
      next(null, extractorder)
    }
  }], function(err, extractorder) {
    if(err){
      console.log(err)
      res.send('err')
    }else{
      res.send('0')
    }
  })
})


app.post('/huawoconfirm', function(req, res){
  console.log(req.rawBody)
  console.log(req.body)
  var bodyStr = req.rawBody || req.body,
      startIndex = bodyStr.indexOf("{"),
      endIndex = bodyStr.lastIndexOf("}"),
      bodyStr = bodyStr.substring(startIndex, endIndex + 1)
  if(!bodyStr){
    res.json({status: 0, msg: "error"})
    return
  }

  var body = JSON.parse(bodyStr),
      code = body.code,
      msg = body.msg,
      reports = body.reports || []
      console.log(body)
  if(code === undefined || reports.length <= 0 ){
    res.json({status: 0, msg: "error"})
    return
  }

  async.each(reports, function(report, pass) {
    confirmOrder({
       taskid: report.taskid,
       state: models.ExtractOrder.STATE.SUCCESS
    }, report.status == 3, report.msg, pass)
  }, function(err){
    if(err){
      console.log(err)
    }
    res.json({status: 1, msg: "success"})
  })
})


function confirmOrder(params, isDone, msg, pass){
    async.waterfall([function(next) {
      models.ExtractOrder.findOne({
        where: params
      }).then(function(extractorder) {
        if(extractorder){
          next(null, extractorder)
        }else{
          pass(null)
          return
        }
      }).catch(function(err) {
        next(err)
      })
    }, function(extractorder, next){
      if(extractorder.customerId){  // 正规充值
        extractorder.getCustomer().then(function(customer) {
          next(null, extractorder, customer)
        }).catch(function(err) {
          next(err)
        })
      }else{  // 流量任务奖励
        next(null, extractorder, null)
      }
    }, function(extractorder, customer, next){
      var status = models.ExtractOrder.STATE.FAIL
      if(isDone){
        status = models.ExtractOrder.STATE.FINISH
        next(null, extractorder, status)
      }else{
        if(customer){
          customer.refundTraffic(models, extractorder, msg, function(customer, extractorder, flowHistory) {

            // send notice
            sendRefundNotice(customer, extractorder, msg)

            next(null, extractorder, status)
          }, function(err) {
            next(err)
          })
        }else{
          next(null, extractorder, status)
        }
      }
    }, function(extractorder, status, next) {
      extractorder.updateAttributes({
        state: status
      }).then(function(extractorder) {
        next(null, extractorder)
      }).catch(function(err) {
        next(err)
      })
    }, function(extractorder, next) {
      extractorder.getExchanger().then(function(exchanger) {
        if(exchanger.className() === 'TrafficPlan'){
          next(null, extractorder, exchanger)
        }else{
          exchanger.getTrafficPlan().then(function(trafficPlan) {
            next(null, extractorder, trafficPlan)
          }).catch(function(err) {
            next(err)
          })
        }
      }).catch(function(err) {
        next(err)
      })
    }, function(extractorder, trafficPlan, next) {
      if(extractorder.status === models.ExtractOrder.STATE.FINISH){
        models.MessageQueue.sendRechargeMsg(models, trafficPlan, extractorder.phone, function(messageQueue) {
          next(null, extractorder)
        }, function(err) {
          next(err)
        })
      }else{
        next(null, extractorder)
      }
    }], function(err, extractorder){
        if(err){
          console.log(err)
        }
        pass(null)
    })
}

function sendRefundNotice(customer, extractOrder, resean){

  async.waterfall([function(next) {

    extractOrder.getTrafficPlan().then(function(trafficPlan) {
      extractOrder.trafficPlan = trafficPlan
      next(null, trafficPlan)
    }).catch(function(err) {
      next(err)
    })

  }, function(trafficPlan, next) {
    if(extractOrder.chargeType == models.Customer.CHARGETYPE.BALANCE){
      var content = "订单：{{orderid}}, 您充值的{{name}}套餐充值失败, 充值号码{{phone}}，原因: {{resean}}。 凭此信息联系客服退还费用 {{value}}。感谢您使用, 对您造成的不便我们万分抱歉"
    }else{
      var content = "订单：{{orderid}}, 您充值的{{name}}套餐充值失败, 充值号码{{phone}}，原因: {{resean}}。 {{value}}分销奖励已经返回您的账户，感谢您使用, 对您造成的不便我们万分抱歉"
    }
    models.MessageTemplate.findOrCreate({
        where: {
          name: "sendRefundNotice"
        },
        defaults: {
          content: content
        }
      }).spread(function(template) {
        var content = template.content.format({ orderid: extractOrder.id, name: trafficPlan.name, phone: extractOrder.phone, resean: resean, value: extractOrder.total })
        next(null, content)
      }).catch(function(err) {
        next(err)
      })

  }, function(content, next) {
    api.sendText(customer.wechat, content, function(err, result) {
      if(err){
        next(err)
      }else{
        next(null, result)
      }
    });
  }], function(err, result) {
    if(err){
      console.log(err)
    }else{
      console.log(result)
    }
  })
}

app.post('/liuliangshopconfirm', function(req, res){
  console.log(req.body)
  var bodyStr = req.body
  if(!bodyStr){
    res.json({status: 0, msg: "error"})
    return
  }
  var body = bodyStr,
      notify_type = body.notify_type,
      code = body.errcode,
      msg = body.errmsg,
      order = body.order
      console.log(body)

  if(notify_type !== 'recharge_result'){
    res.json({status: 0, msg: "error"})
    return
  }

  confirmOrder({
    state: models.ExtractOrder.STATE.SUCCESS,
    phone: order.number,
    taskid: order.transaction_id
  }, code == 0, msg, function(err){
    if(err){
      console.log(err)
      res.json({status: 1, msg: "success"})
    }else{
      res.json({status: 1, msg: "success"})
    }
  })
})

module.exports = app;