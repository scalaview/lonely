var fs = require('fs')
var path = require('path')
var config = require("../config")
var moment = require('moment')
var _ = require('lodash')
var handlebars = require('handlebars')
var models  = require('../models')
var async = require("async")
var WechatAPI = require('wechat-api');
var Payment = require('wechat-pay').Payment;

var initConfig = {
  partnerKey: config.partnerKey,
  appId: config.appId,
  mchId: config.mchId,
  notifyUrl: "http://" + config.hostname + "/paymentconfirm",
  pfx: fs.readFileSync(process.env.PWD + '/cert/apiclient_cert.p12')
};
var payment = new Payment(initConfig);

String.prototype.htmlSafe = function(){
  return new handlebars.SafeString(this.toString())
}

String.prototype.renderTemplate = function(options){
  if(!this.compileTemplate){
    this.compileTemplate = handlebars.compile(this.toString())
  }
  return this.compileTemplate(options)
}

String.prototype.format = String.prototype.renderTemplate

String.prototype.capitalize = function () {
  return this.toString()[0].toUpperCase() + this.toString().slice(1);
}

String.prototype.present = function(){
  if(this !== undefined){
    if(this instanceof Array){
      return this.length > 0
    }else{
      return (this.toString() !== undefined) && (this.toString() !== '')
    }
  }
}

String.prototype.toI = function(){
  try{
    return parseInt(this.toString())
  }catch(e){
    return this.toString()
  }
}

Array.prototype.compact = function (array) {
  if(this instanceof Array && array == undefined){
    array = this
  }

  var index = -1,
      length = array ? array.length : 0,
      resIndex = -1,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (value !== undefined && value !== null && value !== '' ) {
      result[++resIndex] = value;
    }
  }
  return result;
}

Date.prototype.begingOfDate = function(){
  this.setHours(0,0,0,0);
  return this
}

Date.prototype.endOfDate = function(){
  this.setHours(23,59,59,999);
  return this
}

function compact(obj){
  if(obj !== undefined && obj !== null){
    if(typeof obj === 'string'){
      return (obj !== '')
    }else if( obj instanceof Array){
      var result = []
      if((array = obj.compact()).length > 0){
        for (var i = 0; i < array.length; i++) {
          var data = array[i]
          var value = compact(array[i])
          if( value instanceof Array ){
            result.push(value)
          }else if(value){
            result.push(data)
          }
        };
        return result.compact()
      }
    }else if( typeof obj === 'object' ){
      for(var key in obj){
        var value = compact(obj[key])
        if(!value){
           delete obj[key]
        }else if(value instanceof Array){
          obj[key] = value
        }
      }
      return (Object.keys(obj).length > 0)
    }else{
      return true
    }
  }
}

function fileUpload(file, successCallBack, errorCallBack){
  var origin_this = this,
      old_path = file.path,
      file_size = file.size,
      file_type = file.type,
      origin_file_name = file.name,
      file_name = Math.round((new Date().valueOf() * Math.random())) + "_" + origin_file_name,
      new_path = path.join(process.env.PWD, config.upload_path, file_name );

  fs.readFile(old_path, function(err, data) {
      fs.writeFile(new_path, data, function(err) {
          fs.unlink(old_path, function(err) {
              if (err) {
                errorCallBack(err)
              } else {
                successCallBack(file_name)
              }
          });
      });
  });
}

function fileUploadSync(file, dirpath, forceRecover){
  var origin_this = this,
      old_path = file.path,
      file_size = file.size,
      file_type = file.type,
      origin_file_name = file.name,
      file_name = (forceRecover !== undefined && forceRecover) ? origin_file_name : Math.round((new Date().valueOf() * Math.random())) + "_" + _.trim(origin_file_name, ' '),
      new_path = path.join(process.env.PWD, dirpath || config.upload_path, file_name );
console.log(new_path)
  var tmp_file = fs.readFileSync(old_path);
  fs.writeFileSync(new_path, tmp_file);
  return file_name
}

