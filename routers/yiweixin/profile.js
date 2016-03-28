var express = require('express');
var app = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var config = require("../../config")
var requireLogin = helpers.requireLogin
var _ = require('lodash')

app.get('/profile', requireLogin, function(req, res) {
  var customer = req.customer
  if(!customer){
    res.redirect('/auth')
    return
  }
  async.waterfall([function(next) {
    models.Banner.findAll({
      where: {
        active: true
      },
      order: [
          'sortNum', 'id'
      ]
    }).then(function(banners) {
      next(null, banners)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, banners) {
    res.render('yiweixin/customer/show', { customer: customer, banners: banners })
  })
})

app.get('/extractflow', requireLogin, function(req, res){
  res.render('yiweixin/orders/extractflow', { customer: req.customer })
})

app.post("/extractFlow", requireLogin, function(req, res){
  var customer = req.customer
  if(!req.body.phone){
    res.json({ err: 1, msg: "请输入手机号码" })
    return
  }
  async.waterfall([function(next){
    models.TrafficPlan.findById(req.body.flowId).then(function(trafficPlan){
      if(trafficPlan){
        next(null, trafficPlan)
      }else{
        res.json({ err: 1, msg: "请选择正确的流量包" })
      }
    })
  }, function(trafficPlan, next) {
    if(req.body.chargetype ===  'balance'){
      var enough = (customer.remainingTraffic > trafficPlan.cost)
    }else{
      var enough = (customer.salary > trafficPlan.cost)
    }

    if(enough){
      next(null, trafficPlan)
    }else{
      next(new Error("没有足够流量币"))
    }
  }, function(trafficPlan, next){
    var chargetype = (req.body.chargetype == "balance" ) ? models.Customer.CHARGETYPE.BALANCE : models.Customer.CHARGETYPE.SALARY

    models.ExtractOrder.build({
      exchangerType: trafficPlan.className(),
      exchangerId: trafficPlan.id,
      phone: req.body.phone,
      cost: trafficPlan.purchasePrice,
      value: trafficPlan.value,
      bid: trafficPlan.bid,
      customerId: customer.id,
      chargeType: chargetype,
      total: trafficPlan.cost
    }).save().then(function(extractOrder) {
      next(null, trafficPlan, extractOrder)
    }).catch(function(err) {
      next(err)
    })
  }, function(trafficPlan, extractOrder, next) {
    extractOrder.autoRecharge(trafficPlan).then(function(res, data) {
      console.log(data)
      if(trafficPlan.type == 1){  // 正规空中充值
        if(data.status == 1 || data.status == 2){
          next(null, trafficPlan, extractOrder)
        }else{
          extractOrder.updateAttributes({
            state: models.ExtractOrder.STATE.FAIL
          })
          next(new Error(data.msg))
        }
      }else if(trafficPlan.type == 2){
        // { code: 1, msg: '充值提交成功', taskid: 3881 }
        if(data.code == 1 && data.taskid != 0){
          extractOrder.updateAttributes({
            state: models.ExtractOrder.STATE.SUCCESS
          }).then(function(extractOrder){
            next(null, trafficPlan, extractOrder)
          }).catch(function(err) {
            next(err)
          })
        }else{
          extractOrder.updateAttributes({
            state: models.ExtractOrder.STATE.FAIL
          })
          next(new Error(data.Message))
        }
      }else{
        if(data.state == 1){
          extractOrder.updateAttributes({
            state: models.ExtractOrder.STATE.SUCCESS
          }).then(function(extractOrder){
            next(null, trafficPlan, extractOrder)
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
  }, function(trafficPlan, extractOrder, next){
    //
    customer.reduceTraffic(models, extractOrder, function(customer, extractOrder, trafficPlan, flowHistory) {
      next(null, customer, extractOrder)
    }, function(err) {
      next(err)
    })
  }], function(err, result){
    if(err){
      console.log(err)
      res.json({ err: 1, msg: err.message })
    }else{
      res.json({ err: 0, msg: "充值成功，请注意查收短信", url: "/profile" })
    }
  })
})

app.get('/getTrafficplans', requireLogin, function(req, res){
  var customer = req.customer
  if(models.TrafficPlan.Provider[req.query.catName] !== undefined || req.query.catName == "all"){
    var providerId = req.query.catName == "all" ?  Object.keys(models.TrafficPlan.ProviderName) : models.TrafficPlan.Provider[req.query.catName]
    async.waterfall([function(next) {
      models.DConfig.findOne({
        where: {
          name: 'disable'
        }
      }).then(function(dConfig) {
        if(dConfig && dConfig.value == "true"){
          res.json({ err: 4, msg: "服务器维护中" })
          return
        }else{
          next(null)
        }
      }).catch(function(err){
        next(err)
      })
    }, function(next) {
      if(customer.levelId){
        models.Level.findById(customer.levelId).then(function(level) {
          if(level.discount >= (config.blacklist || 3.00 )){
            res.json({ err: 4, msg: "服务器维护中" })
            return
          }else{
            customer.level = level
            next(null)
          }
        })
      }else{
        next(null)
      }
    }, function(outnext){
      models.Coupon.getAllActive(models).then(function(coupons) {
        outnext(null, coupons)
      }).catch(function(err) {
        outnext(err)
      })
    }, function(coupons, outnext) {
      models.TrafficPlan.getTrafficPlanByGroup(models, providerId, customer, coupons, outnext)
    }], function(err, result) {
      if(err){
        console.log(err)
        res.json({ err: 1, msg: "server err" })
      }else{
        res.json(result)
      }
    })
  }else{
    res.json({ err: 1, msg: "phone err" })
  }
})

app.get("/income", requireLogin, function(req, res){
  var customer = req.customer
  models.FlowHistory.incomeHistories({
    where: {
      customerId: customer.id
    }
  }, function(flowHistories){
    res.render('yiweixin/flowhistories/income', { flowHistories: flowHistories })
  }, function(err){
    console.log(err)
  })
})


app.get("/spend", requireLogin, function(req, res){
  var customer = req.customer
  models.FlowHistory.reduceHistories({
    where: {
      customerId: customer.id
    }
  }, function(flowHistories){
    res.render('yiweixin/flowhistories/spend', { flowHistories: flowHistories })
  }, function(err){
    console.log(err)
  })
})


app.get('/salary', requireLogin, function(req, res) {
  var customer = req.customer
  models.FlowHistory.findAll({
    where: {
      customerId: customer.id,
      trafficType: models.FlowHistory.TRAFFICTYPE.SALARY
    }
  }).then(function(flowhistories) {
    res.render('yiweixin/flowhistories/salary', { flowhistories: flowhistories })
  }).catch(function(err) {
    console.log(err)
  })
})

app.get('/orders', requireLogin, function(req, res) {
  var customer = req.customer

  async.waterfall([function(next) {
    customer.getExtractOrders({
      order:[
        ['updatedAt', 'DESC']
      ]
    }).then(function(extractOrders){
      next(null, extractOrders)
    }).catch(function(err){
      next(err)
    })
  }, function(extractOrders, next){
    var trafficPlanIds = extractOrders.map(function(o, i){
      if(o.exchangerType == "TrafficPlan"){
        return o.exchangerId
      }
    }).compact()
    trafficPlanIds = _.union(trafficPlanIds)
    next(null, extractOrders, trafficPlanIds)
  }, function(extractOrders, trafficPlanIds, next) {
    models.TrafficPlan.findAll({
      where: {
        id: trafficPlanIds
      }
    }).then(function(trafficPlans){
      next(null, extractOrders, trafficPlans)
    }).catch(function(err){
      next(err)
    })
  }, function(extractOrders, trafficPlans, next){
    for (var i = 0; i < extractOrders.length; i++) {
      for (var j = 0; j < trafficPlans.length; j++) {
        if(trafficPlans[j].id == extractOrders[i].exchangerId){
          extractOrders[i].trafficPlan = trafficPlans[j]
          break
        }
      };
    };
    next(null, extractOrders, trafficPlans)
  }, function(extractOrders, trafficPlans, next){
    var list = customer.getAncestry()
    if(list.length > 0){
      models.Customer.findById(list[list.length - 1]).then(function(parent) {
        next(null, extractOrders, trafficPlans, parent)
      })
    }else{
      next(null, extractOrders, trafficPlans, {})
    }
  }], function(err, extractOrders, trafficPlans, parent){
    if(err){
      console.log(err)
      res.redirect('/500')
    }else{
      res.render("yiweixin/flowhistories/myorders", { extractOrders: extractOrders, customer: customer, parent: parent })
    }
  })

})

module.exports = app;