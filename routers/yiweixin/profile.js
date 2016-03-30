var express = require('express');
var app = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")
var config = require("../../config")
var requireLogin = helpers.requireLogin
var _ = require('lodash')


app.get('/extractflow', requireLogin, function(req, res){
  res.render('yiweixin/orders/extractflow', { customer: req.customer })
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

module.exports = app;