function isExpired(expiredAt){
  if(expiredAt !== undefined && ( (new Date()).begingOfDate()  > expiredAt)){
    return true
  }else{
    return false
  }
}


function expiredStr(expiredAt){
  if(isExpired(expiredAt)){
    return "活动已结束"
  }else{
    return
  }
}

function flowSource(obj){
  if(obj.className() === 'Order'){
    return "购买流量币"
  }else{
    return "其他来源"
  }
}

function strftime(dateTime, format){
  var result = moment()
  if(dateTime){
    result = moment(dateTime)
  }
  if( typeof format === 'string'){
    return result.format(format)
  }else{
    return result.format('YYYY-MM-DD HH:mm:ss')
  }
}

function sizeFormat(apkSize){
  if(apkSize){
    if(apkSize > 1024000){  // MB
      return _.round(apkSize/ 1000000, 2) + "MB"
    }else if(apkSize > 1000) { //KB
      return _.round(apkSize/ 1000, 2) + "KB"
    }
  }
}

function imgDiv(images){
  if(images instanceof Array){
    var length = images.length,
        source = ['<div class="col-xs-{{interval}} col-md-{{interval}}">',
          '<img class="img-responsive" src="{{img}}">',
        '</div>'].join(''),
        template = handlebars.compile(source),
        html = []

    if(length === 3){
      var interval = 4
    }else if(length === 2){
      var interval = 5
    }else{
      var interval = 12
    }

    for (var i = 0; i < images.length; i++) {
      html.push( template({ img: images[i], interval: interval }) )
    };
    return html.join('').htmlSafe()
  }
}

function apkImages(apk) {
  var fields = ['image01', 'image02', 'image03'],
      images = []
  for (var i = 0; i < fields.length; i++) {
    if(apk[fields[i]]){
      images.push( apk[fields[i]] )
    }
  };

  return imgDiv(images)
}

function fullPath(filePath){
  return process.env.PWD + "/public" + filePath
}

function section (name, options) {
  if (!this._sections) {
    this._sections = {};
  }
  this._sections[name] = options.fn(this);
  return null;
}


function hostname(){
  return config.hostname
}

function hostUrl(){
  return "http://" + config.hostname
}

function taskLink(task) {
  if(task.actionUrl){
    return task.actionUrl
  }else{
    return "/tasks/" + task.id
  }
}


function discount(customer, trafficPlan){
  var discount = 1.00
  if(trafficPlan.coupon && trafficPlan.coupon.ignoreLevel && trafficPlan.coupon.discount > 0){
    discount = trafficPlan.coupon.discount
  }else if(customer.level != undefined && customer.level.discount > 0 && trafficPlan.coupon && !trafficPlan.coupon.ignoreLevel && trafficPlan.coupon.discount > 0){
    discount = trafficPlan.coupon.discount * customer.level.discount
  }else if(customer.level == undefined && trafficPlan.coupon && !trafficPlan.coupon.ignoreLevel && trafficPlan.coupon.discount > 0){
    discount = trafficPlan.coupon.discount
  }else if(customer.level != undefined && customer.level.discount > 0){
    discount = customer.level.discount
  }

  if(discount >= (config.mindiscount || 0.60) ){
    return (trafficPlan.cost * discount).toFixed(2)
  }else{
    return trafficPlan.cost
  }
}

