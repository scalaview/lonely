var express = require('express');
var admin = express.Router();
var models  = require('../../models');
var helpers = require("../../helpers")
var _ = require('lodash')

// login filter
var skipUrls = [ '^\/wechat[\/|\?|\#]\?.*', '^\/admin\/login[\/|\?|\#]\?.*', '^\/admin\/register[\/|\?|\#]\?.*']

admin.all("*", function(req, res, next) {
  var url = req.originalUrl
  if(req.session.user_id){
    next()
    return
  }else{
    for (var i = skipUrls.length - 1; i >= 0; i--) {
      var match = req.originalUrl.match(skipUrls[i]);
      if(match !== null){
        next()
        return
      }
    };
    var encodeUrl = new Buffer(url).toString('base64');
    return res.redirect("/admin/login?to=" + encodeUrl);
  }
})

admin.use(function(req, res, next){
  res.originrender = res.render
  res.render = function(path, options, fn){
    res.originrender(path, _.merge(options, { info: req.flash('info'), err: req.flash('err') }))
  }
  next();
});

admin.use(function(req, res, next){
  helpers.compact(req.body)
  helpers.compact(req.query)
  helpers.compact(req.params)
  next();
});


admin.get('/login', function(req, res){
  if(req.query.to){
    backTo = new Buffer(req.query.to, "base64").toString()
  }
  res.render('admin/login', { layout: 'sign', backTo: req.query.to })
})

admin.post('/login', function(req, res) {
  models.User.findOne({ where: {username: req.body.username} }).then(function(user){
    if(user && user.verifyPassword(req.body.password)){
      req.session.user_id = user.id
      if(req.body.to){
        var backTo = new Buffer(req.body.to, "base64").toString()
        res.redirect(backTo)
      }else{
        res.redirect('/admin')
      }
    }else{
      var message
      if(user){
        message = 'password error'
      }else{
        message = 'register new user'
      }
      res.render('admin/login', {
       locals: {message: message},
       layout: 'sign'
      })
    }
  })
})

admin.get('/logout', function(req, res) {
  req.session.user_id = null
  res.redirect('/admin/login')
})

admin.get('/', function (req, res) {
  res.render('admin/home');
});

module.exports = admin;