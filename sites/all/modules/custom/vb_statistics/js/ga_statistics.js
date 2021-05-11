(function ($) {
  // Get the CSV and create the chart
  $('#referrals').highcharts({
    chart: {
      type: 'pie'
    },
    data: {
      googleSpreadsheetKey: '1apJxT4qn1-3Zm6rl_PVQxxqnZPjcGObuS8OoKs92DXk'
    },
    title: {
      text: 'Referrals from other sources (Past Year)'
    },
    subtitle: {
      text: 'Source: Google Analytics'
    },
    legend: {
      align: 'left',
      verticalAlign: 'top',
      y: 20,
      floating: true,
      borderWidth: 0
    },
    tooltip: {
      shared: true,
      crosshairs: true
    },
  }); //end referrals

  $.getJSON('/google_apis/rest/analytics?dateRange[]=2017-08-08 TO 2018-08-14&metrics[]=ga:avgSessionDuration&dimensions[]=ga:date', function(data) {
    $('#sessionDuration').highcharts({
      chart: {
        zoomType: 'x'
      },
      series: data,
      title: {
        text: 'Average Session Duration'
       },
      subtitle: {
        text: 'Source: Google Analytics'
      },
      yAxis: {
        title: {
          text: 'Minutes'
        }
      },
      xAxis: {
        type: 'datetime'
      },
      legend: {
        align: 'left',
        verticalAlign: 'top',
        y: 20,
        floating: true,
        borderWidth: 0
      },
      tooltip: {
        shared: true,
        crosshairs: true
      },
      plotOptions: {
        series: {
          cursor: 'pointer',
          point: {
            events: {
              click: function (e) {
                hs.htmlExpand(null, {
                  pageOrigin: {
                    x: e.pageX || e.clientX,
                    y: e.pageY || e.clientY
                  },
                  headingText: this.series.name,
                  maincontentText: Highcharts.dateFormat('%A, %b %e, %Y', this.x) + ':<br/> ' +
                  this.y + ' minutes',
                  width: 200
                });
              }
            }
          },
          marker: {
            lineWidth: 1
          }
        }
      },
    });
  });

  $('#downloadCounts').highcharts({
    chart: {
      zoomType: 'x'
    },
    data: {
      googleSpreadsheetKey: '176FUEQgVcbXSH29GFmB-yFH20knqons3OC_9UV11ZV4'
    },
    title: {
      text: 'Daily Datasets Downloaded'
     },
    subtitle: {
      text: 'Source: Internal Logs'
    },
    yAxis: {
      title: {
        text: 'Number of Downloads'
      }
    },
    legend: {
      align: 'left',
      verticalAlign: 'top',
      y: 20,
      floating: true,
      borderWidth: 0
    },
    tooltip: {
      shared: true,
      crosshairs: true
    },
    plotOptions: {
      series: {
        cursor: 'pointer',
        point: {
          events: {
            click: function (e) {
              hs.htmlExpand(null, {
                pageOrigin: {
                  x: e.pageX || e.clientX,
                  y: e.pageY || e.clientY
                },
                headingText: this.series.name,
                maincontentText: Highcharts.dateFormat('%A, %b %e, %Y', this.x) + ':<br/> ' +
                this.y + ' Number of Downloads',
                width: 200
              });
            }
          }
        },
        marker: {
          lineWidth: 1
        }
      }
    },
  }); //end Download Counts

  $('#apolloEdits').highcharts({
    chart: {
      zoomType: 'x'
    },
    data: {
      googleSpreadsheetKey: '1qQpi-34Vj9x5zDq8so8pfUd55wmTfYyByIvc8-C9txM'
    },
    title: {
      text: 'Daily Apollo Edits'
     },
    subtitle: {
      text: 'Source: Apollo Logs'
    },
    yAxis: {
      title: {
        text: 'Number of Edits'
      }
    },
    legend: {
      align: 'left',
      verticalAlign: 'top',
      y: 20,
      floating: true,
      borderWidth: 0
    },
    tooltip: {
      shared: true,
      crosshairs: true
    },
    plotOptions: {
      series: {
        cursor: 'pointer',
        point: {
          events: {
            click: function (e) {
              hs.htmlExpand(null, {
                pageOrigin: {
                  x: e.pageX || e.clientX,
                  y: e.pageY || e.clientY
                },
                headingText: this.series.name,
                maincontentText: Highcharts.dateFormat('%A, %b %e, %Y', this.x) + ':<br/> ' +
                this.y + ' edits',
                width: 200
              });
            }
          }
        },
        marker: {
          lineWidth: 1
        }
      }
    },
  }); //end Apollo Edits

  $.getJSON('/google_apis/rest/analytics?dateRange[]=2018-01-08 TO 2018-08-14&metrics[]=ga:pageviews&dimensions[]=ga:date', function(data) {
    $('#pageviews').highcharts({
      chart: {
        zoomType: 'x'
      },
      data: {
        googleSpreadsheetKey: '1qM5vNL90_V2jruChfBeb2sQK-LS8ih-Fr-xsfzxqwxU'
      },
      title: {
        text: 'Daily Visits'
       },
      subtitle: {
        text: 'Source: Google Analytics'
      },
      yAxis: {
        title: {
          text: 'Pageviews'
        }
      },
      legend: {
        align: 'left',
        verticalAlign: 'top',
        y: 20,
        floating: true,
        borderWidth: 0
      },
      tooltip: {
        shared: true,
        crosshairs: true
      },
      plotOptions: {
        series: {
          cursor: 'pointer',
          point: {
            events: {
              click: function (e) {
                hs.htmlExpand(null, {
                  pageOrigin: {
                    x: e.pageX || e.clientX,
                    y: e.pageY || e.clientY
                  },
                  headingText: this.series.name,
                  maincontentText: Highcharts.dateFormat('%A, %b %e, %Y', this.x) + ':<br/> ' +
                  this.y + ' visits',
                  width: 200
                });
              }
            }
          },
          marker: {
            lineWidth: 1
          }
        }
      },
    }); //end pageviews
  });

  $.getJSON('/google_apis/rest/analytics?dateRange[]=2018-01-08 TO 2018-08-14&metrics[]=ga:sessions&metrics[]=ga:searchSessions&metrics[]=ga:newUsers&dimensions[]=ga:date', function(data) {
    $('#dailySearch').highcharts({
      chart: {
        zoomType: 'x'
      },
      data: {
        googleSpreadsheetKey: '1SuRogGnNyYWl1JHcGAr1rTB-bIuEdcAvw9amSBAIQpc'
      },
      title: {
        text: 'Daily Users and Searches'
       },
      subtitle: {
        text: 'Source: Google Analytics'
      },
      yAxis: {
        title: {
          text: 'Users/Sessions with Search'
        }
      },
      legend: {
        align: 'left',
        verticalAlign: 'top',
        y: 20,
        floating: true,
        borderWidth: 0
      },
    }); //end daily searches and users
  });

})(jQuery);

