(function (VectorBaseSearch, $, undefined) {

  if (VectorBaseSearch.data == undefined) {
    VectorBaseSearch.data = {};
  }
  VectorBaseSearch.data.autocomplete = {};

  //edit the renderer for the autocomplete list so that the suggested
  //autocomplete part is bold
  function monkeyPatchAutocomplete() {
    var oldFn = $.ui.autocomplete.prototype._renderItem;

    $.ui.autocomplete.prototype._renderItem = function( ul, item) {

      if (item.tip == undefined) {
        var regex = new RegExp(this.term, 'i');
        var term = item.label.match(regex)[0];
        var t = item.label.replace(term, term + "<b>") + "</b>";
      } else {
        var t = item.label;
      }

      return $( "<li></li>" )
        .data( "item.autocomplete", item )
        .append( "<a>" + t + "</a>" )
        .appendTo( ul );
    }
  }

  VectorBaseSearch.init_autocomplete = function() {
    jQuery("#block-search-form :text, #search-form :text").autocomplete({
      source: function (request, response) {
        var field_id = this.element.attr('id');
        var field_name = this.element.attr('name').split('[')[0];
        var base_url = '/vbsearch/autocomplete/';
        var url = base_url + request.term;
        //For some reason spaces were getting dropped, this fixes it
        url = encodeURI(url);

        //Store the term being autocompleted
        VectorBaseSearch.data.autocomplete.term = request.term;

        if (field_id != 'edit-keys' && field_id != 'edit-search-block-form--2' && field_name != 'q') {
          var url = base_url + request.term + '/' + field_name;
        }

        if (VectorBaseSearch.data.xhr && VectorBaseSearch.data.xhr.readyState != 4) {
          VectorBaseSearch.data.xhr.abort();
        }

        //Only give autocomplete suggestions if term does not have wildcard
        if (request.term.indexOf('*') < 0) {
          VectorBaseSearch.data.xhr = $.ajax({
            url: url, type: "GET", dataType: "json",
            success: function (data) {
              //If we are thinking of other cases, we might move this to the
              //module
              var term = VectorBaseSearch.data.autocomplete.term;
              if (term[0] == "'" && term[term.length - 1] == "'" && term.length > 2) {
                term = term.slice(1,-1);
                response([{label: "<b>TIP</b>: Enclose term with double quotes for exact search or click here", value: term, tip: "true"}]);
              } else {
                response(data);
              }
            },
            error: function(xhr, statusText, err) {

              /* Hacky way of fixing the issue we were experiencing with
              * autocomplete on biomart.vectorbase.org and
              * funcgen.vectorbase.org in FireFox and Safari.  Both of these
              * browsers would not automatically do another ajax call to the
              * redirected URL and instead send it to the Error callback.  So we
              * did another ajax call here to the absolute path of vectorbase to
              * get autocomplete working.  We decided to do it this way in order
              * to reduce maintainability (I know not very pretty).
              */
              var absoluteURL = 'https://www.vectorbase.org' + this.url;
              VectorBaseSearch.data.xhr = $.ajax({
                url: absoluteURL, type: "GET", dataType: "json",
                success: function (data) {
                  var term = VectorBaseSearch.data.autocomplete.term;
                  if (term[0] == "'" && term[term.length - 1] == "'" && term.length > 2) {
                    term = term.slice(1,-1);
                    response([{label: "<b>TIP</b>: Enclose term with double quotes for exact search or click here", value: term, tip: "true"}]);
                  } else {
                    response(data);
                  }
                }
              })
            }
          })
        } else {
          //Hide the autocomplete box if a wildcard is in the term
          $('.ui-autocomplete').hide();
        }
      },
      //Keeping this here in case it is usefull in the future
      /*change: function (e, ui) {
        alert('changed!');
      },*/
      select: function (e, ui) {
        //Simulate clicking the go button to do a search when an autocomplete
        //option is selected
        var target_id = $(e.target).attr('id');
        var target_value = $(e.target).val();
        var item_value = '"' + ui.item.value + '"';

        if (target_id == 'edit-keys') {
          $('#edit-keys').val(item_value);
          $('#search-form #edit-submit').click();
        } else if (target_id == 'edit-search-block-form--2') {
          $('#edit-search-block-form--2').val(item_value);
          if ($('#search #edit-submit').length != 0) {
            $('#search #edit-submit').click();
          } else {
            $('#search #edit-submit--2').click();
          }
        }
      }
    });

    monkeyPatchAutocomplete();
  };

  $(document).ready(function () {
    VectorBaseSearch.init_autocomplete();
  });
})(window.VectorBaseSearch = window.VectorBaseSearch || {}, jQuery);
;
