var express = require('express');
var app = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var formidable = require('formidable')
var async = require("async")
var OAuth = require('wechat-oauth');
var config = require("../../config")


// var client = new OAuth(config.appId, config.appSecret, function (openid, callback) {
//   // 传入一个根据openid获取对应的全局token的方法
//   fs.readFile(openid +':access_token.txt', 'utf8', function (err, txt) {
//     if (err) {return callback(err);}
//     callback(null, JSON.parse(txt));
//   });
// }, function (openid, token, callback) {
//   // 请将token存储到全局，跨进程、跨机器级别的全局，比如写到数据库、redis等
//   // 这样才能在cluster模式及多机情况下使用，以下为写入到文件的示例
//   // 持久化时请注意，每个openid都对应一个唯一的token!
//   fs.writeFile(openid + ':access_token.txt', JSON.stringify(token), callback);
// });

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

app.post('/register', function(req, res){
  if(!req.body.phone ){
    res.json({ msg: '请输入手机号码', code: 0 })
    return
  }
  if(!req.session.userInfo || !req.session.openid){
    res.json({ msg: '微信授权失败', code: 1005 })
    return
  }
  models.MessageQueue.verifyCode(req.body.phone, req.body.code, 'register', function(messageQueue){
    if(messageQueue){

      async.waterfall([function(next) {
        models.Customer.findOne({
          where: {
            wechat: req.session.openid
          }
        }).then(function(one) {
          if(one){
            one.updateAttributes({
                phone: req.body.phone,
                lastLoginAt: new Date(),
                bindPhone: true
              }).then(function(one) {
                req.session.customer_id = one.id
                next(null, one)
              }).catch(function(err) {
                next(err)
              })
          }else{
            models.Customer.build({
              password: '1234567',
              phone: req.body.phone,
              username: req.session.userInfo.nickname,
              wechat: req.session.openid,
              sex: req.session.userInfo.sex + '',
              city: req.session.userInfo.city,
              province: req.session.userInfo.province,
              country: req.session.userInfo.country,
              headimgurl: req.session.userInfo.headimgurl,
              bindPhone: true
            }).save().then(function(customer){
              if(customer){
                customer.updateAttributes({
                  lastLoginAt: new Date()
                }).then(function(customer){
                })
                delete req.session.userInfo
                delete req.session.openid
                req.session.customer_id = customer.id
                next(null, customer)
              }else{
                next({errors: "create fail"})
              }
            }).catch(function(err){
              next(err)
            })
          }

        }).catch(function(err) {
          next(err)
        })

      }], function(err) {
        if(err){
          console.log(err)
          res.json({ msg: 'create fail', code: 0, err: err.errors })
        }else{
          res.json({ msg: 'create success', code: 1 })
        }
      })

    }else{
      res.json({ msg: '没有找到验证码或者验证码已经过期', code: 0 })
    }
  }, function(err) {
    console.log(err)
    res.json({ msg: 'server error', code: 0, err: err.errors })
  })
})

app.get('/getcode', function(req, res) {
  if(!req.query.phone){
    res.json({ msg: '请输入手机号码', code: 0 })
    return
  }
  models.MessageQueue.canSendMessage(req.query.phone, 'register', function(messageQueue) {
    if(messageQueue){
      res.json({ msg: "Please try again after 1 minite", code: 2 });
    }else{
      models.MessageQueue.sendRegisterMessage(models, req.query.phone, function(messageQueue){
        if(messageQueue){
          res.json({ msg: "message had send", code: 1 })
        }
      }, function(err){
        console.log(err)
        res.json({ msg: "try again later", err: err.errors, code: 0 })
      })
    }
  })
})


module.exports = app;