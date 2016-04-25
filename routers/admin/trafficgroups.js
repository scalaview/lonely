var express = require('express');
var admin = express.Router();
var models  = require('../../models')
var helpers = require("../../helpers")
var async = require("async")


admin.get("/trafficgroups", function(req, res) {
  models.TrafficGroup.findAndCountAll({
    order: [
      "providerId", "sortNum"
    ]
  }).then(function(trafficgroups) {
    if(trafficgroups){
      result = helpers.setPagination(trafficgroups, req)
    }else{
      result = {rows: {}}
    }
    res.render("admin/trafficgroups/index", {trafficgroups: result})
  })
})

admin.get('/trafficgroups/new', function(req, res) {
  var trafficgroup = models.TrafficGroup.build(),
      providerOptions = { name: "providerId", class: 'select2 col-lg-12 col-xs-12' },
      providerCollection = [ [0, '中国移动'], [1, '中国联通'], [2, '中国电信'] ]

  res.render('admin/trafficgroups/new', {
    providerOptions: providerOptions,
    providerCollection: providerCollection,
    trafficgroup: trafficgroup,
    path: '/admin/trafficgroup/'
  })
})

admin.post('/trafficgroup', function(req, res) {
  var params = req.body
    if(params['display'] == 'on'){
      params['display'] = true
    }else{
      params['display'] = false
    }

  async.waterfall([function(next) {
    models.TrafficGroup.build(params).save().then(function(trafficgroup) {
      next(null, trafficgroup)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, trafficgroup) {
    if(err){
      console.log(err)
      res.redirect('/500')
    }else{
      req.flash("info", "create success")
      res.redirect('/admin/trafficgroups/'+ trafficgroup.id +'/edit')
    }
  })
})


admin.get('/trafficgroups/:id/edit', function(req, res) {
  models.TrafficGroup.findById(req.params.id).then(function(trafficgroup) {
    var providerOptions = { name: "providerId", class: 'select2 col-lg-12 col-xs-12' },
        providerCollection = [ [0, '中国移动'], [1, '中国联通'], [2, '中国电信'] ]
    res.render('admin/trafficgroups/edit', {
      providerOptions: providerOptions,
      providerCollection: providerCollection,
      trafficgroup: trafficgroup,
      path: '/admin/trafficgroup/' + trafficgroup.id
    })
  }).catch(function(err) {
    console.log(err)
    res.redirect('/500')
  })
})

admin.post('/trafficgroup/:id', function(req, res) {
  var params = req.body
    if(params['display'] == 'on'){
      params['display'] = true
    }else{
      params['display'] = false
    }

  async.waterfall([function(next) {
    models.TrafficGroup.findById(req.params.id).then(function(trafficgroup) {
      next(null, trafficgroup)
    }).catch(function(err) {
      next(err)
    })
  }, function(trafficgroup, next) {
    trafficgroup.updateAttributes(params).then(function(trafficgroup) {
      next(null, trafficgroup)
    }).catch(function(err) {
      next(err)
    })
  }], function(err, trafficgroup) {
    if(err){
      console.log(err)
      req.flash("info", "update fail")
    }else{
      req.flash("info", "update success")
    }
    res.redirect('/admin/trafficgroups/'+ trafficgroup.id +'/edit')
  })
})


module.exports = admin;