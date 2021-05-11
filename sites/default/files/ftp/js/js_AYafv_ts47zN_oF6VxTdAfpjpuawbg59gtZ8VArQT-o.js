(function ($) {

/**
 * A progressbar object. Initialized with the given id. Must be inserted into
 * the DOM afterwards through progressBar.element.
 *
 * method is the function which will perform the HTTP request to get the
 * progress bar state. Either "GET" or "POST".
 *
 * e.g. pb = new progressBar('myProgressBar');
 *      some_element.appendChild(pb.element);
 */
Drupal.progressBar = function (id, updateCallback, method, errorCallback) {
  var pb = this;
  this.id = id;
  this.method = method || 'GET';
  this.updateCallback = updateCallback;
  this.errorCallback = errorCallback;

  // The WAI-ARIA setting aria-live="polite" will announce changes after users
  // have completed their current activity and not interrupt the screen reader.
  this.element = $('<div class="progress" aria-live="polite"></div>').attr('id', id);
  this.element.html('<div class="bar"><div class="filled"></div></div>' +
                    '<div class="percentage"></div>' +
                    '<div class="message">&nbsp;</div>');
};

/**
 * Set the percentage and status message for the progressbar.
 */
Drupal.progressBar.prototype.setProgress = function (percentage, message) {
  if (percentage >= 0 && percentage <= 100) {
    $('div.filled', this.element).css('width', percentage + '%');
    $('div.percentage', this.element).html(percentage + '%');
  }
  $('div.message', this.element).html(message);
  if (this.updateCallback) {
    this.updateCallback(percentage, message, this);
  }
};

/**
 * Start monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.startMonitoring = function (uri, delay) {
  this.delay = delay;
  this.uri = uri;
  this.sendPing();
};

/**
 * Stop monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.stopMonitoring = function () {
  clearTimeout(this.timer);
  // This allows monitoring to be stopped from within the callback.
  this.uri = null;
};

/**
 * Request progress data from server.
 */
Drupal.progressBar.prototype.sendPing = function () {
  if (this.timer) {
    clearTimeout(this.timer);
  }
  if (this.uri) {
    var pb = this;
    // When doing a post request, you need non-null data. Otherwise a
    // HTTP 411 or HTTP 406 (with Apache mod_security) error may result.
    $.ajax({
      type: this.method,
      url: this.uri,
      data: '',
      dataType: 'json',
      success: function (progress) {
        // Display errors.
        if (progress.status == 0) {
          pb.displayError(progress.data);
          return;
        }
        // Update display.
        pb.setProgress(progress.percentage, progress.message);
        // Schedule next timer.
        pb.timer = setTimeout(function () { pb.sendPing(); }, pb.delay);
      },
      error: function (xmlhttp) {
        pb.displayError(Drupal.ajaxError(xmlhttp, pb.uri));
      }
    });
  }
};

/**
 * Display errors on the page.
 */
Drupal.progressBar.prototype.displayError = function (string) {
  var error = $('<div class="messages error"></div>').html(string);
  $(this.element).before(error).hide();

  if (this.errorCallback) {
    this.errorCallback(this);
  }
};

})(jQuery);
;
/**
 * @file
 * Provides JavaScript additions to the managed file field type.
 *
 * This file provides progress bar support (if available), popup windows for
 * file previews, and disabling of other file fields during Ajax uploads (which
 * prevents separate file fields from accidentally uploading files).
 */

(function ($) {

/**
 * Attach behaviors to managed file element upload fields.
 */
Drupal.behaviors.fileValidateAutoAttach = {
  attach: function (context, settings) {
    if (settings.file && settings.file.elements) {
      $.each(settings.file.elements, function(selector) {
        var extensions = settings.file.elements[selector];
        $(selector, context).bind('change', {extensions: extensions}, Drupal.file.validateExtension);
      });
    }
  },
  detach: function (context, settings) {
    if (settings.file && settings.file.elements) {
      $.each(settings.file.elements, function(selector) {
        $(selector, context).unbind('change', Drupal.file.validateExtension);
      });
    }
  }
};

/**
 * Attach behaviors to the file upload and remove buttons.
 */
Drupal.behaviors.fileButtons = {
  attach: function (context) {
    $('input.form-submit', context).bind('mousedown', Drupal.file.disableFields);
    $('div.form-managed-file input.form-submit', context).bind('mousedown', Drupal.file.progressBar);
  },
  detach: function (context) {
    $('input.form-submit', context).unbind('mousedown', Drupal.file.disableFields);
    $('div.form-managed-file input.form-submit', context).unbind('mousedown', Drupal.file.progressBar);
  }
};

/**
 * Attach behaviors to links within managed file elements.
 */
Drupal.behaviors.filePreviewLinks = {
  attach: function (context) {
    $('div.form-managed-file .file a, .file-widget .file a', context).bind('click',Drupal.file.openInNewWindow);
  },
  detach: function (context){
    $('div.form-managed-file .file a, .file-widget .file a', context).unbind('click', Drupal.file.openInNewWindow);
  }
};

/**
 * File upload utility functions.
 */
Drupal.file = Drupal.file || {
  /**
   * Client-side file input validation of file extensions.
   */
  validateExtension: function (event) {
    // Remove any previous errors.
    $('.file-upload-js-error').remove();

    // Add client side validation for the input[type=file].
    var extensionPattern = event.data.extensions.replace(/,\s*/g, '|');
    if (extensionPattern.length > 1 && this.value.length > 0) {
      var acceptableMatch = new RegExp('\\.(' + extensionPattern + ')$', 'gi');
      if (!acceptableMatch.test(this.value)) {
        var error = Drupal.t("The selected file %filename cannot be uploaded. Only files with the following extensions are allowed: %extensions.", {
          // According to the specifications of HTML5, a file upload control
          // should not reveal the real local path to the file that a user
          // has selected. Some web browsers implement this restriction by
          // replacing the local path with "C:\fakepath\", which can cause
          // confusion by leaving the user thinking perhaps Drupal could not
          // find the file because it messed up the file path. To avoid this
          // confusion, therefore, we strip out the bogus fakepath string.
          '%filename': this.value.replace('C:\\fakepath\\', ''),
          '%extensions': extensionPattern.replace(/\|/g, ', ')
        });
        $(this).closest('div.form-managed-file').prepend('<div class="messages error file-upload-js-error" aria-live="polite">' + error + '</div>');
        this.value = '';
        return false;
      }
    }
  },
  /**
   * Prevent file uploads when using buttons not intended to upload.
   */
  disableFields: function (event){
    var clickedButton = this;

    // Only disable upload fields for Ajax buttons.
    if (!$(clickedButton).hasClass('ajax-processed')) {
      return;
    }

    // Check if we're working with an "Upload" button.
    var $enabledFields = [];
    if ($(this).closest('div.form-managed-file').length > 0) {
      $enabledFields = $(this).closest('div.form-managed-file').find('input.form-file');
    }

    // Temporarily disable upload fields other than the one we're currently
    // working with. Filter out fields that are already disabled so that they
    // do not get enabled when we re-enable these fields at the end of behavior
    // processing. Re-enable in a setTimeout set to a relatively short amount
    // of time (1 second). All the other mousedown handlers (like Drupal's Ajax
    // behaviors) are excuted before any timeout functions are called, so we
    // don't have to worry about the fields being re-enabled too soon.
    // @todo If the previous sentence is true, why not set the timeout to 0?
    var $fieldsToTemporarilyDisable = $('div.form-managed-file input.form-file').not($enabledFields).not(':disabled');
    $fieldsToTemporarilyDisable.attr('disabled', 'disabled');
    setTimeout(function (){
      $fieldsToTemporarilyDisable.attr('disabled', false);
    }, 1000);
  },
  /**
   * Add progress bar support if possible.
   */
  progressBar: function (event) {
    var clickedButton = this;
    var $progressId = $(clickedButton).closest('div.form-managed-file').find('input.file-progress');
    if ($progressId.length) {
      var originalName = $progressId.attr('name');

      // Replace the name with the required identifier.
      $progressId.attr('name', originalName.match(/APC_UPLOAD_PROGRESS|UPLOAD_IDENTIFIER/)[0]);

      // Restore the original name after the upload begins.
      setTimeout(function () {
        $progressId.attr('name', originalName);
      }, 1000);
    }
    // Show the progress bar if the upload takes longer than half a second.
    setTimeout(function () {
      $(clickedButton).closest('div.form-managed-file').find('div.ajax-progress-bar').slideDown();
    }, 500);
  },
  /**
   * Open links to files within forms in a new window.
   */
  openInNewWindow: function (event) {
    $(this).attr('target', '_blank');
    window.open(this.href, 'filePreview', 'toolbar=0,scrollbars=1,location=1,statusbar=1,menubar=0,resizable=1,width=500,height=550');
    return false;
  }
};

})(jQuery);
;
/*
 *The vbsearch_basic.js javascript file is used by the top-right search block
 *form.  It is currently used to toggle between regular and file search as well
 *as do a work around for submitting the search when pressing enter.
*/