function selectTag(options, collection, selected) {
  var source = [
        '<select {{#if options.style}} style="{{options.style}}" {{/if}} {{#if options.class}} class="{{options.class}}" {{else}} class="col-xs-12 col-lg-12 select2" {{/if}} {{#if options.id}} id="{{options.id}}" {{/if}} {{#if options.name}} name="{{options.name}}" {{/if}} {{#if options.disabled}} disabled {{/if}} >',
        '{{items}}',
        '</select>'
      ].join(""),
      optionSource = '<option {{#if value }} value="{{value}}" {{/if}} {{selected}}>{{name}}</option>',
      template = handlebars.compile(source),
      optionSourceTemplate = handlebars.compile(optionSource)
      selected = selected || ''

  optionHtml = []

  if(collection instanceof Array){
    if(options.includeBlank){
      optionHtml.push(optionSourceTemplate())
    }
    for (var i = 0; i < collection.length ; i++) {
      if(collection[i] instanceof Array){
        var data = { value: collection[i][0].toString(), name: collection[i][1], selected: selected.toString() === collection[i][0].toString() ? "selected" : null }
      }else if(collection[i] instanceof Object){
        var data = { value: collection[i].value.toString(), name: collection[i].name, selected: selected.toString() ===  collection[i].value.toString() ? "selected" : null }
      }
      optionHtml.push(optionSourceTemplate(data))
    };

    var html = template({ options: options,  items: optionHtml.join("").htmlSafe() })
    return html.htmlSafe()
  }else{
    return template({ options: options }).htmlSafe()
  }
}

function offset(page, prePage){
  if(page > 0){
    return (page - 1) * prePage
  }
  return 0
}

function addParams(href, params){
  var subFix = '';

  var urlParams = href.split('?')[1],
      originParams = {}
  if(urlParams){
    var queryParams = urlParams.split('&')
    for (var i = 0; i < queryParams.length; i++) {
      var tmp = queryParams[i].split('=')
      if(tmp[1]){
        originParams[tmp[0]] = tmp[1]
      }
    };
  }

  var paramsAll = _.merge(originParams, params)

  for(var key in paramsAll){
    subFix = subFix + '&' + key + '=' + paramsAll[key]
  }

  if(href.indexOf('?') !== -1 ){
    href = href.split('?')[0]
  }
  return (subFix.length > 0) ? href + "?" + subFix.substring(1, subFix.length) : href
}




function pagination(result, href){

  function isFirst(){
    return (currentPage == 1)
  }

  function isLast(){
    return currentPage == totalpages
  }

  var source = [
  '<div class="row">',
    '<div class="col-sm-12">',
      '<div class="pull-right dataTables_paginate paging_simple_numbers" id="dataTables-example_paginate">',
        '<ul class="pagination">',
          '{{items}}',
        '</ul>',
      '</div>',
    '</div>',
  '</div>'].join(""),
    item = ['<li class="paginate_button {{ status }} {{disabled}}" tabindex="0">',
              '<a href="{{link}}">{{text}}</a>',
            '</li>'].join(''),
    template = handlebars.compile(source),
    itemTemplate = handlebars.compile(item),

    total = result.count,
    page = result.page,
    perPage = result.perPage,
    totalpages = (total % perPage) == 0 ? (total / perPage) : parseInt(total / perPage) + 1,
    currentPage = parseInt(result.currentPage),
    items = []

  if(total <= perPage){ return }
    var startIndex = (currentPage - 5 > 0) ? currentPage - 5 : 0,
        endIndex = (currentPage + 4 > totalpages) ? totalpages : currentPage + 4

  var data;
  data = { status: 'previous', disabled: isFirst() ? 'disabled' : null, link: isFirst() ? "#" : addParams(href, {page: 1}), text: "首页"  }
  items.push(itemTemplate(data))

  for (var i = startIndex; i < endIndex ; i++) {
    data = { status: (currentPage == (i + 1)) ? "active" : null, link: addParams(href, {page: i+1}), text: (i+1)}
    items.push(itemTemplate(data))
  };

  data = { status: 'next', disabled: isLast() ? 'disabled' : null, link: isLast() ? "#" : addParams(href, {page: totalpages}), text: "尾页"  }
  items.push(itemTemplate(data))

  return template({ items: items.join("").htmlSafe() }).htmlSafe()
}

function setPagination(result, req){
  result.page = req.query.page || 1,
  result.perPage = req.query.perPage || 15,
  result.currentPage = req.query.page || 1
  return result
}

function isChecked(checked){
  if(typeof checked === 'boolean'){
    return checked ? "checked" : ""
  }else if(typeof checked === 'string'){
    try{
      return (parseInt(checked) === 1) ? "checked" : ''
    }catch(e){
    }
  }
}

