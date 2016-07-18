// ==UserScript==
// @name        webWincPartnernetChart
// @namespace   webWinc
// @include     https://partnernet.amazon.de/*
// @version     1
// @grant       GM_setValue
// @grant       GM_getValue
// @require https://ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js
// ==/UserScript==


// Determine if user is already logged in - otherwise do nothing
// Not necessary since Amazon redirects faulty pages


// Find out which page is currently displayed!
var opt = GM_getValue('webWincPartnernetChartGlobalOptions', {});
var path = [location.protocol, '//', location.host, location.pathname].join('');
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
    // Refresh the amzEndDateOption
    opt.amzEndDate = parseDateFromMiniReport('#mini-report .note');
    ;
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
    // Determine the date of the most recent downloaded Data
    var mostRecentDate;
    if (opt.tagsReport) {
        mostRecentDate = new Date(opt.tagsReport.date);
    } else {
        var amzStartYear = $('select[name=startYear] option:first').attr("value");
        var amzStartMonth = $('select[name=startMonth] option:first').attr("value");
        var amzStartDay = $('select[name=startDay] option:first').attr("value");
        mostRecentDate = new Date(amzStartYear, amzStartMonth, amzStartDay);
    }
    if (mostRecentDate == opt.amzEndDate) {
        return tagsReportChart();
    } else {
        downloadTagsReportDataWithDelay();
    }
}
function downloadTagsReportDataWithDelay() {
    console.log("downloadTagsReportDataWithDelay");
    var opt = GM_getValue("webWincPartnernetChartGlobalOptions");
    var amzDate = new Date(opt.amzEndDate);
    var mostRecentDate;
    if (opt.tagsReport) {
        mostRecentDate = new Date(opt.tagsReport.date);
    } else {
        var amzStartYear = $('select[name=startYear] option:first').attr("value");
        var amzStartMonth = $('select[name=startMonth] option:first').attr("value");
        var amzStartDay = $('select[name=startDay] option:first').attr("value");
        mostRecentDate = new Date(amzStartYear, amzStartMonth, amzStartDay - 1);
    }
    if (amzDate > mostRecentDate) {
        var div = $('#webWincPartnernetChart');
        console.log(div);
        if (!div.length) {
            $('#content div[class=breadcrumb]').after("<div id='webWincPartnernetChart'> </div>");
            div = $('#webWincPartnernetChart');
        }
        var currentDate = new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), mostRecentDate.getDate() + 1);
        var days = Math.round((amzDate - currentDate) / 1000 / 86400);
        div.html('Downloading data for ' + days + ' days. <br> Estimated Time Remaining: ' + days * 3 + ' seconds');

        downloadTagsReportSingleDay(currentDate);
        setTimeout(downloadTagsReportDataWithDelay, 500);
    }
}
function downloadTagsReportSingleDay(date) {
    console.log("downloadTagsReportSingleDay");
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
    $details.each(function () {
        var $this = $(this);
        var tag = $this.attr('tag');
        var earnings = parseFloat($this.attr('TotalEarnings').replace(",", "."));
        var clicks = parseInt($this.attr('Clicks'));
        var orderedUnits = parseInt($this.attr('OrderedUnits'));
        var shippedUnits = parseInt($this.attr('ShippedUnits'));
        //Clicks    OrderedUnits ShippedUnits
        if (earnings > 0 || clicks > 0 || shippedUnits > 0) {
            objects.tag = {
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
    opt.tagsReport = opt.tagsReport || {};
    opt.tagsReport.date = date;
    GM_setValue("webWincPartnernetChartGlobalOptions", opt);
    //return {date: date, tagData: objects};

    //console.log(date);
}
function tagsReportChart() {
    console.log("chart should be displayed");
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