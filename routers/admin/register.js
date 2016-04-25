var express = require('express');
var admin = express.Router();
var models  = require('../../models');

admin.get('/register', function(req, res){
  res.render('admin/register', { layout: 'sign' })
})

admin.post('/register', function(req, res, next){
  var user = models.User.build({
    username: req.body.username,
    password: req.body.password
  })

  user.save().then(function(user) {
    req.session.user_id = user.id
    req.flash("info", "注册成功")
    res.redirect('/admin')
  }).catch(function(err) {
    req.flash('err', err.message)
    res.render('admin/register', {
      user: user,
      layout: 'sign'
    })
  })
})

module.exports = admin;