function amountType(type, amount){
  if(type === 1 ){
    return ['<span class="btn-warning">+ ', amount, ' </span> '].join("").htmlSafe()
  }else if(type ===  0){
    return ['<span class="btn-info">- ', amount, ' </span> '].join("").htmlSafe()
  }
}

function flowhistorySourceLink(source, options){
  if(!source){
    return
  }
  var link = ['<a  {{#if class}} class="{{class}}" {{/if}} {{#if id}} id="{{id}}" {{/if}} {{#if href}} href="{{href}}" {{/if}}>',
                '{{#if text}} {{text}} {{/if}}',
              '</a>'].join("")
  options.text =  source.className() + ": " + source.id

  if(source.className() === "Order"){
    options.href = "/admin/orders/" + source.id + "/edit"
    return link.renderTemplate(options).htmlSafe()
  }else if(source.className() === "ExtractOrder"){
    options.href = "/admin/extractorder/" + source.id + "/edit"
    return link.renderTemplate(options).htmlSafe()
  }else if(source.className() === "Apk"){
    options.href = "/admin/apks/" + source.id + "/edit"
    return link.renderTemplate(options).htmlSafe()
  }
}

function extractOrderLink(exchanger, options){
  if(!exchanger){
    return
  }
  var link = ['<a  {{#if class}} class="{{class}}" {{/if}} {{#if id}} id="{{id}}" {{/if}} {{#if href}} href="{{href}}" {{/if}}>',
              '{{#if text}} {{text}} {{/if}}',
            '</a>'].join("")
  if(exchanger.className() === "TrafficPlan"){
    options.text =  "充值: " + exchanger.id
    options.href = "/admin/trafficplans/" + exchanger.id + "/edit"
    return link.renderTemplate(options).htmlSafe()
  }else if(exchanger.className() === 'FlowTask'){
    options.text =  "流量任务: " + exchanger.id
    options.href = "/admin/flowtasks/" + exchanger.id + "/edit"
    return link.renderTemplate(options).htmlSafe()
  }

}

function htmlSafe(html) {
  if(html){
    return html.htmlSafe()
  }
}

function tipSource(source, data){
  if( typeof data === 'string' ){
    return source.format({ text: data }).htmlSafe()
  }else if( data instanceof Array && data.length > 0){
    return source.format({ text: data.join('<br>') }).htmlSafe()
  }else if( typeof data === 'object' && data.length > 0 ){
    var html = []
    for(var key in data){
      html.push( data[key] )
    }
    return source.format({ text: html.join('') }).htmlSafe()
  }
}


function successTips(info){
  var source = ['<div class="alert alert-success alert-dismissable">',
                  '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>',
                  '{{text}}',
                '</div>'].join('')
  return tipSource(source, info)
}

function errTips(err) {
  var source = ['<div class="alert alert-danger alert-dismissable">',
                  '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>',
                  '{{text}}',
                '</div>'].join('')
  return tipSource(source, err)
}

// ===================login=====================

function requireLogin(req, res, next) {
  if(process.env.NODE_ENV == "development"){
    req.session.customer_id = 1
  }
  var url = req.originalUrl
  var encodeUrl = new Buffer(url).toString('base64');

  if (req.session.customer_id) {
    models.Customer.findOne({ where: { id: req.session.customer_id } }).then(function(customer) {
      if(customer){
        req.customer = customer
        next();
      }else{
        res.redirect("/auth?to=" + encodeUrl);
      }
    }).catch(function(err){
      console.log(err)
    })
  } else {
    res.redirect("/auth?to=" + encodeUrl);
  }
}

function withdrawalStatus(status, STATUSLIST){
  switch(status)
  {
  case STATUSLIST.APPLY:
    return "待审核";
  case STATUSLIST.FAIL:
    return "拒绝受理";
  case STATUSLIST.SUCCESS:
    return "成功";
  default:
    return "";
  }
}