//Create the VectorBaseSearch NamesSpace
(function (VectorBaseSearch, $, undefined) {

  if(VectorBaseSearch.data == undefined) {
    VectorBaseSearch.data = {};
  }

  if (VectorBaseSearch.methods == undefined) {
    VectorBaseSearch.methods = {};
  }

  VectorBaseSearch.basic_init = function() {
    jQuery('#edit-toggle-basic-search-type').click(function() {
      if (jQuery('#search .field-type-file').css('display') == "none") {
        jQuery('#search .field-type-file').show();
        jQuery('input[name=search_block_form').hide();
        jQuery('input[name=search_block_form').val('*');
      } else {
        jQuery('#search .field-type-file').hide();
        jQuery('input[name=search_block_form').show();
        jQuery('input[name=search_block_form').val('');

      }
    });

    //Adding the file search caused the form not to be submitted when pressing
    //enter.  This js fixes that while a better solution is found in the future
    //if needed
    $("#search").keypress(function(event) {
      if ( event.which == 13 ) {
        event.preventDefault();
        $('#edit-actions .form-submit').click();
      }
    });

    $("#search .field-type-file").delegate('.file-widget', 'DOMNodeInserted', function(e) {
      jQuery(e.target).detach().prependTo('#content-group-inner');
    });
  };

  $(document).ready(function () {
    VectorBaseSearch.basic_init();
  });
})(window.VectorBaseSearch = window.VectorBaseSearch || {}, jQuery);

