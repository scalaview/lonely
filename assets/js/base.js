window.showDialog = function(msg){
  var $modal = $("#myModal"),
      $title = $("#my_title"),
      $msg = $("#popup_message")

  $title.html("信息")
  $msg.html(msg)
  $modal.show()
  $modal.find(".weui_btn_dialog").click(function(){
    $modal.hide()
  })
}

window.closeDialog = function(){
  $("#myModal").hide()
}

window.doDelay = function(callback, second) {
  window.setTimeout(callback, second * 1000);
}

window.toast = function(msg){
  $toast = $("#toast")
  $("#toast .weui_toast_content").html(msg || "")
  $toast.show();
  setTimeout(function () {
      $toast.hide();
  }, 2000);
}

///手机验证
window.isMobile = function (mobile) {
    var reg = /^1\d{10}$/;
    return (mobile !== undefined && mobile !== '' && reg.test(mobile))
}

$(function(){
  $(".back").click(function() {
    $("#mask").hide()
  })
  $('.fulltext img').addClass('img-responsive')
})


window.showLoadingToast = function(){
  var $loadingToast = $('#loadingToast');
  if ($loadingToast.css('display') != 'none') {
      return;
  }
  $loadingToast.show();
}

window.hideLoadingToast = function(){
  var $loadingToast = $('#loadingToast');
  if ($loadingToast.css('display') == 'none') {
      return;
  }
  $loadingToast.hide();
}