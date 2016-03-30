var express = require('express');
var app = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var formidable = require('formidable')
var async = require("async")
var OAuth = require('wechat-oauth');
var config = require("../../config")

var client = new OAuth(config.appId, config.appSecret);

app.get('/', function(req, res) {
  res.redirect("/extractflow")
})

app.get('/auth', function(req, res) {
  var encodeUrl = req.query.to

  var url = client.getAuthorizeURL('http://' + config.hostname + '/register' + ( encodeUrl ? ("?to=" + encodeUrl) : "" ), '111111', 'snsapi_userinfo');
  res.redirect(url)
})

app.get('/register', function(req, res) {
  var code = req.query.code
  async.waterfall([function(next) {
    if(code){
      client.getAccessToken(code, function (err, result) {
        if(err){
          next(err)
        }else if(result.data){
          var accessToken = result.data.access_token;
          var openid = result.data.openid;
          next(null, accessToken, openid)
        }else{
          next(new Error('not found'))
        }
      });
    }else{
      next(new Error('user not allow login with wechat'))
    }
  }, function(accessToken, openid, next) {
    models.Customer.findOne({
      where: {
        wechat: openid
      }
    }).then(function (customer) {
      if(customer){
        req.session.customer_id = customer.id
        if(req.query.to){
          var backTo = new Buffer(req.query.to, "base64").toString()
          res.redirect(backTo)
        }else{
          res.redirect('/myaccount')
        }
        return
      }else{
        next(null, accessToken, openid)
      }
    })

  }, function(accessToken, openid, next) {
    client.getUser(openid, function (err, result) {
      if(err){
        next(err)
      }
      var userInfo = result;
      next(null, accessToken, openid, userInfo)
    });
  }, function(accessToken, openid, userInfo, next) {
    models.Customer.build({
      password: '1234567',
      username: userInfo.nickname,
      wechat: openid,
      sex: userInfo.sex + '',
      city: userInfo.city,
      province: userInfo.province,
      country: userInfo.country,
      headimgurl: userInfo.headimgurl,
      bindPhone: true
    }).save().then(function(customer){
      if(customer){
        customer.updateAttributes({
          lastLoginAt: new Date()
        }).then(function(customer){
        })
        req.session.customer_id = customer.id
        if(req.query.to){
          var backTo = new Buffer(req.query.to, "base64").toString()
          res.redirect(backTo)
        }else{
          res.redirect('/myaccount')
        }
        return
      }else{
        next({errors: "create fail"})
      }
    }).catch(function(err){
      next(err)
    })
  }], function(err) {
    if(err){
      console.log(err)
      var url = '/auth'
      if(req.query.to){
        url = url + '?to=' + req.query.to
      }
      res.redirect(url)
    }else{
      res.render('register', { layout: 'main' })
    }
  })
})


module.exports = app;