function excharge(e, exchange){
  return ( parseFloat(e) / parseFloat(exchange) )
}


function bgcolor(Withdrawal, state) {
  switch(state)
  {
  case Withdrawal.STATUS.APPLY:
    return 'panel-info'
  case Withdrawal.STATUS.SUCCESS:
    return 'panel-success'
  case Withdrawal.STATUS.FAIL:
    return 'panel-danger'
  }
}

function withdrawalState(Withdrawal, state){
  switch(state)
  {
  case Withdrawal.STATUS.APPLY:
    return '待审核'
  case Withdrawal.STATUS.SUCCESS:
    return '成功提取'
  case Withdrawal.STATUS.FAIL:
    return '提取失败'
  }
}


function wechatMenus(top, menus, idx){

  var html = ['<table class="table table-striped">',
       '<tbody>',
          '<tr>',
             '<td>级别</td>',
             '<td><strong>类型</strong></td>',
             '<td><strong>名称</strong></td>',
             '<td><strong>值</strong></td>',
          '</tr>',
          '{{content}}',
       '</tbody>',
    '</table>']

    var trl = ['<tr>',
             '<td>{{title}}</td>',
             '<td>',
                '<select name="menu_{{index}}_event">',
                   '<option value="click" {{#if clicked }} selected="" {{/if}}>click</option>',
                   '<option value="view" {{#if viewed }} selected="" {{/if}}>view</option>',
                '</select>',
             '</td>',
             '<td>',
                '<label><input type="text" name="menu_{{index}}_name" value="{{name}}" size="8"></label>',
             '</td>',
             '<td>',
                '<label><input type="text" name="menu_{{index}}_url" value="{{url}}" size="50"></label>',
             '</td>',
             '<input type="hidden" name="menu_{{index}}_key" value="{{key}}">',
          '</tr>']


    var tr = ['<tr>',
             '<td>{{title}}</td>',
             '<td>',
                '<select name="menu_{{index}}[event]_{{idx}}">',
                   '<option value="click" {{#if clicked }} selected="" {{/if}}>click</option>',
                   '<option value="view" {{#if viewed }} selected="" {{/if}}>view</option>',
                '</select>',
             '</td>',
             '<td>',
                '<label><input type="text" name="menu_{{index}}[name]_{{idx}}" value="{{name}}" size="8"></label>',
             '</td>',
             '<td>',
                '<label><input type="text" name="menu_{{index}}[url]_{{idx}}" value="{{url}}" size="50"></label>',
             '</td>',
             '<input type="hidden" name="menu_{{index}}[key]_{{idx}}" value="{{key}}">',
             '<input type="hidden" name="menu_{{index}}[sortNum]_{{idx}}" value="{{sortNum}}">',
          '</tr>']

    if(menus.length < 5){
      console.log(menus)
      for (var i = menus.length; i < 5; i++) {
        menus.push({
          name: '',
          event: '',
          key: '',
          url: '',
          sortNum: i,
          ancestryDepth: '',
          ancestry: ''
        })
      };
    }

    var menutrs =  menus.map(function (value, index) {
      return tr.join('').format({
        title: '二级菜单' + (index + 1),
        index: (idx + 1),
        idx: index,
        clicked: value.event == 'click',
        viewed: value.event == 'view',
        name: value.name,
        url: value.url,
        key: value.key,
        sortNum: value.sortNum
      })
    }).join('')


    var tableHtml = trl.join('').format({
      title: '一级菜单',
      index: (idx + 1),
      clicked: top.event == 'click',
      viewed: top.event == 'view',
      name: top.name,
      url: top.url,
      key: top.key
    })

    return html.join('').format({
      content: (tableHtml + menutrs).htmlSafe()
    }).htmlSafe()
}