;
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

        //Getting value of Domain/Sub-Domain in case we need it
        var search_site = $("#edit-field-search-site-und").val();

        //Store the term being autocompleted
        VectorBaseSearch.data.autocomplete.term = request.term;

        if (field_id != 'edit-keys' && field_id != 'edit-search-block-form--2' && field_name != 'q') {
          //Add field we are querying against and also add the Domain/Sub-Domain
          //selected so we only return suggestions based on that subset
          url += '/' + field_name + '?field_search_site=' + search_site;
        }

        //For some reason spaces were getting dropped, this fixes it
        url = encodeURI(url);

        if (VectorBaseSearch.data.xhr && VectorBaseSearch.data.xhr.readystate != 4) {
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
(function ($) {

/**
 * Toggle the visibility of a fieldset using smooth animations.
 */
Drupal.toggleFieldset = function (fieldset) {
  var $fieldset = $(fieldset);
  if ($fieldset.is('.collapsed')) {
    var $content = $('> .fieldset-wrapper', fieldset).hide();
    $fieldset
      .removeClass('collapsed')
      .trigger({ type: 'collapsed', value: false })
      .find('> legend span.fieldset-legend-prefix').html(Drupal.t('Hide'));
    $content.slideDown({
      duration: 'fast',
      easing: 'linear',
      complete: function () {
        Drupal.collapseScrollIntoView(fieldset);
        fieldset.animating = false;
      },
      step: function () {
        // Scroll the fieldset into view.
        Drupal.collapseScrollIntoView(fieldset);
      }
    });
  }
  else {
    $fieldset.trigger({ type: 'collapsed', value: true });
    $('> .fieldset-wrapper', fieldset).slideUp('fast', function () {
      $fieldset
        .addClass('collapsed')
        .find('> legend span.fieldset-legend-prefix').html(Drupal.t('Show'));
      fieldset.animating = false;
    });
  }
};

/**
 * Scroll a given fieldset into view as much as possible.
 */
Drupal.collapseScrollIntoView = function (node) {
  var h = document.documentElement.clientHeight || document.body.clientHeight || 0;
  var offset = document.documentElement.scrollTop || document.body.scrollTop || 0;
  var posY = $(node).offset().top;
  var fudge = 55;
  if (posY + node.offsetHeight + fudge > h + offset) {
    if (node.offsetHeight > h) {
      window.scrollTo(0, posY);
    }
    else {
      window.scrollTo(0, posY + node.offsetHeight - h + fudge);
    }
  }
};

Drupal.behaviors.collapse = {
  attach: function (context, settings) {
    $('fieldset.collapsible', context).once('collapse', function () {
      var $fieldset = $(this);
      // Expand fieldset if there are errors inside, or if it contains an
      // element that is targeted by the URI fragment identifier.
      var anchor = location.hash && location.hash != '#' ? ', ' + location.hash : '';
      if ($fieldset.find('.error' + anchor).length) {
        $fieldset.removeClass('collapsed');
      }

      var summary = $('<span class="summary"></span>');
      $fieldset.
        bind('summaryUpdated', function () {
          var text = $.trim($fieldset.drupalGetSummary());
          summary.html(text ? ' (' + text + ')' : '');
        })
        .trigger('summaryUpdated');

      // Turn the legend into a clickable link, but retain span.fieldset-legend
      // for CSS positioning.
      var $legend = $('> legend .fieldset-legend', this);

      $('<span class="fieldset-legend-prefix element-invisible"></span>')
        .append($fieldset.hasClass('collapsed') ? Drupal.t('Show') : Drupal.t('Hide'))
        .prependTo($legend)
        .after(' ');

      // .wrapInner() does not retain bound events.
      var $link = $('<a class="fieldset-title" href="#"></a>')
        .prepend($legend.contents())
        .appendTo($legend)
        .click(function () {
          var fieldset = $fieldset.get(0);
          // Don't animate multiple times.
          if (!fieldset.animating) {
            fieldset.animating = true;
            Drupal.toggleFieldset(fieldset);
          }
          return false;
        });

      $legend.append(summary);
    });
  }
};

})(jQuery);
;
(function($) {

    // making this function a jquery plugin so that it can be called within the module form ajax callback
    $.fn.scrollToElement = function(data) {
        $("html, body").animate({scrollTop: $('#' + data).offset().top - 20}, "slow");
    };



    $(document).ready(function() {

        // This is a drupal function found in misc/ajax.js that we are overriding to load the popup dialog prior to submitting the AJAX form submit.
        Drupal.ajax.prototype.beforeSubmit = function(xmlhttprequest, options) {
            // Replacement code. Make sure this is the blast form just in case.
            // this property is set by the drupal form api in the .module file.
            if (this.blastSubmit) {
                submitBlast();
            }
            if (this.deleteDatasets) {
                alert("Datasets Deleted!\n(refresh the page to reflect the change)");
            }
            if (this.saveDatasets) {
                alert("Datasets Saved!");
            }
            if (this.resetPage) {
                window.location.reload();
            }

        }


 /* 	This line is a bit involved. This is to accomodate an organism query parameter. If a query parameter is passed into the blast page
 * 	i.e. vectorbase.org/blast?organism=Anopheles%20albimanus the module will process that parameter and will set a data attribute on
 * 	the organism that was passed in. The module will also set the 'checked' value on that organism. This line will select all of the
 * 	Nucleotide databases for that organism on page load since it is burdensome to go through the loop on the server side.
 *
 * 	In plain english, find all of the checkbox child elements elements of Class nucDbs that have a data-org attribute equal to the organism name of the
 * 	organism which has a data-queryparam attribute. Then set the checkboxes to true.
 *
 */
	$(".nucDbs[data-org=" + $(".organismCheckbox[data-queryparam]").data("org") + "]:checkbox").attr('checked', true);

        // weird firefox bug.
        $("#edit-sequence").css("display", 'inline-block');

        // stupid ie ajax caching bug
        $.ajaxSetup({cache: false});

        //$('#edit-complexitymasking').val('Default');
        //console.log($('#edit-complexitymasking').val());
        //$('#edit-complexitymasking select>option:eq(1)').attr('selected', true);
        //console.log($('#edit-complexitymasking').val());

        // blast program descriptions for labels and their radio buttons
        $("label[for='edit-program-blastn']").mouseover(function() {
            $('#blastProgramDescription').text('blastn - Nucleotide vs. Nucleotide');
        });
        $("label[for='edit-program-tblastn']").mouseover(function() {
            $('#blastProgramDescription').text('tblastn - Peptide vs. Translated Nucleotide');
        });
        $("label[for='edit-program-tblastx']").mouseover(function() {
            $('#blastProgramDescription').text('tblastx - Translated Nucleotide vs. Translated Nucleotide');
        });
        $("label[for='edit-program-blastp']").mouseover(function() {
            $('#blastProgramDescription').text('blastp - Peptide vs. Peptide');
        });
        $("label[for='edit-program-blastx']").mouseover(function() {
            $('#blastProgramDescription').text('blastx - Translated Nucleotide vs. Peptide');
        });
        $("input[name='program'][value='blastn']").mouseover(function() {
            $('#blastProgramDescription').text('blastn - Nucleotide vs. Nucleotide');
        });
        $("input[name='program'][value='tblastn']").mouseover(function() {
            $('#blastProgramDescription').text('tblastn - Peptide vs. Translated Nucleotide');
        });
        $("input[name='program'][value='tblastx']").mouseover(function() {
            $('#blastProgramDescription').text('tblastx - Translated Nucleotide vs. Translated Nucleotide');
        });
        $("input[name='program'][value='blastp']").mouseover(function() {
            $('#blastProgramDescription').text('blastp - Peptide vs. Peptide');
        });
        $("input[name='program'][value='blastx']").mouseover(function() {
            $('#blastProgramDescription').text('blastx - Translated Nucleotide vs. Peptide');
        });


        // run the checks when program changes
        $("input[name='program']", '#blast-ajax-form').change(function() {
            blastProgramChecks();
        });

        // blast program checks
        function blastProgramChecks() {
            var checked = $("input[name='program']:checked", '#blast-ajax-form').val();

            if(Drupal.settings.datasetExists == false){
                setDefaultWordSize(checked);
                setDefaultComplexityMasking(checked);
            }

            // hide scoring matrix for blastn since it isn't supported in new blastall
            if (checked == 'blastn') {
                $("label[for='edit-scoringmatrix']").css("display", "none");
                $("#edit-scoringmatrix").css("display", "none");
                $("#edit-scoringmatrix").attr("disabled", "disabled");
            } else {
                $("label[for='edit-scoringmatrix']").css("display", "block");
                $("#edit-scoringmatrix").css("display", "block");
                $("#edit-scoringmatrix").removeAttr("disabled");
            }
            setAvailableDbs(checked);
            setCheckedDbs();
        }

        // set default wordsize to 11 for blastn, 3 otherwise
        function setDefaultWordSize(checked) {
            if (checked == 'blastn') {
                $("#edit-wordsize").val('11').attr("selected", "selected");
            } else {
                $("#edit-wordsize").val('3').attr("selected", "selected");
            }
        }

        // set low complexity masking off for blastp
        function setDefaultComplexityMasking(checked) {
            if (checked == 'blastp') {
                $("#edit-complexitymasking").val('no').attr("selected", "selected");
            } else {
                $("#edit-complexitymasking").val('Default').attr("selected", "selected");
            }
        }

        // set available dbs for the selected program
        function setAvailableDbs(checked) {
            if (checked == 'blastp' || checked == 'blastx') {
                // only pep dbs
                // uncheck and disable nucs
                $("[id^=edit-nucleotide] .nucDbs").removeAttr("checked");
                $("[id^=edit-nucleotide]").attr("disabled", "disabled").addClass("disabledFields");
                // enable peps
                $("[id^=edit-peptide]").removeAttr("disabled").removeClass("disabledFields");
            } else {
                // only nuc dbs
                // uncheck and disable peps
                $("[id^=edit-peptide] .pepDbs").attr("checked", false);
                $("[id^=edit-peptide]").attr("disabled", "disabled").addClass("disabledFields");
                // enable nucs
                $("[id^=edit-nucleotide]").removeAttr("disabled").removeClass("disabledFields");
            }
        }


        // datasets: toggle active dataset displayed
        $(".organismCheckboxDiv").mouseover(function() {
            // clear all visible sets
            $(".dbContainer:not([data-org=" + $(this).attr('data-org') + "])").css("display", "none");
            // enable selected set
            $(".dbContainer[data-org=" + $(this).attr('data-org') + "]").css("display", "block");

            //clear all highlighted organism name divs
            $(".organismCheckboxDiv").stop().animate({boxShadow: "#eee 0px 0px 0px 0px"}, 600);

            // highlight this div
            $(this).stop().animate({boxShadow: "#ddd 0px 0px 7px 8px"}, 300);
        });


        // datasets: check associated dbs toggle
        $(".organismCheckbox").live("click", function(event) {
            if(this.checked == false){
                $(".allTypeSelector[data-type=" + $(this).attr('data-type') + "]:checkbox" ).attr('checked', this.checked);
                $(".allDatasets:checkbox" ).attr('checked', this.checked);
            }
            $(".dbs[data-org=" + $(this).attr('data-org') + "]:checkbox").attr('checked', this.checked);
            //uncheck bac dbs
            $(".dbs[data-org=" + $(this).attr('data-org') + "].bac:checkbox").removeAttr('checked');
            setAvailableDbs($("input[name='program']:checked", '#blast-ajax-form').val());
        });

        // examine all checked datasets, check dbs according to what program is selected
        function setCheckedDbs() {
            $(".organismCheckbox").trigger('change');
            if ($(".allDatasets").attr('checked')) {
                if ($(".allSelector.pepDbs").is(':disabled')) {
                    $(".allSelector.nucDbs").attr('checked', 'true');
                }
                else {
                    $(".allSelector.pepDbs").attr('checked', 'true');
                }
            }
        }

        // master toggle for all datasets
        $(".allDatasets").live("click", function(event) {
            $(".organismCheckboxDiv :checkbox").attr('checked', this.checked);
            $(".dbs:checkbox").attr('checked', this.checked);

            // calling this function is taking forever. lets speed it up
            setAvailableDbs($("input[name='program']:checked", '#blast-ajax-form').val());
        });


        // toggles for specific type select alls
        $(".allSelector").live("click", function(event) {
            var thisType = $(this).attr('data-type');
            $("label.option:contains('" + thisType + "')").each(function(i, v) {
                var idOfCheckbox = $(v).attr('for');
                $("#" + idOfCheckbox).attr('checked', $(".allSelector[data-type=" + thisType + "]").attr('checked'));
            });

        });

        $(".allTypeSelector").live("click", function(event) {
            if(this.checked == false){
                $(".allDatasets:checkbox" ).attr('checked', this.checked);
            }         var thisType = $(this).attr('data-type');
            $("label.option:contains('" + thisType + "')").each(function(i, v) {
                var idOfCheckbox = $(v).attr('for');
                $("#" + idOfCheckbox).attr('checked', $(".allTypeSelector[data-type=" + thisType + "]").attr('checked'));
            });
            $(".dbs[data-type=" + $(this).attr('data-type') + "]:checkbox").attr('checked', this.checked);
            //uncheck bac dbs
            $(".dbs[data-type=" + $(this).attr('data-type') + "].bac:checkbox").removeAttr('checked');
            $(".allTypeSelectorDbs[data-org=" + $(this).attr('data-org') + "]:checkbox").attr('checked', this.checked);
            setAvailableDbs($("input[name='program']:checked", '#blast-ajax-form').val());

        });

        //if any type dbs are checked also check all other types
        $(".allTypeSelectorDbs").live("click", function(event){
            var thisType = $(this).attr('data-type');
            var thisOrg = $(this).attr('data-org');

            //check parent all dataset
            if ($(".allTypeSelectorDbs[data-org=" + thisOrg + "]:checked").length > 0 ) {
                $(".allTypeSelector[data-org=" + thisOrg + "]:checkbox").attr('checked',true);
            } else{
                $(".allTypeSelector[data-org=" + thisOrg + "]:checkbox").removeAttr('checked');
            }

            //check individual databases and organisms
            $("label.option:contains('" + thisType + "')").each(function(i, v) {
                var idOfCheckbox = $(v).attr('for');
                if($("#" + idOfCheckbox).attr('data-type') == thisOrg) $("#" + idOfCheckbox).attr('checked', $(".allTypeSelectorDbs[data-nameType=" + thisOrg + thisType + "]").attr('checked'));

                if($("#" + idOfCheckbox).attr('data-type') == thisOrg){
                    var thatOrg = $("#" + idOfCheckbox).attr('data-org');
                    if($(".dbs[data-org=" + thatOrg + "]:checked").length > 0){
                        $(".organismCheckbox[data-org=" + thatOrg + "]:checkbox").attr('checked', true);
                    } else {
                        $(".organismCheckbox[data-org=" + thatOrg + "]:checkbox").removeAttr('checked');
                    }

                }

            });

        });
        // if any dbs are checked, also check it's parent dataset
        $(".dbs").live("click", function(event) {
            if ($(".dbs[data-org=" + $(this).attr('data-org') + "]:checked").length > 0) {
                $(".organismCheckbox[data-org=" + $(this).attr('data-org') + "]:checkbox").attr('checked', true);
            } else {
                $(".organismCheckbox[data-org=" + $(this).attr('data-org') + "]:checkbox").removeAttr('checked');
            }
        });



        /**********************************************
         job has been submitted. we have an id returned.
         make pop up and wait until we have some job results
         */



        var statusRepeat;
        var jobId;
        var isRaw = true;
        var pinwheel = '<br/><img src="' + Drupal.settings.blast.blastPath + '/ajax-loader.gif">';


        function submitBlast() {
            // create dialog popup
            $("#submissionDialog").dialog({
                autoOpen: true,
                show: "scale",
                hide: "scale",
                width: 270,
                height: 100,
                draggable: false,
                modal: true,
                title: "BLAST Job Status"
            });


            if($('#condor-id').val()) {
                $("#submissionDialog").html('Your job has been submitted.<br>' + $('#condor-id').text());
            } else if ($('#edit-lookup').val() == '') {
                $("#submissionDialog").html('Submitting job' + pinwheel);
            } else {
                $("#submissionDialog").html('Looking up job' + pinwheel);
            }
        }

// job id element has changed and the new value is presumably a new job id
        $('#edit-jobid').bind('DOMNodeInserted DOMNodeRemoved', function(event) {
            if (event.type == 'DOMNodeInserted' && $('#edit-jobid').text() != '') {

                /*if($('#rawJobId')) {
                 rawId = $('#rawJobId').text();
                 parseId = $('#parseJobId').text();
                 jobId = rawId;
                 } else {*/
                jobId = $('#condor-id').text();
                //}

                $("#submissionDialog").dialog("open");
                $("#submissionDialog").html('Job ' + jobId + ' is running' + pinwheel);
                // keep checking status until we're all done
                getJobStatus();

            }
        });	//end edit-jobid has changed


        function getJobStatus() {

            $.ajax({
                type: "GET",
                url: "/tool_helpers/rest/" + jobId + "/wait",
                timeout: 3200000,
                success: function(status) {
                    $.ajax({
                        type: "POST",
                        url: Drupal.settings.blast.blastPath + "/displayResults.php",
                        data: "id=" + jobId + "&ieIsCrap=" + Math.round(new Date().getTime() / 1000.0),
                        success: function(msg) {
                            $("#edit-result").html(msg);
                            $("#submissionDialog").dialog("close");
                            $().scrollToElement("edit-result"); //scroll to the results element if the job retrieval was successful.
                            $("#edit-jobid").html('');
                            loadInputParams(msg);
                        },
                        error: function(msg) {
                            $("#submissionDialog").dialog("open");
                            $("#submissionDialog").html('Job ' + jobId + ' encountered an error while parsing results: ' + msg.responseText);
                        }
                    });


                },
                error: function(msg) {
                    $("#submissionDialog").dialog("open");
                    $("#submissionDialog").html("Error: " + msg.responseText);
                }
            });
        }

        /*
         end of job submission handling
         **********************************************/




        /****************************
         for parsing of job input params
         ******************************************/
        function returnOneSubstring(regex, input) {
            regex.exec(input);
            return RegExp.$1;
        }

        function loadInputParams(input) {
            //var l1 = new Date().getTime();
            // load job input parameters
            $("#edit-sequence").val(returnOneSubstring(/sequence=([\s\S]*?)IIIjustInCase;/, input));

            if (returnOneSubstring(/description=([\s\S]*?);/m, input) != '') {
                $("#edit-description").val(returnOneSubstring(/description=([\s\S]*?);/m, input));
            }
            if (returnOneSubstring(/maxEvalue=([\w|\d|-]+);/m, input) != '') {
                $("#edit-maxevalue").val(returnOneSubstring(/maxEvalue=([\w|\d|-]+)/m, input));
            }
            if (returnOneSubstring(/wordSize=([\d]+);/m, input) != '') {
                $("#edit-wordsize").val(returnOneSubstring(/wordSize=([\d]+)/m, input));
            }
            if (returnOneSubstring(/complexityMasking=([\w]+);/m, input) != '') {
                $("#edit-complexitymasking").val(returnOneSubstring(/complexityMasking=([\w]+)/m, input));
            }
            if (returnOneSubstring(/num_alignments=([\d]+);/m, input) != '') {
                $("#edit-numberofresults").val(returnOneSubstring(/num_alignments=([\d]+)/m, input));
            }
            if (returnOneSubstring(/scoringMatrix=([\w|\d]+)/m, input) != '') {
                $("#edit-scoringmatrix").val(returnOneSubstring(/scoringMatrix=([\w|\d]+)/m, input));
            }

            var program = returnOneSubstring(/program=([\w]+)/m, input);
            if (program != '') {
                //$("#edit-program").val(program);
                var programRadio = $("input[name='program']").filter('[value=' + program + ']').attr('checked', true);
            }

            //var l2 = new Date().getTime();
            //console.log('Time took for job input param settings to get filled in: ' + (l2 - l1));

            // run some checks on this new data we're importing to the form
            // hide scoring matrix for blastn since it isn't supported in new blastall
            if (program == 'blastn') {
                $("#edit-scoringmatrix").css("display", "none");
                $("#edit-scoringmatrix").attr("disabled", "disabled");
            } else {
                $("#edit-scoringmatrix").css("display", "block");
                $("#edit-scoringmatrix").removeAttr("disabled");
            }

            //var l3 = new Date().getTime();
            //console.log('Time took for some more css and attr modifications: ' + (l3 - l2));

            //  --- check dbs ---
            // first, uncheck all datasets/dbs currently selected
            $(".organismCheckboxDiv :checkbox").removeAttr('checked');
            $(".dbs:checkbox").removeAttr('checked');


            // check dbs listed in inputParams
            var pattern = /database\d+=([\w|.|-]+);/mg;
            var match;
            var org;
            while ((match = pattern.exec(input)) != null) {
                // check this db
                $(".dbs[data-filename=" + match[1] + "]:checkbox").attr('checked', 'checked');
                // what is data-org for this db?
                org = $(".dbs[data-filename=" + match[1] + "]:checkbox").data("org");
                // check that parent dataset this db belongs to
                $(".organismCheckbox[data-org='" + org + "']:checkbox").attr('checked', 'checked');
            }



            //var l4 = new Date().getTime();
            //console.log('Time took for db check box fill-ins: ' + (l4 - l3));
            // do checks on dbs and select datasets of selected dbs
            setAvailableDbs(program);
            //var l5 = new Date().getTime();
            //console.log('Time took for setAvailableDbs to run: ' + (l5 - l4));
            setCheckedDbs();
            //var l6 = new Date().getTime();
            //console.log('Time took for setCheckedDbs to run: ' + (l6 - l5));
        }




// set some images for the sortable table columns
      //  $('th.tablesorter-headerAsc').css('background-image', "url('/" + Drupal.settings.blast.blastPath + "/asc.gif') !important");
       // $('th.tablsorter-headerDesc').css('background-image', "url('/" + Drupal.settings.blast.blastPath + "/desc.gif') !important");


// initially sort the top level results table on most hits, then org name, then db name
        $('#edit-result').bind('DOMNodeInserted DOMNodeRemoved', function(event) {
            if (event.type == 'DOMNodeInserted') {
                // if there is red error text in here, we need to close the submission/status popup
                if ($(this).css('color') == 'rgb(255, 0, 0)') {
                    $("#submissionDialog").dialog("close");
                }

                if ($("#topLevelTable").attr("data-initial") == "sortme") {
                    //console.log( 'declaring sort order' );
                    $("#topLevelTable").removeAttr('data-initial');
                    // declare our results table as sortable
                    $("#topLevelTable").tablesorter({
                        // sort on the third column (desc), then first column (asc), then 2nd(asc)
                        sortList: [[2, 1], [0, 0], [1, 0]],
                        headers: { 0 : {sorter: false },
                             1: {sorter:false},
                              2: {sorter:false}
                              }
                    });
                }

            }
        });

// load hsp results through ajax
        $(".dbResult").live("click", function(event) {

            var dataDb = $(this).attr("data-db");
            var dataType = $(this).attr("data-type");
            var dataNum = $(this).attr("data-num");
            // remove highlighting of previously checked dbs
            var resultsPresent = document.getElementById("hsps"+ dataNum);
            if (resultsPresent){
                var resultsRow = document.getElementsByClassName("data-num" + dataNum);
                $("#hsps" + dataNum).slideToggle("fast", function(){
		     $(resultsRow[0]).toggleClass("datasetHit", $(this).is(':visible'));
                if ($(".datasetHit")[0]){
		     $("#hspControl").show();
		}
		else {
                     $("#hspControl").hide();
		}
		});
            }
	    else {
	     $("#topLevelTable").tablesorter({
                  headers: { 0 : {sorter: false },
                             1: {sorter:false},
			      2: {sorter:false}
			}
		});
            $.ajax({
                type: "POST",
                data: "id=" + $(this).attr('data-id') + "&db=" + $(this).attr('data-db') + "&data-type=" + $(this).attr('data-type') + "&data-num=" + $(this).attr('data-num'),
                url: Drupal.settings.blast.blastPath + "/blastHspResults.php",
                success: function(msg) {

                    var topLevelTable = document.getElementById("topLevelTable");
                    var dataNum1 = "data-num" + dataNum;
		    var resultsRow = document.getElementsByClassName(dataNum1);
                    $(resultsRow[0]).addClass("datasetHit");
                    var resultsRow = topLevelTable.insertRow(resultsRow[0].rowIndex + 1);
		    var cell1 = resultsRow.insertCell();
                    resultsRow.setAttribute("id", "hsps"+ dataNum);
                    resultsRow.setAttribute("class", "hspsTable");
                    cell1.setAttribute("colspan", 3);
                    cell1.innerHTML =  msg;
                    $("#hspControl").html('<fieldset id="hspControlPanel" class="form-wrapper" style="padding:6px;margin:8px;4px;"><legend>Checked Hits</legend><div id="hspControlMessage"></div><button type="button" id="downloadSequences">Download</button><div id="passToClustalw"><button type="button" id="sendToClustal">Pass to ClustalW</button><input id="passWithQuery" form="hspControl" type="checkbox" checked=""> include query</div><button type="button" id="quickAlign">Quick align</button><div id="downloadSequencesStatus"></div></fieldset><div id="blastErrorDialog" title="BLAST Error Details"></div>');
                    $("#hspLevelResults").data("data-num", dataNum);
                    $("#hspLevelResults").data("data-db"+ dataNum, dataDb);
                    $("#hspLevelResults").data("data-type"+ dataNum, dataType);
                    $("#hspControl").show();
// declare our results table as sortable
   		   var hspsTable = "#hsps" + dataNum;
		   var blastHsps = "blastHsps" + dataNum;
                   var hspsTable = document.getElementById("hsps" + dataNum).getElementsByClassName("tablesorter")[0];
		   hspsTable.setAttribute("id", blastHsps);
		   var descHide = "#" + blastHsps + " > thead > tr > th.hspHitDesc";
		   var descHitHide = "#" + blastHsps + " > tbody > tr > td.hspHitDesc";
                   var evaluePosition = 6;
                    switch(dataType) {
                        case "Chromosomes":
                        case "Contigs":
                        case "Scaffolds":
                            $(descHide).hide();
			    $(descHitHide).hide();
                            break;
			case "Transcripts":
                        case "Peptides":
                            $(descHide).show();
		            $(descHitHide).show();
                            evaluePosition = 7;
                            break;
                        default:
                            $(descHide).show();
			    $(descHitHide).show();
                       }

                    addOrganismCol(dataNum);
// wouldn't work with blastHsps selctor because of the nested tables
                     blastHsps = "#" + blastHsps;
                     var box1 = Number(evaluePosition) + Number(3);
		     var box2 = Number(evaluePosition) + Number(4);
                    $(hspsTable).tablesorter({
			selectorHeaders: '> thead > tr > th',
                        headers: {
// disable sorting on checkbox column (we start counting zero)
                            0: {
                                sorter: false
                            },
// hit names are links but sort on the text inside the link
                            1: {
                                sorter: 'links'
                            },
// special case for evalue column
                            evaluePosition: {
                                sorter: 'scinot'
                            },
			    box1: {
			        sorter: false
			    },
			    box2: {
				sorter: false
			    },
                       },
// Here is where you should change the sorting by e-value
                        sortList: [[evaluePosition, 0]]
                    });
 		}
            });
        }
        });

	function addOrganismCol(dataNum){
		topLevel = document.getElementsByClassName("data-num" + dataNum);
		var orgName = topLevel[0].childNodes[1].innerHTML;
		//correct orgName at this point
		bottomTable = document.getElementById("blastHsps" + dataNum);
	        $(bottomTable).find('tr').each(function(){
		     var trow = $(this);
		     if (trow.index() === 0 && trow.parent('thead').length){
		     }
		     else {
			trow.append('<td class="tableOrgName" style="display:none;">' + orgName + '</td>');
	                var numCols = bottomTable.rows[1].cells.length - 1;
                        numCols = "td:eq(" + numCols + ")";
			var td2 = trow.find('td:eq(0)');
			var td1 = trow.find(numCols);
			td1.detach().insertAfter(td2);
		    }
		});
         }

// set defualt for animation speeds
        $.fx.speeds._default = 350;
// load popups with hsp details
        $(".hsp").live("click", function(event) {

            // conifg the dialog popups
            $("#hspDialog").dialog({
                autoOpen: false,
                show: "scale",
                hide: "scale",
                position: "center",
                width: 750,
                height: 600,
                maxWidth: 800,
                maxHeight: 1200,
                draggable: true,
                modal: true,
            });

            $("#hspDialog").dialog('open');
            $("#hspDialog").html('Retrieving HSP details<br/><img src="' + Drupal.settings.blast.blastPath + '/ajax-loader.gif">');
            $("#hspDialog").dialog('option', 'title', "BLAST HSP Details");

            $.ajax({
                type: "POST",
                data: "id=" + $(this).attr('id'),
                url: Drupal.settings.blast.blastPath + "/hspDetails.php",
                success: function(msg) {
                    $("#hspDialog").html(msg);
//$("#hspDialog").title("HSP Result");
                    $("#hspDialog").dialog('open');
                }
            });
        }); // end .hsp click events


// allow clicks in grayed out area to close the hsp details dialog
        $('.ui-widget-overlay').live("click", function() {
            //Close the dialog
            $("#hspDialog").dialog("close");
        });

// master toggle for hsp results
        $("#hspsMaster").live("click", function(event) {
	    var parentTable = this.parentNode.parentNode.parentNode.parentNode.parentNode;
	    var currId = parentTable.id.match(/[0-9]+/);
	    var selector = "#blastHsps" + currId + " > tbody > tr:nth-child(";
	    var childCount = $(selector).childElementCount;
	    if (!currId) {
	 	 selector = "#blastHsps" + " > tbody > tr:nth-child(";
	    }
	    for (var i =0; i < parentTable.rows.length; i++) {
		var newSelector = "";
		newSelector  =  selector + i + ") > td:nth-child(1) > input";
                $(newSelector).attr('checked', this.checked);
            }
            //$(".tablesorter .hsps").attr('checked', this.checked);
        });

// toggle query/hit graphics and numbers
        $("#hspGraphicTextSwitch").live(
            "click",
            function() {
                var hitNum = $(this).attr("class").match( /\d+/);
		var hspNum = ".hspnum" + hitNum;
                var showGraphics = $(hspNum).text() === 'Show Query/Hit Graphics';
                // initial state is graphic
		var id = 'table[id=\'blastHsps' + hitNum;
		var ids = "blastHsps" + hitNum;
		var table = document.getElementById(ids)
		if (!hitNum) {
		    table = document.getElementById("blastHsps");
		    id = 'table[id=\'blastHsps';
		    showGraphics = $('#hspGraphicTextSwitch').text() == 'Show Query/Hit Graphics';
		    hspNum = '#hspGraphicTextSwitch';
		}
		var lastColumn = table.rows[1].cells.length;
		lastColumn = lastColumn - 1;
                var qG = lastColumn - 4;
		var hG = lastColumn - 1;
		var qS = lastColumn - 5;
		var qE = lastColumn - 3;
		var hS = lastColumn - 2;
		var hE = lastColumn;
             	$(id + '\'] thead tr').each(
	           function() {
                        if (showGraphics) {
                            $(this).find('th').eq(qG).show();
                            $(this).find('th').eq(hG).show();
                            $(this).find('th').eq(qS).hide();
                            $(this).find('th').eq(qE).hide();
                            $(this).find('th').eq(hS).hide();
                            $(this).find('th').eq(hE).hide();
                        } else {
                            $(this).find('th').eq(qG).hide();
                            $(this).find('th').eq(hG).hide();
                            $(this).find('th').eq(qS).show();
                            $(this).find('th').eq(qE).show();
                            $(this).find('th').eq(hS).show();
                            $(this).find('th').eq(hE).show();
                        }
                    }
		);
                $(id + '\'] tbody tr').each(
                    function() {
                        if (showGraphics) {
                            $(this).find('td').eq(qG).show();
                            $(this).find('td').eq(hG).show();
                            $(this).find('td').eq(qS).hide();
                            $(this).find('td').eq(qE).hide();
                            $(this).find('td').eq(hS).hide();
                            $(this).find('td').eq(hE).hide();
                            $(hspNum).text("Show Query/Hit Numbers");
                        } else {
                            $(this).find('td').eq(qG).hide();
                            $(this).find('td').eq(hG).hide();
                            $(this).find('td').eq(qS).show();
                            $(this).find('td').eq(qE).show();
                            $(this).find('td').eq(hS).show();
                            $(this).find('td').eq(hE).show();
                            $(hspNum).text("Show Query/Hit Graphics");
                        }
                    }
                );
            });

//TODO: detect if user has uploaded file:
// $(function() {
//    $("input:file").change(function (){
//      var fileName = $(this).val();
//      $(".filename").html(fileName);
//    });
//  });

// download job results

        $("#expand").live("click", function(event){
	     var expanded = document.getElementById('expand').style.display;
	     var expandResults = document.getElementsByClassName("dbResult");
	     if (expanded == 'none' ){}
	     else {
	        $("#hspDialog").dialog({
                autoOpen: false,
                show: "scale",
                hide: "scale",
                position: "center",
                width: 250,
                height: 150,
                maxWidth: 800,
                maxHeight: 1200,
                draggable: true,
                modal: true,
                });
                 $("#hspDialog").dialog('open');
                 $("#hspDialog").html('Expanding all Results<br/><img src="' + Drupal.settings.blast.blastPath + '/ajax-loader.gif">');


	          for (var i = 0; i < expandResults.length; i++){
	          	var thisDataNum= $(expandResults[i]).attr('data-num');
	        	var alreadyExpanded = document.getElementById("hsps" + thisDataNum);
		        var alreadyExpandedTitle = document.getElementsByClassName("data-num" + thisDataNum);
                        if (!alreadyExpanded) {
		            $(expandResults[i]).click();
		        }
			else {
			    $(alreadyExpanded).show();
			    $(alreadyExpandedTitle[0]).addClass("datasetHit");
			}
	          }
		  //TODO: change to check for last element, rather than timeout
	          setTimeout( function() {$("#hspDialog").dialog("close");}, 5000);
	          document.getElementById('sortAll').style.display = 'inline';
	          }
	});
	$("#sortAll").live("click", function(event){
            document.getElementById('expand').style.display = 'none';
	    $("#expand").click();
	    collectHspResults();
	    deleteGeneNames();
	    makeSortableTable();
	    document.getElementById('sortAll').style.display = 'none';
            });
	function makeSortableTable(event){
	                $(blastHsps).tablesorter({
		        //selectorHeaders: '> thead > tr > th',
                        headers: {
// disable sorting on checkbox column (we start counting zero)
                            0: {
                                sorter: false
                            },
// hit names are links but sort on the text inside the link
                            2: {
                                sorter: 'links'
                            },
			    3: {
				sorter: false
			    },
// special case for evalue column
                            6: {
                                sorter: 'scinot'
                            },
			    9: {
			        sorter: false
			    },
			    10: {
				sorter: false
			    },
			    11: {
				sorter:false
			    },
                            12: {
                                sorter: false
                            },
                            13: {
                                sorter: false
                            },
			    14: {
                                sorter: false
                            },
                        },
// Here is where you should change the sorting by e-value
                        sortList: [[6, 0]]
                    });
	}

        function clearTitles(event){
	   var datasetHit = document.getElementsByClassName("datasetHit");
                for (var j = 0; j < datasetHit.length + 1; j++){
                     $(datasetHit[j]).hide();
                }
	  var graphicSwitch = document.getElementsByClassName("hspGraphicText");
	        for (var j = 0; j < graphicSwitch.length + 1; j++){
                    $(graphicSwitch[j]).hide();
                }
        }

       function collectHspResults(event){
	   var allHspResults = document.getElementsByClassName("hspTableHits");
	   var sortedAllTable = document.getElementById("topLevelResults");
           var tableData = "";
	   var sortedAllTableInnerHTML = '<div style="float:right; clear:both; padding:2px 0px;"><a id="hspGraphicTextSwitch" class="hspGraphicText">Show Query/Hit Numbers</a></div> \
                <table id="blastHsps" class="tablesorter hspTableHits" style="width: 870px;"> \
                        <thead> \
                                <tr> \
                                        <th style="width:16px; padding-left:3px;"> \
                                                <input type="checkbox" id="hspsMaster" name="selectedHsps" value="all" /> \
                                        </th> \
					<th class="tableOrgName">Organism</th> \
                                        <th class="hspHitName">Hit</th> \
                                        <th class="hspHitDesc">Description</th> \
                                        <th class="hspQueryName">Query</th> \
                                        <th class="hspQueryStringLen">Aln Length</th> \
                                        <th class="sorter-scinot" style="width:8%;">E-value</th> \
                                        <th style="width:7%;">Score</th> \
                                        <th style="width:7%;">Identity</th> \
                                        <th id="queryStart" class="rightAln queryText" style="display:none;">Query Start</th> \
                                        <th id="queryGraphic" class="queryText sorter-false" style="width:114px;">Query Hit</th> \
                                        <th id="queryEnd" class="leftAln queryText" style="display:none;">Query End</th> \
                                        <th id="hitStart" class="rightAln dbText" style="display:none;">Hit Start</th> \
                                        <th id="hitGraphic" class="dbText sorter-false" style="width:114px;">DB Sequence Hit</th> \
                                        <th id="hitEnd" class="leftAln dbText" style="display:none;">Hit End</th> \
                                </tr> \
                        </thead> \
                        <tbody>';
	         for (var i =0; i < allHspResults.length; i++){
		     for (var j = 1; j < allHspResults[i].rows.length; j++){
			  tableData += allHspResults[i].rows[j].innerHTML + "</tr>";
		     }

                 }
		sortedAllTableInnerHTML += tableData + "</tbody></table>";
		sortedAllTable.innerHTML= sortedAllTableInnerHTML;
       }

       function deleteGeneNames (event){
		//Can't just hide the class, otherwise the tablesorter won't work right
                var deleteGeneNames = document.getElementsByClassName("hspHitGeneName");
               while (deleteGeneNames.length > 0) {
                        deleteGeneNames[0].remove();
			deleteGeneNames = document.getElementsByClassName("hspHitGeneName");
		}
		$('.hspHitDesc').hide();
          	$('.tableOrgName').show();
       }
        $("#dlResults").live("click", function(event) {
            //Commenting out old code
            //var string = 'id=' + $(this).attr('data-jobid');
            //$.download(Drupal.settings.xgrid.xgridPath + '/downloadResults.php', string);
            var id = $(this).attr('data-jobid');
            var string = 'download=True';
            $.download('/tool_helpers/rest/' + id + '/results_raw', string);
        });

// download checked sequences
        $("#downloadSequences").live(
            "click",
            function(event) {
                var i = 0;
                var string = '';
                var uNames = new Array();
                var dataDbs = new Array();
                var dataTypes = new Array();
                var truncates = new Array();
                var displayMessage = false;
                $(".hsps:checked").each(
                    function() {
                        dataNum = $(this).attr('data-num');
                        dataDb = $("#hspLevelResults").data('data-db'+dataNum);
                        dataType_value = $("#hspLevelResults").data('data-type' + dataNum);
                        if ($.inArray(dataDb, dataDbs) < 0) {
                          dataDbs.push(dataDb);
                          dataDb = dataDb.replace('.fa', '');
                          dataType = dataDb + '-data-type=' + dataType_value;
                          dataTypes.push(dataType);
                          truncate = dataDb + '-truncate=' + (dataType_value === 'Chromosomes');
                          truncates.push(truncate);
                        } else {
                          dataDb = dataDb.replace('.fa', '');
                        }
                        //Adding the hsps hits
                        string = string + dataDb + '[]=' + $(this).val() + '&';
                        i++;
                        if(dataType_value !== 'Chromosomes') {
                            var title = $(this).attr('hitName');
                            //dataDbs.push(dataDb);
                            if(uNames.indexOf(title) < 0) {
                                uNames.push(title);
                            }
                        } else {
                            displayMessage = true;
                        }
                    }
                );
                string = string + 'jobid=' + $("#jobId").text();
                //Need to make this into array
                string = string + '&data-db=' + dataDbs;
                string = string + '&' + dataTypes.join('&');
                string = string + '&' + truncates.join('&');

                //Display a message informing users that the chromosomes are
                //truncated if they are downloading them
                if (displayMessage) {
                    $("#hspControlMessage").html('Note: Download hits from <i>Chromosomes</i> are truncated because of their generally large size.  See the <a href="downloads">download section</a> for full chromosome sequences.');
                } else {
                    $('#hspControlMessage').html('');
                }
                if (i > 0) {
                    $.download(Drupal.settings.blast.blastPath + '/downloadSequences.php', string);
                } else {
                    postError("Download", "No sequences selected");
                }
            }
        );

        function postError(errorTitle, message) {
            errorTitle = (typeof errorTitle	=== "undefined") ? "Error Title" : errorTitle;
            message = (typeof message === "undefined") ? "Error Message" : message;
            $("#blastErrorDialog").dialog({
                autoOpen: false,
                show: "scale",
                hide: "scale",
                position: "center",
                width: 600,
                height: 300,
                maxWidth: 750,
                maxHeight: 450,
                draggable: true,
                modal: true,
                buttons: {
                    Ok: function() {
                        $(this).dialog("close");
                    }
                },
            });
            $("#blastErrorDialog").dialog('option', 'title', errorTitle);
            $("#blastErrorDialog").html(message);
            $("#blastErrorDialog").dialog('open');
        }
// send checked sequences to clustalw
        function sendToClustal(event) {

            var eventTitle = '';
            var HSP_TO_CLUSTALW_HIT_NUM_LIMIT = 50;
            var HSP_TO_CLUSTALW_SEQ_CODE_LIMIT = 3000;
            switch (this.id) {
                case 'sendToClustal':
                    eventTitle = 'Send to Clustalw';
                    HSP_TO_CLUSTALW_HIT_NUM_LIMIT = 50;
                    HSP_TO_CLUSTALW_SEQ_CODE_LIMIT = 3000;
                    break;
                case 'quickAlign':
                    eventTitle = 'Quick align';
                    HSP_TO_CLUSTALW_HIT_NUM_LIMIT = 10;
                    HSP_TO_CLUSTALW_SEQ_CODE_LIMIT = 2000;
                    break;
                default:
                    eventTitle = 'Undefined event type';
                    HSP_TO_CLUSTALW_HIT_NUM_LIMIT = 10;
                    HSP_TO_CLUSTALW_SEQ_CODE_LIMIT = 1000;
            }

            var i = 0;
            var string = '';
            var hitSizes = {};

            // Adding query option
            if (this.id === 'sendToClustal' &&
                $('#hspControl #passWithQuery').attr('checked')) {
                string = string + 'query=' + jobId + '&';
            }
            // END OF Adding query option

            //var dataType = $('#hspLevelResults').data('data-type');

            var bailEarly = false;
            $(".hsps:checked").each(function() {
                var hspId = $(this).val();
                var hspTitle = $(".hsp[id=" + hspId + "]").attr("title");
                if (!(hspTitle in hitSizes)) {
                    hitSizes[hspTitle] = [];
                }

                string = string + 'hsp' + i + '=' + hspId;
                var hstart = $(this).attr("hstart");
                var hend = $(this).attr("hend");
                hitSizes[hspTitle].push(Math.abs(hend - hstart));

                //if('chromosomes' === dataType.toLowerCase()) {
                string = string + ':' + hstart + '-' + hend + '&';
                //}
                //string=string+'&';
                i++;

                // Break out if user has selected too many hits.
                if (i > HSP_TO_CLUSTALW_HIT_NUM_LIMIT) {
                    postError(eventTitle, "Please only select up to " + HSP_TO_CLUSTALW_HIT_NUM_LIMIT + " HSP hits.");
                    bailEarly = true;
                    return false;
                }
            });
            if (bailEarly) {
                return;
            }
            var hitErrors = '';
            for (var hspTitle in hitSizes) {
                hitSizes[hspTitle].forEach(function(hitSize) {
                    if (hitSize > HSP_TO_CLUSTALW_SEQ_CODE_LIMIT) {
                        hitErrors = hitErrors.concat(hspTitle + " (" + hitSize + "), ");
                    }
                });
            }
            hitErrors = hitErrors.substring(0, hitErrors.length - 2);
            if (hitErrors) {
                postError(eventTitle, "You have selected one or more hsp hits with bounded sequence lengths that exceed " + HSP_TO_CLUSTALW_SEQ_CODE_LIMIT + ". If you would like to have the entire (hsp bounded) sequences, please use the \"Download\" button to get them in fasta file format. They are " + hitErrors);
                return;
            }

            if (i == 0) {
                postError(eventTitle, "No sequences selected");
                return;
            }

            // Everything is good. Now do work!
            switch (this.id) {
                case 'sendToClustal':
                    $.customPost('/clustalw', string);
                    break;
                case 'quickAlign':
                    if (i === 1) {
                        postError(eventTitle, "ClustalW needs at least 2 sequences to align.");
                        return;
                    }

                    // conifg the dialog popups
                    $("#hspDialog").dialog({
                        autoOpen: false,
                        show: "scale",
                        hide: "scale",
                        position: "center",
                        width: 750,
                        height: 600,
                        maxWidth: 800,
                        maxHeight: 1200,
                        draggable: true,
                        modal: true,
                    });

                    $("#hspDialog").dialog('open');
                    $("#hspDialog").html('Aligning sequences with ClustalW<br/><img src="' + Drupal.settings.blast.blastPath + '/ajax-loader.gif">');
                    $("#hspDialog").dialog('option', 'title', eventTitle);

                    $.ajax({
                        type: "POST",
                        data: string,
                        url: Drupal.settings.clustalw.clustalwPath + '/quickAlign.php',
                        success: function(msg) {
                            $("#hspDialog").html(msg);
                            $("#hspDialog").dialog('open');
                        }
                    });
                    break;
            }
        }

        $("#sendToClustal").live("click", sendToClustal);
        $("#quickAlign").live("click", sendToClustal);
// send checked sequences to clustalw
        /*$("#quickAlign").live("click",function (event) {
         var i=0;
         var string='';
         var titles = {};
         $(".hsps:checked").each(function() {
         var hspId = $(this).val();
         var hspTitle = $(".hsp[id="+hspId+"]").attr("title");
         if(!(hspTitle in titles)) {
         titles[hspTitle] = 0;
         }
         titles[hspTitle]+=1;
         string=string+'hsp'+i+'='+hspId+'&';
         i++;
         });
         var hspList = '';
         for(var prop in titles){
         if(titles[prop]>1) {
         hspList = hspList.concat(prop + ", ");
         }
         }
         hspList = hspList.substring(0, hspList.length - 2);
         if(hspList) {
         postError("Quick align", "You have selected two or more hits with the same sequence(s) ("+hspList+"). Please select only one of each.");
         return;
         }
         if(i>1){
         // conifg the dialog popups
         $("#hspDialog").dialog({
         autoOpen: false,
         show: "scale",
         hide: "scale",
         position: "center",
         width: 750,
         height: 600,
         maxWidth: 800,
         maxHeight: 1200,
         draggable: true,
         modal: true,
         });

         $("#hspDialog").dialog('open');
         $("#hspDialog").html('Aligning sequences with ClustalW<br/><img src="'+Drupal.settings.blast.blastPath+'/ajax-loader.gif">');
         $("#hspDialog").dialog('option','title',"Quick Align");

         $.ajax({
         type: "POST",
         data: string,
         url: Drupal.settings.clustalw.clustalwPath+'/quickAlign.php',
         success: function(msg){
         $("#hspDialog").html(msg);
         $("#hspDialog").dialog('open');
         }
         });
         } else{
         postError("Quick align", "ClustalW needs at least 2 sequences to align.");
         }
         });*/

// fire the program changed event on page load
        $("input[name='program']", '#blast-ajax-form').trigger('change');

// handle a get/post organism= variable on page load
//        $(".dbs[data-org=" + $(".form-checkbox:checked").parent().parent().attr('data-org') + "]:checkbox").attr('checked', 'checked');
        setAvailableDbs($("input[name='program']:checked", '#blast-ajax-form').val());
        $(".organismCheckboxDiv[data-org=" + $(".form-checkbox:checked").parent().parent().attr('data-org') + "]").trigger('mouseover');

        jQuery.customPost = function(url, data) {
            //url and data options required
            if (url && data) {
                //data can be string of parameters or array/object
                data = typeof data == 'string' ? data : jQuery.param(data);
                //split params into form inputs
                var inputs = '';
                jQuery.each(data.split('&'), function() {
                    var pair = this.split('=');
                    inputs += '<input type="hidden" name="' + pair[0] + '" value="' + pair[1] + '" />';
                });
                //send request
                jQuery('<form action="' + url + '" method="post" target="_blank">' + inputs + '</form>')
                    .appendTo('body').submit().remove();
            }
            ;
        };


        jQuery.download = function(url, data, method) {
            //url and data options required
            if (url && data) {
                //data can be string of parameters or array/object
                data = typeof data == 'string' ? data : jQuery.param(data);
                //split params into form inputs
                var inputs = '';
                jQuery.each(data.split('&'), function() {
                    var pair = this.split('=');
                    inputs += '<input type="hidden" name="' + pair[0] + '" value="' + pair[1] + '" />';
                });
                //send request
                jQuery('<form action="' + url + '" method="' + (method || 'post') + '">' + inputs + '</form>')
                    .appendTo('body').submit().remove();
            }
            ;
        };


// add extension to tablesorter pluggin so we can sort scientific notation
        $.tablesorter.addParser({
            // set a unique id
            id: 'scinot',
            is: function(s, table, cell, $cell) {
                return /[+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?/.test(s);
            },
            format: function(s, table, cell, cellIndex) {
                //return $.tablesorter.formatFloat(s);
                return $.tablesorter.formatFloat(s);
            },
            type: 'numeric'
        });


        $.tablesorter.addParser({
            // set a unique id
            id: 'links',
            is: function(s) {
// return false so this parser is not auto detected
                return false;
            },
            format: function(s) {
// format your data for normalization
                return s.replace(new RegExp(/<.*?>/), "");
            },
// set type, either numeric or text
            type: 'text'
        });

        //The following checks if the look up id was passed through a query
        //parameter.  If it was, look up the job atuomatically
        if ($('#edit-lookup').val() != '') {
            submitBlast();
            jQuery('#edit-jobid').html('<div id="condor-id">' + $('#edit-lookup').val() + '</div>')
        }

    });
})(jQuery);

;
/**
* hoverIntent r6 // 2011.02.26 // jQuery 1.5.1+
* <http://cherne.net/brian/resources/jquery.hoverIntent.html>
* 
* @param  f  onMouseOver function || An object with configuration options
* @param  g  onMouseOut function  || Nothing (use configuration options object)
* @author    Brian Cherne brian(at)cherne(dot)net
*/
(function($){$.fn.hoverIntent=function(f,g){var cfg={sensitivity:7,interval:100,timeout:0};cfg=$.extend(cfg,g?{over:f,out:g}:f);var cX,cY,pX,pY;var track=function(ev){cX=ev.pageX;cY=ev.pageY};var compare=function(ev,ob){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t);if((Math.abs(pX-cX)+Math.abs(pY-cY))<cfg.sensitivity){$(ob).unbind("mousemove",track);ob.hoverIntent_s=1;return cfg.over.apply(ob,[ev])}else{pX=cX;pY=cY;ob.hoverIntent_t=setTimeout(function(){compare(ev,ob)},cfg.interval)}};var delay=function(ev,ob){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t);ob.hoverIntent_s=0;return cfg.out.apply(ob,[ev])};var handleHover=function(e){var ev=jQuery.extend({},e);var ob=this;if(ob.hoverIntent_t){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t)}if(e.type=="mouseenter"){pX=ev.pageX;pY=ev.pageY;$(ob).bind("mousemove",track);if(ob.hoverIntent_s!=1){ob.hoverIntent_t=setTimeout(function(){compare(ev,ob)},cfg.interval)}}else{$(ob).unbind("mousemove",track);if(ob.hoverIntent_s==1){ob.hoverIntent_t=setTimeout(function(){delay(ev,ob)},cfg.timeout)}}};return this.bind('mouseenter',handleHover).bind('mouseleave',handleHover)}})(jQuery);;
/*
 * Superfish v1.4.8 - jQuery menu widget
 * Copyright (c) 2008 Joel Birch
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 * CHANGELOG: http://users.tpg.com.au/j_birch/plugins/superfish/changelog.txt
 */

