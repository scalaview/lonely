function phoneValidateTip(){
  var $modal = $("#myModal"),
      $title = $("#my_title"),
      $msg = $("#popup_message")

  $title.html("易流量提醒")
  $msg.html('请输入正确的手机号码')
  $modal.modal('show')
}

function sendMsgSuccess(){
  showDialog('验证码已经发送成功，请注意查收')
}

function sendMsgFail(){
  showDialog('验证码发送失败')
}

function codeEmptyTip(){
  showDialog('请输入正确的验证码')
}

function countDown(oneMinute){
  if(oneMinute > 0){
    oneMinute--
    $("#countDown").html(oneMinute)
    setTimeout(function(){
      countDown(oneMinute)
    }, 1000)
  }else{
    $("#countDown").html('')
    $("#get_code").removeAttr("disabled")
  }
}

function init(){
  $("#get_code").click(function(){
    var $this = $(this),
        phone = $("#mobile").val(),
        oneMinute = 60

    if(!isMobile(phone)){
      phoneValidateTip()
    }else{
      $("#get_code").attr("disabled", "disabled")
      $.ajax({
        url: 'getcode',
        method: "GET",
        data: {
          phone: phone
        },
        dataType: 'json'
      }).done(function(data) {
        console.log(data)
        if(data.code == 1){
          sendMsgSuccess()
        }else if(data.code == 2){
          showDialog("短信已发送，1 分钟后重试")
        }else{
          sendMsgFail()
        }
      }).fail(function(data) {
        console.log(data)
        sendMsgFail()
      })
      setTimeout(function(){
        countDown(oneMinute)
      }, 1000)
    }
  })

  $("#submit-btn").click(function(){
    var $this = $(this),
        url = '/register',
        method = 'POST',
        phone = $("#mobile").val(),
        code = $("#code").val()
        data = {
          phone: phone,
          code: code
        }
    if(code === undefined || !isNumber(code)){
      codeEmptyTip()
      return
    }
    if(!isMobile(phone)){
      phoneValidateTip()
    }else{
      $.ajax({
        url: url,
        method: method,
        dataType: "json",
        data: data
      }).done(function(data){
        console.log(data)
        if(data.code !== undefined && data.code){
          window.location.href = '/profile'
        }else{
          showDialog('创建用户失败' + data.msg)
        }
      }).fail(function(err){
        console.log(err)
        showDialog('创建用户失败')
      })
    }
  })

}

$(function(){
  init()
})