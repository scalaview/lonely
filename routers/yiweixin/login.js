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

module.exports = app;