(function($){
  $.fn.superfish = function(op){
    var sf = $.fn.superfish,
      c = sf.c,
      $arrow = $(['<span class="',c.arrowClass,'"> &#187;</span>'].join('')),
      over = function(){
        var $$ = $(this), menu = getMenu($$);
        clearTimeout(menu.sfTimer);
        $$.showSuperfishUl().siblings().hideSuperfishUl();
      },
      out = function(){
        var $$ = $(this), menu = getMenu($$), o = sf.op;
        clearTimeout(menu.sfTimer);
        menu.sfTimer=setTimeout(function(){
          o.retainPath=($.inArray($$[0],o.$path)>-1);
          $$.hideSuperfishUl();
          if (o.$path.length && $$.parents(['li.',o.hoverClass].join('')).length<1){over.call(o.$path);}
        },o.delay);
      },
      getMenu = function($menu){
        var menu = $menu.parents(['ul.',c.menuClass,':first'].join(''))[0];
        sf.op = sf.o[menu.serial];
        return menu;
      },
      addArrow = function($a){ $a.addClass(c.anchorClass).append($arrow.clone()); };

    return this.each(function() {
      var s = this.serial = sf.o.length;
      var o = $.extend({},sf.defaults,op);
      o.$path = $('li.'+o.pathClass,this).slice(0,o.pathLevels).each(function(){
        $(this).addClass([o.hoverClass,c.bcClass].join(' '))
          .filter('li:has(ul)').removeClass(o.pathClass);
      });
      sf.o[s] = sf.op = o;

      $('li:has(ul)',this)[($.fn.hoverIntent && !o.disableHI) ? 'hoverIntent' : 'hover'](over,out).each(function() {
        if (o.autoArrows) addArrow( $('>a:first-child',this) );
      })
      .not('.'+c.bcClass)
        .hideSuperfishUl();

      var $a = $('a',this);
      $a.each(function(i){
        var $li = $a.eq(i).parents('li');
        $a.eq(i).focus(function(){over.call($li);}).blur(function(){out.call($li);});
      });
      o.onInit.call(this);

    }).each(function() {
      var menuClasses = [c.menuClass];
      if (sf.op.dropShadows  && !($.browser.msie && $.browser.version < 7)) menuClasses.push(c.shadowClass);
      $(this).addClass(menuClasses.join(' '));
    });
  };

  var sf = $.fn.superfish;
  sf.o = [];
  sf.op = {};
  sf.IE7fix = function(){
    var o = sf.op;
    if ($.browser.msie && $.browser.version > 6 && o.dropShadows && o.animation.opacity!=undefined)
      this.toggleClass(sf.c.shadowClass+'-off');
    };
  sf.c = {
    bcClass: 'sf-breadcrumb',
    menuClass: 'sf-js-enabled',
    anchorClass: 'sf-with-ul',
    arrowClass: 'sf-sub-indicator',
    shadowClass: 'sf-shadow'
  };
  sf.defaults = {
    hoverClass: 'sfHover',
    pathClass: 'overideThisToUse',
    pathLevels: 1,
    delay: 800,
    animation: {opacity:'show'},
    speed: 'normal',
    autoArrows: true,
    dropShadows: true,
    disableHI: false, // true disables hoverIntent detection
    onInit: function(){}, // callback functions
    onBeforeShow: function(){},
    onShow: function(){},
    onHide: function(){}
  };
  $.fn.extend({
    hideSuperfishUl : function(){
      var o = sf.op,
        not = (o.retainPath===true) ? o.$path : '';
      o.retainPath = false;
      var $ul = $(['li.',o.hoverClass].join(''),this).add(this).not(not).removeClass(o.hoverClass)
          .find('>ul').hide().css('visibility','hidden');
      o.onHide.call($ul);
      return this;
    },
    showSuperfishUl : function(){
      var o = sf.op,
        sh = sf.c.shadowClass+'-off',
        $ul = this.addClass(o.hoverClass)
          .find('>ul:hidden').css('visibility','visible');
      sf.IE7fix.call($ul);
      o.onBeforeShow.call($ul);
      $ul.animate(o.animation,o.speed,function(){ sf.IE7fix.call($ul); o.onShow.call($ul); });
      this.css('z-index','9999');
      return this;
    }
  });
})(jQuery);
;
/*
 * Supersubs v0.2b - jQuery plugin - LAST UPDATE: MARCH 23rd, 2011
 * Copyright (c) 2008 Joel Birch
 *
 * Jan 16th, 2011 - Modified a little in order to work with NavBar menus as well.
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 * This plugin automatically adjusts submenu widths of suckerfish-style menus to that of
 * their longest list item children. If you use this, please expect bugs and report them
 * to the jQuery Google Group with the word 'Superfish' in the subject line.
 *
 */

