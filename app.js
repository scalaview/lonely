var express = require('express')
var config = require("./config")
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()
var urlencodedParser = bodyParser.urlencoded({ extended: false })
var async = require("async")
var parseString = require('xml2js').parseString;
var accessToken = null
var wechat = require('wechat')
var flash = require('connect-flash');
var cookieParser = require('cookie-parser')
var session = require('express-session')
var _ = require('lodash')
var formidable = require('formidable')
var fs = require('fs')
var path = require('path')
var helpers = require("./helpers")
var moment = require('moment')
var fs        = require('fs');
var app = express();
var admin = express();
var OAuth = require('wechat-oauth');

var Payment = require('wechat-pay').Payment;
var initConfig = {
  partnerKey: config.partnerKey,
  appId: config.appId,
  mchId: config.mchId,
  notifyUrl: "http://" + config.hostname + "/paymentconfirm",
  pfx: fs.readFileSync(process.env.PWD + '/cert/apiclient_cert.p12')
};
var payment = new Payment(initConfig);
var models  = require('./models');
app.set('port', process.env.PORT || 3001);
app.enable('verbose errors');
app.use(express.static(__dirname + '/public'));
connectAssets = require("connect-assets")({
  paths: [
    __dirname + '/public/javascript',
    __dirname + '/public/stylesheets',
    __dirname + '/public/bower_components',
    "assets"
  ],
  buildDir: "public/assets"
});
app.use(connectAssets);

var handlebars = require('express-handlebars').create({
  defaultLayout: 'main',
  helpers: helpers
});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

var wechatConfig = {
  token: config.token,
  appid: config.appId,
  encodingAESKey: config.aesKey
}

app.use(express.query());
app.use(cookieParser())
app.use(urlencodedParser)
app.use(jsonParser)
app.use(session({secret: 'yiliuliang', saveUninitialized: true, resave: true}))
app.use(flash());

app.use(function(req, res, next){
  var contentType = req.headers['content-type'] || ''
    , mime = contentType.split(';')[0];

  console.log("content-type: " + mime)

  var excep = (mime == 'multipart/form-data' && req.method == "POST" && req.url == "/huawoconfirm")

  if (mime != 'text/plain' && mime != 'text/html' && !excep) {
    return next();
  }

  var data = "";
  req.on('data', function(chunk){ data += chunk})
  req.on('end', function(){
    if(data !== ''){
      try{
        req.rawBody = JSON.parse(data)
      }catch(e){
        req.rawBody = data
      }
    }
    next();
   })
})

app.use(function(req, res, next){
  var err = req.session.error,
      msg = req.session.notice,
      success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if (err) res.locals.error = err;
  if (msg) res.locals.notice = msg;
  if (success) res.locals.success = success;

  next();
});

app.all("*", function(req, res, next) {
  console.log(req.method + " : " + req.url)
  next()
})


var yiweixin  = require('./routers/yiweixin');
for (var i = 0; i < yiweixin.length; i++) {
  app.use(yiweixin[i]);
};

// --------------- app -----------------------

app.get('/404', function(req, res, next){
  next();
});

app.get('/403', function(req, res, next){
  var err = new Error('not allowed!');
  err.status = 403;
  next(err);
});

app.get('/500', function(req, res, next){
  next(new Error('keyboard cat!'));
});


app.use(function(req, res, next){
  res.status(404);

  res.format({
    html: function(){
      res.render('404', { layout: false, url: req.url });
      return
    },

    json: function(){
      res.send({ error: 'Not found' });
      return
    },

    'default': function() {
      res.status(406).send('Not Acceptable');
      return
    }
  });

});

app.use(function(err, req, res, next){
  console.log(err)
  res.status(err.status || 500);
  res.render('500', { layout: false, error: err });
});



var server = app.listen(app.get('port'), function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});