function getSlaves(customer, outnext){
  var array = ['一级会员', '二级会员', '三级会员']
    var wrapped = array.map(function (value, index) {
                  return {index: index, value: value};
                });

    var depth = customer.ancestryDepth

    async.map(wrapped, function(item, next) {
      var index = item.index
      var _depth = (parseInt(depth) + parseInt(index) + 1)
      if( (_depth - customer.ancestryDepth) == 1 ){
        var params = {
          ancestry: (customer.ancestry) ? customer.ancestry + '/' + customer.id : customer.id + ''
        }
      }else{
        var params = {
          ancestry: {
            $like: (customer.ancestry) ? customer.ancestry + '/' + customer.id + '/%' : customer.id + '/%'
          }
        }
      }

      params = _.extend(params, { ancestryDepth: _depth })

      models.Customer.count({
        where: params
      }).then(function(c) {
        next(null, { name: item.value, count: c })
      }).catch(function(err){
        next(err)
      })

    }, function(err, result){
      if(err){
        outnext(err)
      }else{
        outnext(null, customer, result)
      }
    })
}

var API = new WechatAPI(config.appId, config.appSecret, function (callback) {
 models.DConfig.findOrCreate({
    where: {
      name: "accessToken"
    },
    defaults: {
      value: "{}"
    }
  }).spread(function(accessToken) {
    if(accessToken.value.present()){
      callback(null, JSON.parse(accessToken.value))
    }else{
      callback(null, {accessToken: "", expireTime: 0})
    }
  }).catch(function(err) {
    callback(err)
  })
}, function (token, callback) {
  models.DConfig.findOrCreate({
    where: {
      name: "accessToken"
    },
    defaults: {
      value: "{}"
    }
  }).spread(function(accessToken) {
      accessToken.updateAttributes({
        value: JSON.stringify(token)
      }).then(function(accessToken) {
        callback(null, token)
      }).catch(function(err){
        callback(err)
      })
  }).catch(function(err) {
    callback(err)
  })
});

function toUnicode(theString) {
  var unicodeString = '';
  for (var i=0; i < theString.length; i++) {
    var theUnicode = theString.charCodeAt(i).toString(16).toLowerCase();
    while (theUnicode.length < 4) {
      theUnicode = '0' + theUnicode;
    }
    theUnicode = '\\u' + theUnicode;
    unicodeString += theUnicode;
  }
  return unicodeString;
}

function applylimit(salary, _class){
  if(typeof _class === 'string'){
    var cla = _class
  }
  if(salary >= (config.applylimit || 100.00) ){
    return "href='/apply' class='{{#if cla}}{{cla}}{{/if}}'".format({cla: cla}).htmlSafe()
  }else{
    return "href='javascript:void(0);' class='applylimit{{#if cla}} {{cla}}{{/if}}'".format({cla: cla}).htmlSafe()
  }
}

function toHex(str){
  return new Buffer(""+str).toString("hex")
}

function getAllTrafficPlans(includeBlank, pass){
  models.TrafficPlan.findAll().then(function(trafficPlans){
    var trafficPlanCollection = []
    for (var i = 0; i < trafficPlans.length; i++ ) {
      trafficPlanCollection.push([trafficPlans[i].id, trafficPlans[i].name])
    };
    var trafficPlanOptions = { name: 'trafficPlanId', class: "select2 col-lg-12 col-xs-12", includeBlank: includeBlank || true  }
    pass(null, trafficPlanCollection, trafficPlanOptions)
  }).catch(function(err) {
    pass(err)
  })
}

function css() {
  var css = connectAssets.options.helperContext.css.apply(this, arguments);
  return new handlebars.SafeString(css);
};

function js() {
  var js = connectAssets.options.helperContext.js.apply(this, arguments);
  return new handlebars.SafeString(js);
};

function assetPath() {
  var assetPath = connectAssets.options.helperContext.assetPath.apply(this, arguments);
  return new handlebars.SafeString(assetPath);
};

