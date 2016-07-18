// ==UserScript==
// @name        webWincPartnernetChart
// @namespace   webWinc
// @include     https://partnernet.amazon.de/*
// @version     1
// @grant       GM_setValue
// @grant       GM_getValue
// @require https://ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js
// @require https://code.highcharts.com/stock/highstock.js
// ==/UserScript==


// Determine if user is already logged in - otherwise do nothing
// Not necessary since Amazon redirects faulty pages


// Find out which page is currently displayed!

var path = [location.protocol, '//', location.host, location.pathname].join('');
var div = webWincDiv();
switch (path) {
    case "https://partnernet.amazon.de/gp/associates/network/main.html":
        homePage();
        break;
    case "https://partnernet.amazon.de/gp/associates/network/reports/report.html":
        reportsPage();
        break;
}
GM_setValue('webWincPartnernetChartGlobalOptions', opt);
//console.log(path);

function homePage() {
    var opt = GM_getValue('webWincPartnernetChartGlobalOptions');

    // Refresh the amzEndDateOption

    opt.amzEndDate = parseDateFromMiniReport('#mini-report .note');
    /*
     InfoBox to manage Chart functions
     */

    div.html('<button class="webWinc" value="deleteTagsReport">Delete TagsReportData</button>');
    $('.webWinc').click(buttonClicked);
}
function reportsPage() {
    var reportsType = parseQueryString().reportType || "earningsReport";
    switch (reportsType) {
        case 'tagsReport':
            tagsReport();
            break;
        default:
            console.log("reportsType not yet implemented");
            break;
    }
}
function tagsReport() {
    console.log("tagsReport");
    /*
     Initialize some variables
     */
    var div = webWincDiv();
    var opt = GM_getValue('webWincPartnernetChartGlobalOptions', {});

    // Determine the date of the most recent downloaded Data
    var mostRecentDate;

    if (opt.tagsReport && opt.tagsReport.date) {
        mostRecentDate = new Date(opt.tagsReport.date);
    } else {
        var amzStartYear = $('select[name=startYear] option:first').attr("value");
        var amzStartMonth = $('select[name=startMonth] option:first').attr("value");
        var amzStartDay = $('select[name=startDay] option:first').attr("value");
        mostRecentDate = new Date(amzStartYear, amzStartMonth, amzStartDay);
    }


    /*
     Download new data if available
     */
    var amzDate = new Date(opt.amzEndDate);
    if (amzDate > mostRecentDate) {

        var currentDate = new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), mostRecentDate.getDate() + 1);
        var days = Math.round((amzDate - currentDate) / 1000 / 86400);
        div.html('Downloading data for ' + days + ' days. <br> Estimated Time Remaining: ' + days * 3 + ' seconds');

        downloadTagsReportSingleDay(currentDate);
        return setTimeout(tagsReport, 300);

    }

    /*
     Display the Chart!
     */
    var data = GM_getValue('webWincPartnernetChartTagsReport');
    var series = {};
    for (var tag in opt.tagsReport.tags) {
        series[tag] = {
            name: tag,
            data: [],
        };
    }
    var firstEntry = false;
    for (var year in data) {
        for (var month in data[year]) {
            for (var day in data[year][month]) {
                var obj = data[year][month][day];
                var date = new Date(year, month, day).getTime();
                if (firstEntry || Object.keys(obj).length) {
                    firstEntry = true;
                    for (var tag in opt.tagsReport.tags) {
                        if (obj[tag]) {
                            //console.log(obj[tag]);
                            var earning = obj[tag].earnings;
                        } else {
                            var earning = 0;
                        }
                        series[tag].data.push([date, earning]);
                    }

                }
            }
        }
    }
    var dataSeries = [];
    for (var key in series) {
        dataSeries.push(series[key]);
    }
    stockChart(dataSeries, div);

}
function downloadTagsReportSingleDay(date) {
    var DbData = GM_getValue('webWincPartnernetChartTagsReport', {});
    var opt = GM_getValue('webWincPartnernetChartGlobalOptions');
    var url = "https://partnernet.amazon.de/gp/associates/network/reports/report.html";
    var data = $.ajax({
        url: url,
        type: 'GET',
        async: false,
        data: {
            __mk_de_DE: "%C3%85M%C3%85%C5%BD%C3%95%C3%91",
            tag: null,
            reportType: "tagsReport",
            preSelectedPeriod: "yesterday",
            periodType: "exact",
            startDay: date.getDate(),
            startMonth: date.getMonth(),
            startYear: date.getFullYear(),
            endDay: date.getDate(),
            endMonth: date.getMonth(),
            endYear: date.getFullYear(),
            "submit.download_XML.x": Math.round(Math.random() * 160),
            "submit.download_XML.y": Math.round(Math.random() * 22)
        }
    });
    var xml = data.responseText;
    var $xml = $(xml);
    var $details = $xml.find('OneTag');
    //console.log($details);
    var objects = {};
    opt.tagsReport = opt.tagsReport || {};
    opt.tagsReport.tags = opt.tagsReport.tags || {};

    $details.each(function () {
        var $this = $(this);
        var tag = $this.attr('tag');
        opt.tagsReport.tags[tag] = true;
        var earnings = parseFloat($this.attr('TotalEarnings').replace(",", "."));
        var clicks = parseInt($this.attr('Clicks'));
        var orderedUnits = parseInt($this.attr('OrderedUnits'));
        var shippedUnits = parseInt($this.attr('ShippedUnits'));
        //Clicks    OrderedUnits ShippedUnits
        if (earnings > 0 || clicks > 0 || shippedUnits > 0) {
            objects[tag] = {
                earnings: earnings,
                clicks: clicks,
                orderedUnits: orderedUnits,
                shippedUnits: shippedUnits
            };
        }

    });

    DbData[date.getFullYear()] = DbData[date.getFullYear()] || {};
    DbData[date.getFullYear()][date.getMonth()] = DbData[date.getFullYear()][date.getMonth()] || {};
    DbData[date.getFullYear()][date.getMonth()][date.getDate()] = objects;
    GM_setValue('webWincPartnernetChartTagsReport', DbData);

    opt.tagsReport.date = date;

    GM_setValue("webWincPartnernetChartGlobalOptions", opt);
    //return {date: date, tagData: objects};

    //console.log(date);
}
function parseQueryString() {
    var urlParams = {};
    var url = location.search;
    url.replace(
        new RegExp("([^?=&]+)(=([^&]*))?", "g"),
        function ($0, $1, $2, $3) {
            urlParams[$1] = $3;
        }
    );

    return urlParams;
}
function parseDateFromMiniReport(queryString) {
    var dateParts = $(queryString).html().split(" ");
    var items = dateParts.length;
    var year = dateParts[items - 1];
    var germanMonths = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    var month = germanMonths.indexOf(dateParts[items - 2]);
    var day = dateParts[items - 3];


    return new Date(year, month, day);
}
function webWincDiv() {

    var div = $('#webWincPartnernetChart');
    if (!div.length) {
        $('#content div:first').after("<div id='webWincPartnernetChart'> </div>");
        div = $('#webWincPartnernetChart');
    }
    return div;
}
function buttonClicked() {
    var $button = $(this);
    switch ($button.attr('value')) {
        case 'deleteTagsReport':
            GM_setValue('webWincPartnernetChartTagsReport', {});
            var opt = GM_getValue('webWincPartnernetChartGlobalOptions');
            opt.tagsReport.date = null;
            GM_setValue('webWincPartnernetChartGlobalOptions', opt);
            break;
        default:
            console.log('buttonClicked not defined for this button');
            break;
    }

}
function stockChart(series, div) {
    console.log("fired");
    // Create the chart
    div.highcharts('StockChart', {
        chart: {
            zoomType: 'x'
        },
        legend: {
            enabled: true,
        },
        rangeSelector: {
            allButtonsEnabled: true,
            buttons: [{
                type: 'month',
                count: 3,
                text: 'Day',
                dataGrouping: {
                    forced: true,
                    units: [
                        ['day', [1]]
                    ]
                }
            }, {
                type: 'year',
                count: 1,
                text: 'Week',
                dataGrouping: {
                    forced: true,
                    units: [
                        ['week', [1]]
                    ]
                }
            }, {
                type: 'month',
                count: 24,
                text: 'Month',
                dataGrouping: {
                    forced: true,
                    units: [
                        ['month', [1]]
                    ],
                    approximation: "sum",
                }
            }],
            buttonTheme: {
                width: 60
            },
            selected: 2
        },
        xAxis: {
            type: 'datetime',
        },
        yAxis: {
            title: {
                text: 'Earnings (€)'
            }
        },

        title: {
            text: 'Amazon Partnernet Revenue'
        },
        subTitle: {},

        series: series,

    });
    div.highcharts().reflow();

}