(function($){ // $ will refer to jQuery within this closure

  $.fn.supersubs = function(options){
    var opts = $.extend({}, $.fn.supersubs.defaults, options);
	// return original object to support chaining
    return this.each(function() {
      // cache selections
      var $$ = $(this);
      // support metadata
      var o = $.meta ? $.extend({}, opts, $$.data()) : opts;
      // get the font size of menu.
      // .css('fontSize') returns various results cross-browser, so measure an em dash instead
      var fontsize = $('<li id="menu-fontsize">&#8212;</li>').css({
        'padding' : 0,
        'position' : 'absolute',
        'top' : '-99999em',
        'width' : 'auto'
      }).appendTo($$).width(); //clientWidth is faster, but was incorrect here
      // remove em dash
      $('#menu-fontsize').remove();

      // Jump on level if it's a "NavBar"
      if ($$.hasClass('sf-navbar')) {
        $$ = $('li > ul', $$);
      }
      // cache all ul elements 
      $ULs = $$.find('ul:not(.sf-megamenu)');
      // loop through each ul in menu
      $ULs.each(function(i) {
        // cache this ul
        var $ul = $ULs.eq(i);
        // get all (li) children of this ul
        var $LIs = $ul.children();
        // get all anchor grand-children
        var $As = $LIs.children('a');
        // force content to one line and save current float property
        var liFloat = $LIs.css('white-space','nowrap').css('float');
        // remove width restrictions and floats so elements remain vertically stacked
        var emWidth = $ul.add($LIs).add($As).css({
          'float' : 'none',
          'width'  : 'auto'
        })
        // this ul will now be shrink-wrapped to longest li due to position:absolute
        // so save its width as ems. Clientwidth is 2 times faster than .width() - thanks Dan Switzer
        .end().end()[0].clientWidth / fontsize;
        // add more width to ensure lines don't turn over at certain sizes in various browsers
        emWidth += o.extraWidth;
        // restrict to at least minWidth and at most maxWidth
        if (emWidth > o.maxWidth)    { emWidth = o.maxWidth; }
        else if (emWidth < o.minWidth)  { emWidth = o.minWidth; }
        emWidth += 'em';
        // set ul to width in ems
        //
        // GREG Changed this line to 'auto'
//        $ul.css('width',emWidth);
        $ul.css('width','auto');
	// restore li floats to avoid IE bugs
        // set li width to full width of this ul
        // revert white-space to normal
        $LIs.css({
          'float' : liFloat,
          'width' : '100%',
	  'line-height':'1.5em',
	// GREG Changed this line from normal to nowrap
          'white-space' : 'nowrap'
        })
        // update offset position of descendant ul to reflect new width of parent
        .each(function(){
          var $childUl = $('>ul',this);
          var offsetDirection = $childUl.css('left')!==undefined ? 'left' : 'right';
	  // GREG Changed emWidth to ul.width() to account for flexible sizes of parent menu (given nowrap above)
          i//$childUl.css(offsetDirection,emWidth);
          $childUl.css(offsetDirection,$ul.width());
	  // GREG This is all hackish
	  var $childLis = $childUl.children();
          $childUl.css({'width':'auto','border':'1px solid #366688','max-width':'190px' });
	  $childLis.css({'width':'100%', 'white-space':'nowrap'});

        });
      });

    });
  };
  // expose defaults
  $.fn.supersubs.defaults = {
    minWidth: 9, // requires em unit.
    maxWidth: 65, //was 25;  requires em unit.
    extraWidth: 3 //was 0;  extra width can ensure lines don't sometimes turn over due to slight browser differences in how they round-off values
  };

})(jQuery); // plugin code ends
;
/**
 * @file
 * The Superfish Drupal Behavior to apply the Superfish jQuery plugin to lists.
 */

(function ($) {
  Drupal.behaviors.superfish = {
    attach: function (context, settings) {
      // Take a look at each list to apply Superfish to.
      $.each(settings.superfish || {}, function(index, options) {
        // Process all Superfish lists.
        $('#superfish-' + options.id, context).once('superfish', function() {
          var list = $(this);

          // Check if we are to apply the Supersubs plug-in to it.
          if (options.plugins || false) {
            if (options.plugins.supersubs || false) {
              list.supersubs(options.plugins.supersubs);
            }
          }

          // Apply Superfish to the list.
          list.superfish(options.sf);

          // Check if we are to apply any other plug-in to it.
          if (options.plugins || false) {
            if (options.plugins.touchscreen || false) {
              list.sftouchscreen(options.plugins.touchscreen);
            }
            if (options.plugins.smallscreen || false) {
              list.sfsmallscreen(options.plugins.smallscreen);
            }
            if (options.plugins.supposition || false) {
              list.supposition();
            }
            if (options.plugins.bgiframe || false) {
              list.find('ul').bgIframe({opacity:false});
            }
          }
        });
      });
    }
  };
})(jQuery);;
