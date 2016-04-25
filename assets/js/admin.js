function ajaxUpdateTrafficplan(_id, params){
    $.ajax({
      url: '/admin/trafficplan/' + _id,
      dataType: 'JSON',
      data: params,
      method: "POST"
    }).done(function(data){
      if(!data.err){
        toastr.success(data.message)
      }else{
        toastr.error(data.message)
      }
    }).fail(function(err){
      console.log(err)
      toastr.error('服务器错误')
    })
  }

$(function(){
  $(".select2").each(function(i, e) {
    var $select2 = $(e).select2({ width: 'resolve' });
    if($(e).find("option").is(":selected") && $(e).find("option:selected").val() != '' ){
      $select2.prop("disabled", $(e).hasClass("disabled"));
    }
  })

  $('.remove').each(function(i, e) {
    $(e).click(function() {
      var $this = $(e),
          el = $this.data('el'),
          targer = '#remove'+el,
          $checkBox = $(targer)
      $checkBox.prop('checked', true)
      $this.parents('.help-block').remove()
    })
  })

  $(".editChoose").on("change", function(e){
    var $this = $(this),
        _id = $this.parent().data("id")
        params = {id: _id}

     params[$this.attr("name")] = $this.val()
     ajaxUpdateTrafficplan(_id, params)
  })

  $(".displaySwich").on("change", function(e){
    var $this = $(this),
        _id = $this.data("id"),
        params = {}

    if($this.prop("checked")){
      params[$this.attr("name")] = "on"
    }
    ajaxUpdateTrafficplan(_id, params)
  })


  var source = $("#detail-template").html()
  if(source !== undefined && source !== ''){
    window.template = Handlebars.compile(source);
  }

  $("select[name='trafficPlanId']").on("change", function(e){
    var $this = $(this)
    $.ajax({
      url: '/admin//trafficplans/' + $this.val(),
      dataType: 'JSON',
      method: "GET"
    }).done(function(data){
      if(!data.err){
        var html = template(data.data)
        $("#detail").html(html)
      }else{
        toastr.error(data.message)
      }
    }).fail(function(err){
      console.log(err)
      toastr.error('服务器错误')
    })
  })

  $("#editOrNew").click(function(){
    var id = $("#trafficplan-select2 select[name='trafficPlanId']").val()
    if(id !== undefined && id !== ''){
      window.location.href = '/admin/affiliateconfig/trafficplan/'+ id +'/edit'
    }else{
      toastr.warning("choose a traffic plan")
    }
  })

  $(".cry").click(function(e){
    e.preventDefault();
    var r = confirm("Do you want to cry ?");
    if(r == true){
      var $this = $(this),
          _id = $this.data("id")
      $.ajax({
        url: '/admin/extractorder/' + _id + '/refund',
        dataType: 'JSON',
        method: "POST"
      }).done(function(data){
        if(!data.err){
          toastr.success(data.message)
          $this.remove()
        }else{
          toastr.error(data.message)
        }
      }).fail(function(err){
        console.log(err)
        toastr.error('服务器错误')
      })
    }
    e.stopPropagation();
  })

})