(function (VectorBaseSearch, $, undefined) {

  if (VectorBaseSearch.data == undefined) {
    VectorBaseSearch.data = {};
  }

  VectorBaseSearch.init_actions = function() {
    VectorBaseSearch.data.blast_job = {};

    var reference_species = $("tr:contains('Reference species') td:eq(1)").text();
    var pinwheel = '<br><img src="/' + Drupal.settings.blast.blastPath + '/ajax-loader.gif">';

    //Use reference species field to blast against if it is set, otherwise use
    //the species field to blast against
    if (reference_species != '') {
      VectorBaseSearch.data.blast_job.dbs = reference_species;
    } else {
      VectorBaseSearch.data.blast_job.dbs = $('#result-details-box i').text();
    }

    if ($('#sequence_s').html() != null) {
      VectorBaseSearch.data.blast_job.sequence = $('#sequence_s').html().replace(/<br>/g, '\n').replace('&gt;', '>');
    }

    if ($('#accession').text() != '') {
      VectorBaseSearch.data.blast_job.description = $('#accession').text();
    }

    $("#submissionDialog").dialog({
      autoOpen: false,
      show: "scale",
      hide: "scale",
      width: 270,
      height: 100,
      draggable: false,
      modal: true,
      title: "Blast Job Status"
    });

    $("#action-buttons button").click(function() {
      $("#submissionDialog").dialog("open");
      $("#submissionDialog").html("Blast job is running" + pinwheel);
      VectorBaseSearch.data.blast_job.program = $(this).text().toLowerCase().trim();

      $.ajax({
        type: "POST",
        timeout: 3200000,
        url: "/blast/rest/submit",
        data: VectorBaseSearch.data.blast_job,
        success: function(blast_job) {
          $("#submissionDialog").dialog("close");

          if (blast_job.status == 'done') {
            $("#action-result").html('Job <a target="_blank" href="/blast?job_id=' + blast_job.id + '">' + blast_job.id + '</a> ' + blast_job.status);
          } else {
            $("#action-result").html('Job ' + blast_job.id + ': ' + blast_job.status);
          }
        },
        error: function(msg) {
          $("#submissionDialog").dialog("open");
          $("#submissionDialog").html("Error: " + msg);
        }
      });
    });

    //Check if the copy command is supported by the browser
    if (!document.queryCommandSupported('copy')) {
      $('#copy-sequence').hide();
    }

    $('#copy-sequence').click(function (event) {
      var sequence = document.querySelector('#sequence_s');
      var range = document.createRange();
      range.selectNode(sequence);
      window.getSelection().addRange(range)

      //Execute the copy command, using try catch in case the if statement that
      //checks if the copy command is supported did not work as expected
      try {
        var successful = document.execCommand('copy');
      } catch(err) {
        windogs.alert("Copy command not supported by your browser");
      }

      window.getSelection().removeAllRanges();
    });

  };

  $(document).ready(function () {
    VectorBaseSearch.init_actions();
  });
})(window.VectorBaseSearch = window.VectorBaseSearch || {}, jQuery);
;
(function ($) {

Drupal.googleanalytics = {};

$(document).ready(function() {

  // Attach mousedown, keyup, touchstart events to document only and catch
  // clicks on all elements.
  $(document.body).bind("mousedown keyup touchstart", function(event) {

    // Catch the closest surrounding link of a clicked element.
    $(event.target).closest("a,area").each(function() {

      // Is the clicked URL internal?
      if (Drupal.googleanalytics.isInternal(this.href)) {
        // Skip 'click' tracking, if custom tracking events are bound.
        if ($(this).is('.colorbox') && (Drupal.settings.googleanalytics.trackColorbox)) {
          // Do nothing here. The custom event will handle all tracking.
          //console.info("Click on .colorbox item has been detected.");
        }
        // Is download tracking activated and the file extension configured for download tracking?
        else if (Drupal.settings.googleanalytics.trackDownload && Drupal.googleanalytics.isDownload(this.href)) {
          // Download link clicked.
          ga("send", {
            "hitType": "event",
            "eventCategory": "Downloads",
            "eventAction": Drupal.googleanalytics.getDownloadExtension(this.href).toUpperCase(),
            "eventLabel": Drupal.googleanalytics.getPageUrl(this.href),
            "transport": "beacon"
          });
        }
        else if (Drupal.googleanalytics.isInternalSpecial(this.href)) {
          // Keep the internal URL for Google Analytics website overlay intact.
          ga("send", {
            "hitType": "pageview",
            "page": Drupal.googleanalytics.getPageUrl(this.href),
            "transport": "beacon"
          });
        }
      }
      else {
        if (Drupal.settings.googleanalytics.trackMailto && $(this).is("a[href^='mailto:'],area[href^='mailto:']")) {
          // Mailto link clicked.
          ga("send", {
            "hitType": "event",
            "eventCategory": "Mails",
            "eventAction": "Click",
            "eventLabel": this.href.substring(7),
            "transport": "beacon"
          });
        }
        else if (Drupal.settings.googleanalytics.trackOutbound && this.href.match(/^\w+:\/\//i)) {
          if (Drupal.settings.googleanalytics.trackDomainMode !== 2 || (Drupal.settings.googleanalytics.trackDomainMode === 2 && !Drupal.googleanalytics.isCrossDomain(this.hostname, Drupal.settings.googleanalytics.trackCrossDomains))) {
            // External link clicked / No top-level cross domain clicked.
            ga("send", {
              "hitType": "event",
              "eventCategory": "Outbound links",
              "eventAction": "Click",
              "eventLabel": this.href,
              "transport": "beacon"
            });
          }
        }
      }
    });
  });

  // Track hash changes as unique pageviews, if this option has been enabled.
  if (Drupal.settings.googleanalytics.trackUrlFragments) {
    window.onhashchange = function() {
      ga("send", {
        "hitType": "pageview",
        "page": location.pathname + location.search + location.hash
      });
    };
  }

  // Colorbox: This event triggers when the transition has completed and the
  // newly loaded content has been revealed.
  if (Drupal.settings.googleanalytics.trackColorbox) {
    $(document).bind("cbox_complete", function () {
      var href = $.colorbox.element().attr("href");
      if (href) {
        ga("send", {
          "hitType": "pageview",
          "page": Drupal.googleanalytics.getPageUrl(href)
        });
      }
    });
  }

});

/**
 * Check whether the hostname is part of the cross domains or not.
 *
 * @param string hostname
 *   The hostname of the clicked URL.
 * @param array crossDomains
 *   All cross domain hostnames as JS array.
 *
 * @return boolean
 */
Drupal.googleanalytics.isCrossDomain = function (hostname, crossDomains) {
  /**
   * jQuery < 1.6.3 bug: $.inArray crushes IE6 and Chrome if second argument is
   * `null` or `undefined`, https://bugs.jquery.com/ticket/10076,
   * https://github.com/jquery/jquery/commit/a839af034db2bd934e4d4fa6758a3fed8de74174
   *
   * @todo: Remove/Refactor in D8
   */
  if (!crossDomains) {
    return false;
  }
  else {
    return $.inArray(hostname, crossDomains) > -1 ? true : false;
  }
};

/**
 * Check whether this is a download URL or not.
 *
 * @param string url
 *   The web url to check.
 *
 * @return boolean
 */
Drupal.googleanalytics.isDownload = function (url) {
  var isDownload = new RegExp("\\.(" + Drupal.settings.googleanalytics.trackDownloadExtensions + ")([\?#].*)?$", "i");
  return isDownload.test(url);
};

/**
 * Check whether this is an absolute internal URL or not.
 *
 * @param string url
 *   The web url to check.
 *
 * @return boolean
 */
Drupal.googleanalytics.isInternal = function (url) {
  var isInternal = new RegExp("^(https?):\/\/" + window.location.host, "i");
  return isInternal.test(url);
};

/**
 * Check whether this is a special URL or not.
 *
 * URL types:
 *  - gotwo.module /go/* links.
 *
 * @param string url
 *   The web url to check.
 *
 * @return boolean
 */
Drupal.googleanalytics.isInternalSpecial = function (url) {
  var isInternalSpecial = new RegExp("(\/go\/.*)$", "i");
  return isInternalSpecial.test(url);
};

/**
 * Extract the relative internal URL from an absolute internal URL.
 *
 * Examples:
 * - https://mydomain.com/node/1 -> /node/1
 * - https://example.com/foo/bar -> https://example.com/foo/bar
 *
 * @param string url
 *   The web url to check.
 *
 * @return string
 *   Internal website URL
 */
Drupal.googleanalytics.getPageUrl = function (url) {
  var extractInternalUrl = new RegExp("^(https?):\/\/" + window.location.host, "i");
  return url.replace(extractInternalUrl, '');
};

/**
 * Extract the download file extension from the URL.
 *
 * @param string url
 *   The web url to check.
 *
 * @return string
 *   The file extension of the passed url. e.g. "zip", "txt"
 */
Drupal.googleanalytics.getDownloadExtension = function (url) {
  var extractDownloadextension = new RegExp("\\.(" + Drupal.settings.googleanalytics.trackDownloadExtensions + ")([\?#].*)?$", "i");
  var extension = extractDownloadextension.exec(url);
  return (extension === null) ? '' : extension[1];
};

})(jQuery);
;