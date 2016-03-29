var cusBalance = 0;
var lastSubmitdate = new Date().getTime();

Handlebars.registerHelper('if-lt', function(a, b) {
  var options = arguments[arguments.length - 1];
  if (a < b) { return options.fn(this); }
  else { return options.inverse(this); }
});

Handlebars.registerHelper('subSummary', function(text, size) {
  if(text.length <= size){
    return text
  }else{
    return text.substring(0, size) + "..."
  }
});

Handlebars.registerHelper('if_all', function() {
    var args = [].slice.apply(arguments);
    var opts = args.pop();

    var fn = opts.fn;
    for(var i = 0; i < args.length; ++i) {
        if(args[i])
            continue;
        fn = opts.inverse;
        break;
    }
    return fn(this);
});

//页面加载
$(document).ready(function () {
  extractConfirm()
  $(".correct").html("");
  $(".correct").hide();
  var m = $("#mobile").val();
  $(".llb").on('click', 'a', function(){
    var $this = $(this)
    $this.parent().children().removeClass("selected");
    $(this).addClass("selected");
    var cost = $this.data("cost");
    $("#needmyflow").html(cost);
  })
  var source   = $("#trafficplans-template").html();
  if(source !== undefined && source !== ''){
    getTrafficplan(source, "all")
  }
  if($("#movies-template").html() !== undefined && $("#movies-template").html() !== ''){
    popstateBack()
    loadMore()
    $(window).scroll(bindScroll);
  }
});

///验证数字
function isNumber(content) {
    var reg = /^\d*$/;
    return reg.test(content);
}

function getTrafficplan(source, catName){
  if(!source) return
  var template = Handlebars.compile(source);
  showLoadingToast();
  $.ajax({
    url: '/getTrafficplans',
    dataType: 'JSON',
    data: {
      catName: catName
    },
    method: "GET"
  }).done(function(data){
    if(data.err == 4){  //服务器维护中
      var err_source = $("#err-template").html()
      if(err_source != undefined && err_source != ''){
        var err_template = Handlebars.compile(err_source);
        var err_html = err_template({msg: data.msg})
        $(".no_data").html(err_html)
        $(".no_data").show()
        hideLoadingToast();
      }
    }else{
      $(".no_data").hide()
      var html = template({trafficgroups: data})
      if(catName == "all"){
        window.plans = html
      }
      $(".llb").html(html)
      hideLoadingToast();
    }
  }).fail(function(err){
    console.log(err)
    hideLoadingToast();
    showDialog("服务器错误")
  })
}

function extractConfirm(){

  $(".subimts").on('click', function() {
    var mobile = $.trim($("#mobile").val());
    if (!isMobile(mobile)){
      showDialog("请输入正确的手机号码")
      return
    }
    $this = $(".choose")
    phone = $.trim($("#mobile").val())
    $("#maskflow").html($this.data('name'))
    $("#maskmobile").html(phone)
    $("#maskcost").html($this.data('cost'))
    $("#mask").show()
  })

  $(".sure").click(function(){
    var selectedFlow = $(".llb a.exchanger.choose")
        phone = $.trim($("#mobile").val()),
        flowId = selectedFlow.data("value"),
        source   = $("#trafficplans-template").html()

    if(source === undefined || source == ''){
      return
    }


    if(isMobile(phone) && flowId !== undefined && flowId !== '' ){
      wechatPayment(phone, flowId)
    }else{
      showDialog("请输入电话和选择正确的套餐")
    }
  })

}

function wechatPayment(phone, flowId){
  showLoadingToast();
  $.ajax({
        url: '/pay',
        method: "POST",
        dataType: "JSON",
        data: {
          flowId: flowId,
          paymentMethod: 'WechatPay',
          chargetype: "balance",
          phone: phone
        }
      }).done(function(payargs) {
        hideLoadingToast();
        if(payargs.err){
          showDialog(payargs.msg)
        }else{
          WeixinJSBridge.invoke('getBrandWCPayRequest', payargs, function(res){
            if(res.err_msg == "get_brand_wcpay_request:ok"){
              $("#mask").hide();
              showDialog("支付成功")
              // 这里可以跳转到订单完成页面向用户展示
              // window.location.href = '/profile'
            }else{
              showDialog("支付失败，请重试")
            }
          });
        }
      }).fail(function(err) {
        hideLoadingToast();
        console.log(err)
        showDialog("服务器繁忙")
      })
}