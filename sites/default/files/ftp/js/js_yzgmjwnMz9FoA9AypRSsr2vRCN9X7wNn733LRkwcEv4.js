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
/*
 * Javascript for the About page.
 */

(function($) {
  $(function() {
    /*
     * This section handles the page's slideshows
     */

    // Start all slideshows at first slide
    $('.slideshow-container', '#use-cases-wrapper').each(function() {
      aboutShowSlide(this, 0);
    });

    // Previous slide button listener
    $('.prev', '#use-cases-wrapper').click(function() {
      var $slideshow = $(this).closest('.slideshow-container');
      var index = $slideshow.find('.active-slide').index();
      aboutShowSlide($slideshow, index -= 1);
    });

    // Next slide button listener
    $('.next', '#use-cases-wrapper').click(function() {
      var $slideshow = $(this).closest('.slideshow-container');
      var index = $slideshow.find('.active-slide').index();
      aboutShowSlide($slideshow, index += 1);
    });

    // Slide indicator listener ('dot')
    $('.dot', '#use-cases-wrapper').click(function() {
      // Find out which dot was clicked
      var n = $(this).index();
      var $slideshow = $(this).closest('.slideshow-container');
      aboutShowSlide($slideshow, n);
    });

    // Show a slide given the slideshow object and the slide's number
    function aboutShowSlide($slideshow, n) {
      var $slides = $($slideshow).find('.slide');
      var $dots = $($slideshow).find('.dot');

      // Wrap slideshow
      if (n >= $slides.length) {
        slideIndex = 0;
      } 
      else if (n < 0) {
        slideIndex = $slides.length - 1
      }
      else {
        slideIndex = n;
      }

      $($slides).removeClass('active-slide'); 
      $($dots).removeClass('active-dot');
      $slides[slideIndex].className += ' active-slide'; 
      $dots[slideIndex].className += ' active-dot';
    }

    // Allow keyboard controls for fullscreen slideshow
    $(document).keyup(function(event) {
      var $overlay = $('#image-overlay');

      if ($overlay.css('display') === 'block') {
        var $slideshow = $overlay.find('.slideshow-container');

        switch (event.which) {
          // Right arrow
          case 39:
            $slideshow.find('.next').click();
            break;
          // Left arrow
          case 37:
            $slideshow.find('.prev').click();
            break;
          // Escape
          case 27:
            $overlay.click();
            break;
        }
      }
    });


    /*
     * This section handles the image overlay
     */

    // Show overlay when an image is clicked
    $('.use-case-image', '#use-cases-wrapper').click(function() {
      var $container = $(this).closest('.fullscreen-container');

      // Copy so we don't move the existing object
      // clone(true) because we want to keep most event handlers
      // But do need to remove image click event
      var $copy = $($container).clone(true);
      $copy.find('.use-case-image').unbind('click');

      // Also remove fade animation
      $copy.find('.slide.fade').removeClass('fade');

      // Put $copy into #image-overlay and display overlay
      $('#image-overlay').html($copy).css('display', 'block');
    });

    // Hide overlay when it's clicked
    $('#image-overlay').click(function(event) {
      var target = event.target;

      // Only hide if the user clicked on the overlay background
      // First condition is for image overlay, second is for slideshow overlay
      if (target === this || $(target)[0] === $(this).find('.fullscreen-container')[0]) {
        $(this).css('display', 'none');
      }
    });
  })
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