function applyCoupon(coupons, trafficPlans, customer){
  for (var j = trafficPlans.length - 1; j >= 0; j--) {
    for (var i = coupons.length - 1; i >= 0; i--) {
      if(coupons[i].trafficPlanId == trafficPlans[j].id){
        if(trafficPlans[j].coupon === undefined){
          trafficPlans[j].coupon = coupons[i]
        }else if(trafficPlans[j].coupon.updatedAt < coupons[i].updatedAt){
          trafficPlans[j].coupon = coupons[i]
        }
      }
    };
    var cost = discount(customer, trafficPlans[j])
    if(cost != trafficPlans[j].cost){
      trafficPlans[j].withOutDiscount = trafficPlans[j].cost
      trafficPlans[j].cost = cost
    }
  };
  return trafficPlans
}

function orderStyle(extractorder){
  switch(extractorder.state)
  {
  case models.ExtractOrder.STATE.UNPAID:
    return "panel-warning"
  case models.ExtractOrder.STATE.FAIL:
    return "panel-warning"
  case models.ExtractOrder.STATE.FINISH:
    return "panel-warning"
  case models.ExtractOrder.STATE.REFUNDED:
    return "panel-warning"
  case models.ExtractOrder.STATE.REFUNDED:
    return "panel-warning"
  default:
    return "panel-info"
  }
}


function iflt(a, b) {
  var options = arguments[arguments.length - 1];
  if (a < b) { return options.fn(this); }
  else { return options.inverse(this); }
};

function subSummary(text, size){
  if(text.length <= size){
    return text
  }else{
    return text.substring(0, size) + "..."
  }
}

function inc(value){
  return parseInt(value) + 1;
}


function nextUrl(total, currentPage, perPage, query){
  var totalpages = (total % perPage) == 0 ? (total / perPage) : parseInt(total / perPage) + 1
  if(total <= perPage || totalpages <= currentPage){
    return null
  }
  query["page"] = parseInt(currentPage) + 1
  return addParams('/lofter', query)
}

function if_eq(a, b, opts) {
  if(a == b) // Or === depending on your needs
    return opts.fn(this);
  else
    return opts.inverse(this);
}

function iflt(a, b) {
  var options = arguments[arguments.length - 1];
  if (a < b) { return options.fn(this); }
  else { return options.inverse(this); }
};

exports.applylimit = applylimit;
exports.fileUpload = fileUpload;
exports.fileUploadSync = fileUploadSync;
exports.isExpired = isExpired;
exports.expiredStr = expiredStr;
exports.flowSource = flowSource;
exports.strftime = strftime;
exports.sizeFormat = sizeFormat;
exports.imgDiv = imgDiv;
exports.apkImages = apkImages;
exports.fullPath = fullPath;
exports.section = section;
exports.hostname = hostname;
exports.hostUrl = hostUrl;
exports.taskLink = taskLink;
exports.selectTag = selectTag;
exports.offset = offset;
exports.addParams = addParams;
exports.pagination = pagination;
exports.setPagination = setPagination;
exports.isChecked = isChecked;
exports.amountType = amountType;
exports.flowhistorySourceLink = flowhistorySourceLink;
exports.extractOrderLink = extractOrderLink;
exports.htmlSafe = htmlSafe;
exports.successTips = successTips;
exports.errTips = errTips;
exports.compact = compact;
exports.discount = discount;
exports.requireLogin = requireLogin;
exports.withdrawalStatus = withdrawalStatus;
exports.excharge = excharge;
exports.bgcolor = bgcolor;
exports.withdrawalState = withdrawalState;
exports.wechatMenus = wechatMenus;
exports.getSlaves = getSlaves;
exports.API = API;
exports.toUnicode = toUnicode;
exports.payment = payment;
exports.initConfig = initConfig;
exports.toHex = toHex;
exports.getAllTrafficPlans = getAllTrafficPlans;
exports.css = css;
exports.js = js;
exports.assetPath = assetPath;
exports.applyCoupon = applyCoupon;
exports.orderStyle = orderStyle;
exports.iflt = iflt;
exports.subSummary = subSummary;
exports.inc = inc;
exports.nextUrl = nextUrl;
exports.if_eq = if_eq;
exports.iflt = iflt;