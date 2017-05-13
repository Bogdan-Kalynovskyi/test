/*global google*/
/*global URL*/
/*global moment*/
/*global moment.tz*/
/*global qstatistics_begin*/
function qstatistics_begin(EMBEDDED) {


    function Report(options, container, formEl) {
        var report = this,
            visibleCols = [],
            visibleRows = [],
            currentEndTime,
            reorder = [],
            colPos,
            rowPos,
            colPos1,//
            colZZZ,
            loggedInPos,
            colPosLength,
            table,
            sortingCol = 0,
            sortingOrder = 1,
            timeColVisible,

            START,
            END,

            minHold,
            minTalk,
            minTotal,
            maxHold,
            maxTalk,
            maxTotal,
            sumHold,
            sumTalk,
            sumTotal,
            maxLoggedIn,

            menuButtons,
            containerClientWidth,

            equalHeight,
            toggleLROverlay;


        // CONSTANTS
        var DAY = 86400,

            columnNames = [
                '',
                'totalcalls',
                'slaok',
                'answercalls',
                'noanswercalls',
                'incalls',
                'inanswer',
                'innoanswer',
                'internalcalls',
                'internalanswer',
                'internalnoanswer',
                'outcalls',
                'outanswer',
                'outnoanswer',
                'holdmin',
                'holdavg',
                'holdmax',
                'holdtotal',
                'talkmin',
                'talkavg',
                'talkmax',
                'talktotal',
                'totalmin',
                'totalavg',
                'totalmax',
                'totaltotal',
                'abandon',
                'noagent',
                'timeout',
                'keypress',
                'agent',
                'caller',
                'transfer',
                'logintime'
            ],
            destinationNames = [
                'allcalls',
                'inbound',
                'internal',
                'outbound'
            ],
            COLUMNS = [
                '',
                'Total calls',
                'SLA ok',
                'Answered',
                'Not answered',
                'Inbound calls',
                'Inbound answered',
                'Inbound no answer',
                'Internal calls',
                'Internal answered',
                'Internal no answer',
                'Outbound calls',
                'Outbound answered',
                'Outbound no answer',
                'Hold time min',
                'Hold time avg',
                'Hold time max',
                'Hold time total',
                'Talk time min',
                'Talk time avg',
                'Talk time max',
                'Talk time total',
                'Total time min',
                'Total time avg',
                'Total time max',
                'Total time total',
                'Abandoned by caller',
                'No agents available',
                'Time-out in queue',
                'Key press by caller',
                'Agent completed',
                'Caller completed',
                'Transfer by agent',
                'Available time'
            ],

            COL_timeStart = 14,
            COL_talkMin = 18,
            COL_totalMin = 22,
            COL_timeEnd = 26,
            COL_loggedIn = 33;


        options.type = options.type || 'table';
        options.period = +options.period;         // special greeting to options.period
        options.totalrow = +options.totalrow;     // special greeting to options.totalrow


        function QAgentEvents() {
            this.events = [];            // is always kept sorted


            // Sort array of objects by .time
            function byTime(a, b) {
                return a.time - b.time;
            }


            // Takes htmlNodesCollection and adds them to array. Checks for duplicates. Sorts. Returns whether array was changed
            this.add = function (arr) {
                var isChanged = false;

                for (var i = 0, n = arr.length; i < n; i++) {
                    var event = {
                        time: +arr[i].time,
                        isLogin: arr[i].event === 'agentlogin'
                    };

                    for (var j = this.events.length - 1; j >= 0; j--) {
                        if (this.events[j].time === event.time && this.events[j].isLogin === event.isLogin) {
                            event = null;
                            break;
                        }
                    }

                    if (event) {
                        this.events.push(event);
                        isChanged = true;
                    }
                }

                if (isChanged) {
                    this.events.sort(byTime); // todo no sort
                }

                return isChanged;
            };


            // Calculates Available time in period between periodStart and periodEnd.
            // Tricky thing is to group events into login-logout pairs.
            this.calcLoggedTime = function (periodStart, periodEnd) {
                var start,              // start and end of logged in period,
                    end,                // is composed out of a pair of events.
                    clear,              // marker that we're done with current start-end pair, so start over again
                    i = 0,
                    total = 0,
                    event = this.events[0];

                // when first event is logoff, and it is inside bounds, then virtually add login event before it
                if (event && !event.isLogin && event.time >= periodStart) {
                    start = periodStart;
                }

                while (event && event.time < periodEnd) {
                    clear = false;

                    if (event.isLogin) {
                        start = event.time;
                    }
                    else {
                        end = event.time;
                    }

                    if (end <= periodStart) {                           // completely out of bounds
                        clear = true;
                    }
                    else if (start && end) {                            // gathered a pair, which is at least partially in bounds
                        total += Math.min(periodEnd, end) - Math.max(periodStart, start);
                        clear = true;
                    }

                    if (clear) {                                        // clear that pair, and search for a new one
                        start = undefined;
                        end = undefined;
                    }

                    i++;
                    event = this.events[i];
                }

                if (start && start < periodEnd && !end) {               // unfinished pair in bounds, agent is still logged in
                    total += Math.min(Date.now() / 1000, periodEnd) - Math.max(periodStart, start);
                }

                return total;
            };
        }


        function Chart() {
            var that = this,
                currentTab,
                type,
                loggedInTimeDivider,
                timeUnit,
                tableHeader,
                dataTable,
                charts = {},
                zoomingOverlay = byId('zooming-overlay'),
                resetZoomBtn = byId('zoom-out'),
                rectSVG,
                startX,
                endX = null,
                goodEvt,
                lastPieSourceStr,
                lastPieSource,
                pieSource,
                byCol,
                byRow,
                hiddenInPie,
                pauseRedraw,
                dateFormat = CONFIG.dateformat.replace('YYYY', 'yyyy').replace('DD', 'dd'),
                chartArea = {
                    left: '5.5%',
                    top: 0,
                    height: (EMBEDDED ? '62%' : null),
                    bottom: '19%'
                },
                legend = {
                    position: 'top',
                    maxLines: 3
                },
                series = {},
                chartOptions = {
                    linechart: {
                        sliceVisibilityThreshold: 0,
                        chartArea: chartArea,
                        legend: legend,
                        fontName: "Arial, sans-serif",
                        backgroundColor: "transparent"
                    },
                    barchart: {
                        sliceVisibilityThreshold: 0,
                        chartArea: chartArea,
                        legend: legend,
                        fontName: "Arial, sans-serif",
                        backgroundColor: "transparent",
                        bar: {groupWidth: "90%"}
                    },
                    stacked: {
                        isStacked: true,
                        sliceVisibilityThreshold: 0,
                        chartArea: chartArea,
                        legend: legend,
                        fontName: "Arial, sans-serif",
                        backgroundColor: "transparent",
                        bar: {groupWidth: "90%"}
                    },
                    piechart: {
                        is3D: true,
                        sliceVisibilityThreshold: 0,
                        fontName: "Arial, sans-serif",
                        backgroundColor: "transparent"
                    }
                };


            function getPieSource() {
                var split = options.piesource;
                if (split) {
                    split = split.split('_');
                    pieSource = {
                        by: split[0],
                        id: +split[1]
                    };
                }
                else {
                    pieSource = {
                        by: 'column',
                        id: colPos1
                    };
                }
            }


            function colorizeChart(type) {
                var colors = [
                    "gray",
                    "#bec1d4",
                    "green",
                    "red",
                    "blue",
                    "#d6bcc0",
                    "#bb7784",
                    "purple",
                    "#023fa5",
                    "#7d87b9",
                    "orange",
                    "#8e063b",
                    "#4a6fe3",
                    "#8595e1",
                    "#b5bbe3",
                    "#e6afb9",
                    "#e07b91",
                    "#d33f6a",
                    "#11c638",
                    "#8dd593",
                    "#c6dec7",
                    "#ead3c6",
                    "#f0b98d",
                    "#ef9708",
                    "#0fcfc0",
                    "#9cded6",
                    "#d5eae7",
                    "#f3e1eb",
                    "#f6c4e1",
                    "#f79cd4",
                    "yellow"
                ];

                if (type === 'piechart') {
                    var arr = [];
                    if (pieSource.by === 'row') {
                        var totalCallsColOnly = colPosLength === 1;
                        for (var i = 1; i < colPosLength; i++) {
                            if (colPos[i] !== 1 || totalCallsColOnly) {      // don't include "Total calls" column
                                arr.push({color: colors[colPos[i]]});
                            }
                        }
                        chartOptions.piechart.colors = arr;
                    }
                    else if (options.period === 0) {
                        if (rowPos.length) {
                            for (i = 0, n = rowPos.length; i < n; i++) {
                                arr.push({color: colors[rowPos[i]]});
                            }
                            for (i = visibleRows.length, n = colors.length; i < n; i++) {
                                arr.push({color: colors[i]});
                            }
                            chartOptions.piechart.colors = arr;
                        }
                        else {
                            delete chartOptions.piechart.colors;
                        }
                    }
                    else {
                        delete chartOptions.piechart.colors;
                    }
                }
                else {
                    for (i = 1; i < colPosLength; i++) {
                        series[i] = {color: colors[colPos[i]]};
                    }
                    chartOptions[type].series = series;
                }
            }


            function renderPieSourceSelect() {
                var str = 'Display:<label> column <select id="piechart-by-column"><option value>Choose column</option>',
                    isRendered = false;

                for (var i = 1, n = COLUMNS.length; i < n; i++) {
                    if (visibleCols[i]) {
                        str += '<option value="' + i + '">' + COLUMNS[i] + '</option>';
                    }
                }

                str += '</select></label><label> or row <select id="piechart-by-row"><option value>Choose row</option>';

                for (i = 0, n = table.length; i < n; i++) {
                     if (options.period === 0 || table[i].total) {
                         // todo use real positions for period === 0 (destinations)
                        str += '<option value="' + i + '">' + table[i][0] + '</option>';
                    }
                }
                str += '</select></label>';
                if (str !== lastPieSourceStr) {
                    byId('piechart-chooser').innerHTML = str;
                    lastPieSourceStr = str;
                    isRendered = true;

                    byCol = byId('piechart-by-column');
                    byRow = byId('piechart-by-row');

                    // set dropdown behaviour
                    byCol.onchange = function () {
                        if (this.value === '' && pieSource.by === 'column') {
                            this.value = pieSource.id;
                            return;
                        }
                        pieSource = {
                            by: 'column',
                            id: +this.value
                        };
                        byRow.value = '';
                        options.piesource = pieSource.by + '_' + pieSource.id;
                        FORM.enableSaveButton();
                        colorizeChart('piechart');
                        renderPieChart();
                    };
                    byRow.onchange = function () {
                        if (this.value === '' && pieSource.by === 'row') {
                            this.value = pieSource.id;
                            return;
                        }
                        pieSource = {
                            by: 'row',
                            id: +this.value
                        };
                        byCol.value = '';
                        options.piesource = pieSource.by + '_' + pieSource.id;
                        FORM.enableSaveButton();
                        colorizeChart('piechart');
                        renderPieChart();
                    };
                }

                if (isRendered || !lastPieSource || lastPieSource.by !== pieSource.by || lastPieSource.id !== pieSource.id) {
                    // set dropdowns' value
                    if (pieSource.by === 'column') {
                        byCol.value = pieSource.id;
                    }
                    else {
                        byRow.value = pieSource.id;
                    }
                    lastPieSource = pieSource;
                }
            }


            function cacheTableHeader(pieChartRow, pieChartCol) {
                var maxNumber = 0,
                    maxLoggedIn1 = 0,
                    row;

                // when table row is displayed as pie chart
                if (pieChartRow !== undefined) {
                    row = table[pieChartRow];
                    for (var i = 1; i < colPosLength; i++) {
                        if (i === loggedInPos) {
                            maxLoggedIn1 = Math.max(maxLoggedIn1, row[i]);
                        }
                        else {
                            maxNumber = Math.max(maxNumber, row[i]);
                        }
                    }
                    loggedInTimeDivider = maxNumber ? (maxLoggedIn1 / maxNumber * 21) : maxLoggedIn;
                }
                // when logged in time column is displayed
                else if (pieChartCol === COL_loggedIn) {
                    loggedInTimeDivider = maxLoggedIn;      // average
                }
                // not a pie chart
                else if (visibleCols[COL_loggedIn]) {
                    for (i = 0, n = table.length; i < n; i++) {
                        row = table[i];
                        for (var j = 1; j < colPosLength; j++) {
                            maxNumber = Math.max(maxNumber, row[j]);
                        }
                    }
                    loggedInTimeDivider = maxNumber ? (maxLoggedIn / maxNumber * 21) : maxLoggedIn;
                }

                if (loggedInTimeDivider > DAY) {
                    loggedInTimeDivider = DAY;
                    timeUnit = ' (days)';
                }
                else if (loggedInTimeDivider > 3600) {
                    loggedInTimeDivider = 3600;
                    timeUnit = ' (hours)';
                }
                else if (loggedInTimeDivider > 60) {
                    loggedInTimeDivider = 60;
                    timeUnit = ' (minutes)';
                }
                else if (loggedInTimeDivider > 0) {
                    loggedInTimeDivider = 1;
                    timeUnit = ' (seconds)';
                }
                else {
                    loggedInTimeDivider = Infinity;
                    timeUnit = '';
                }

                tableHeader = [options.period ? 'Time' : 'Destination'];

                if (!pieChartCol) {
                    for (i = 1; i < colPosLength; i++) {
                        tableHeader.push(COLUMNS[colPos[i]] + ((i === loggedInPos) ? timeUnit : ''));
                    }
                }
            }


            function getPieDataTable() {
                var pieChartOptions = chartOptions.piechart,
                    row,
                    id = pieSource.id,
                    data = [['', '']],                    // in pieChart, first row seems not to have any useful information
                    sumOfVisibleCells = 0;
                // todo what if piechart displays only duration cols?
                // display units for duration cols to make them more friendly

                hiddenInPie = [];

                if (pieSource.by === 'column') {
                    if (colPosLength) {
                        if (!visibleCols[id]) {
                            id = colPos1;
                            pieSource.id = id;
                            if (!EMBEDDED) {
                                byCol.value = id;
                            }
                            options.piesource = pieSource.by + '_' + pieSource.id;
                        }
                        cacheTableHeader(undefined, id);
                        var pos = colZZZ[id],
                            i = (!options.period && +options.allcalls) ? 1 : 0,              // in Destination mode, don't show "All calls" in chart
                            n = table.length - (options.totalrow ? 1 : 0);                   // also, never show "Total" row in piechart

                        if (i === n && table.length > 1) {
                            if (options.totalrow) {
                                n++;
                            }
                            else if (+options.allcalls) {
                                i--;
                            }
                        }

                        for (; i < n; i++) {
                            row = table[i];
                            if (id !== COL_loggedIn) {
                                if (options.period === 0 || row.total) {
                                    data.push([row[0], row[pos]]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += row[pos];
                                }
                            }
                            else {
                                if (row[pos] || row.hasLIT) {
                                    data.push([row[0] + timeUnit, +(row[pos] / loggedInTimeDivider).toFixed(2)]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += row[pos];
                                }
                            }
                        }
                    }
                    else if (!EMBEDDED) {
                        byCol.selectedIndex = 0;
                    }
                }

                // todo save the ordering
                else {
                    if (!(table[id] && (options.period === 0 || table[id].total))) {
                        for (i = 0, n = table.length; i < n; i++) {
                            if (table[i].total) {
                                break;
                            }
                        }
                        if (i < n) {
                            id = i;
                            pieSource.id = id;
                            if (!EMBEDDED) {
                                byRow.value = id;
                            }
                            options.piesource = pieSource.by + '_' + pieSource.id;
                        }
                        else if (!EMBEDDED) {
                            byRow.selectedIndex = 0;
                        }
                    }

                    if (table[id] && (options.period === 0 || table[id].total)) {
                        var totalCallsPos = colZZZ[0];

                        if (colPosLength === 1 && visibleCols[0]) {
                            totalCallsPos = -1;
                        }

                        cacheTableHeader(id);
                        row = table[id];

                        for (i = 1, n = tableHeader.length; i < n; i++) {
                            if (i !== totalCallsPos || row.length === 2) {
                                if (i !== loggedInPos) {
                                    data.push([tableHeader[i], row[i]]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += row[i];
                                }
                                else if (options.period || row[i]) {
                                    data.push([tableHeader[i], +(row[i] / loggedInTimeDivider).toFixed(2)]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += row[i];
                                }
                            }
                        }
                    }
                }

                if (sumOfVisibleCells && data.length > 1) {
                    pieChartOptions.legend = legend;
                    pieChartOptions.pieSliceText = 'percentage';
                    pieChartOptions.enableInteractivity = true;
                    pieChartOptions.chartArea = {
                        top: '16%',
                        bottom: '1%',
                        left: '4.4%',
                        right: '1.6%'
                    };

                }
                else {                                       // all cols should be given as an option, but they don't always contain data
                    data = [['', ''], ['No calls', 1]];
                    pieChartOptions.legend = 'none';
                    pieChartOptions.pieSliceText = 'label';
                    pieChartOptions.enableInteractivity = false;
                    pieChartOptions.chartArea = null;
                }

                return google.visualization.arrayToDataTable(data);
            }


            function getDataTable() {
                cacheTableHeader();
                var data = [tableHeader],
                    hasIntegerCols = false,
                    hasDurationCols = false,
                    colAxisIndex = [],
                    j = 0,
                    m = table.length - (options.totalrow ? 1 : 0);            // for time-based reports, don't show "Total" row

                for (; j < m; j++) {
                    var dbRow = table[j],
                        row = dbRow.slice();

                    // for time - based reports
                    if (SAME_TZ && options.period > 0) {
                        var start = dbRow.intervals[0][0];
                        row[0] = new Date(start * 1000);
                    }

                    for (var i = 1; i < colPosLength; i++) {
                        var i1 = colPos[i],
                            j1 = i,
                            isTime = i1 >= COL_timeStart && i1 < COL_timeEnd;

                        if (isTime) {
                            row[j1] = UTILS.googleTimeFormat(row[j1]);
                        }
                        else if (i1 === COL_loggedIn) {
                            // If agent was logged in for the whole time, the "logged in" chart should look as a straight line.
                            // For time-period-based that.report type, row[0] is a Date object
                            if ((!TABLE || sortingCol === 0) && start && j === m - 1) {   // todo save sortingCol and reorder into options and db
                                row[j1] *= options.period / (Math.min(END * 1000, Date.now()) - start * 1000) * 1000;
                            }
                            // show time in the most suitable unit of measure
                            row[j1] = +(row[j1] / loggedInTimeDivider).toFixed(2);
                        }

                        // on first row only, check column types
                        if (j === 0) {
                            if (isTime) {
                                hasDurationCols = true;
                                colAxisIndex.push(1);
                            }
                            else {
                                hasIntegerCols = true;
                                colAxisIndex.push(0);
                            }
                        }
                    }

                    // then reflect column types in chart options
                    if (j === 0) {
                        if (hasIntegerCols && hasDurationCols) {   // then display two axes, right is timeOfDay
                            for (i = 0; i < n; i++) {
                                series[i].targetAxisIndex = colAxisIndex[i];
                            }
                            chartOptions[type].vAxes = {
                                0: {},
                                1: {}
                            };
                            chartArea.right = '11%';
                        }
                        else {
                            delete chartOptions[type].vAxes;
                            chartArea.right = '1.4%';
                        }
                    }

                    data.push(row);
                }


                var googleFormat = dateFormat;
                if (options.period < DAY) {
                    googleFormat += ' ' + (CONFIG.timeformat === '12' ? 'hh:mmaa' : 'HH:mm');
                }

                // google charts display time on x axis better than I do, because they know font and the scale
                if (SAME_TZ && options.period > 0) {
                    chartOptions[type].hAxis = {
                        format: googleFormat,
                        viewWindow: {
                            min: new Date(START * 1000),
                            max: new Date(Math.min(Date.now(), END * 1000))
                        }
                    };
                }
                else {
                    delete chartOptions[type].hAxis;
                }

                if (data.length === 1) {
                    var arr = [];
                    for (i = 0; i < tableHeader.length; i++) {
                        arr.push(0);
                    }
                    data.push(arr);
                }

                return google.visualization.arrayToDataTable(data);
            }


            function setZoomBackup() {
                if (!that.savedZoom) {
                    that.savedZoom = {
                        start: START,
                        end: END,
                        startday: options.startday,
                        endday: options.endday,
                        period: options.period
                    };
                    resetZoomBtn.style.display = 'block';
                }
            }


            function changeChartRange(startday, endday) {
                FORM.showNewTime(startday, endday);
                createReport();
            }


            function move(direction) {
                var now = Date.now() / 1000,
                    leftTime = START,
                    rightTime = Math.min(now, END),
                    delta = (rightTime - leftTime) * 0.1 * direction;
                if (direction < 0 || rightTime !== now) {
                    setZoomBackup();

                    START += delta;
                    END = rightTime + delta;

                    changeChartRange();
                }
            }


            var bodyClientWidth;

            function mousedown(evt) {
                var svgr = charts[options.type] && charts[options.type].svgr;
                goodEvt = svgr && (svgr === evt.target || UTILS.contains(svgr, evt.target));

                if (goodEvt) {
                    bodyClientWidth = document.body.clientWidth;
                    rectSVG = svgr.getBoundingClientRect();
                    startX = evt.pageX;
                    zoomingOverlay.style.top = rectSVG.top + 'px';
                    zoomingOverlay.style.bottom = document.body.clientHeight - rectSVG.bottom + 'px';
                    zoomingOverlay.style.left = startX - window.pageXOffset + 'px';
                    zoomingOverlay.style.right = bodyClientWidth + window.pageXOffset - startX + 'px';
                    zoomingOverlay.style.display = 'block';
                    container.onmousemove = mousemove;
                }
            }


            function mousemove(evt) {
                endX = evt.pageX;
                zoomingOverlay.style.left = Math.min(startX, endX) - window.pageXOffset + 'px';
                zoomingOverlay.style.right = bodyClientWidth + window.pageXOffset - Math.max(startX, endX) + 'px';
            }


            function mouseup() {
                zoomingOverlay.style.display = 'none';
                if (goodEvt && endX !== null) {
                    var maxX = Math.max(startX, endX),
                        minX = Math.min(startX, endX);

                    if (maxX - minX < 6) {
                        return;
                    }
                    setZoomBackup();

                    var now = Date.now() / 1000,
                        leftTime = START,
                        rightTime = Math.min(now, END);

                    START += (rightTime - leftTime) * (minX - window.pageXOffset - rectSVG.left) / rectSVG.width;
                    END = rightTime - (rightTime - leftTime) * (rectSVG.right + window.pageXOffset - maxX) / rectSVG.width;
                    options.period = that.savedZoom.period * (Math.min(now, END) - START) / (Math.min(now, that.savedZoom.end) - that.savedZoom.start);

                    changeChartRange();

                    container.onmousemove = null;
                }

                endX = null;
            }


            function mousewheel(evt) {
                if (options.period && options.type !== 'table' && options.type !== 'piechart') {
                    var svgr = charts[options.type] && charts[options.type].svgr;
                    if (svgr && evt.deltaY && (svgr === evt.target || UTILS.contains(svgr, evt.target))) {
                        setZoomBackup();

                        var now = Date.now() / 1000,
                            leftTime = START,
                            rightTime = Math.min(now, END),
                            rectSVG = svgr.getBoundingClientRect(),
                            center = evt.pageX + window.pageXOffset,
                            left = center - rectSVG.left,
                            right = rectSVG.right - center,
                            zoom = -evt.deltaY / 100;

                        START += (rightTime - leftTime) * left / rectSVG.width * zoom;
                        END = rightTime - (rightTime - leftTime) * right / rectSVG.width * zoom;
                        options.period = that.savedZoom.period * (Math.min(now, END) - START) / (Math.min(now, that.savedZoom.end) - that.savedZoom.start);

                        changeChartRange();
                    }
                    evt.preventDefault();
                    evt.stopPropagation();
                    return false;
                }
            }


            function patchSVG() {
                if (type === 'piechart') {
                    currentTab.childNodes[0].className = 'piechart';
                    return;
                }

                var ua = navigator.userAgent,
                    isIE = ua.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0,
                    isFF = ua.toLowerCase().indexOf('firefox') > -1,
                    isPhantom = ua.indexOf('PhantomJS') > 0,
                    isSafari = ua.match(/Version\/[\d\.]+.*Safari/),
                    svg = currentTab.getElementsByTagName('svg')[0];

                // a tricky part of Google charts integration. Find rectangle inside which the chart is rendered
                for (var i = 3; i >= 1; i--) {
                    var activeArea = svg.childNodes[i];
                    if (activeArea) {
                        activeArea = activeArea.childNodes[0];
                    }
                    if (activeArea) {
                        break;
                    }
                }

                if (i !== 1) {
                    if (!EMBEDDED && options.period > 0) {
                        activeArea.style.cursor = 'col-resize';
                        charts[type].svgr = activeArea;
                    }

                    var legend = svg.childNodes[1],
                        svgRect = svg.getBoundingClientRect(),
                        children = legend.childNodes;

                    legend.style.transform = 'translate(-11px, -3px)';

                    for (i = 1; i < children.length; i++) {
                        var base = children[i],
                            el = base.childNodes[2],
                            color,
                            top = 0,
                            left = 0;

                        if (!el || el.tagName === 'circle') {
                            base.addEventListener('click', function () {
                                setTimeout(function () {
                                    setTimeout(patchSVG, 8);
                                    pauseRedraw = true;
                                    setTimeout(function () {
                                        pauseRedraw = false;
                                    }, 20000);
                                }, 8);
                            });
                            // setTimeout(patchSVG);
                            // return;
                            continue;
                        }

                        if (type === 'linechart') {
                            color = el.getAttribute('stroke');
                        }
                        else {
                            color = el.getAttribute('fill');
                        }

                        if (!color || color.charAt(0) !== '#') {
                            // setTimeout(patchSVG);
                            // return;
                            continue;
                        }

                        if (isFF) {
                            left = EMBEDDED ? 1 : 0;
                        }
                        else if (isIE) {
                            left = EMBEDDED ? 2 : 1;
                        }
                        else if (!isPhantom) {
                            left = 13;
                        }

                        if (isSafari) {
                            top = EMBEDDED ? 1.5 : 0.5;
                        }
                        if (isFF) {
                            top = EMBEDDED ? -1 : -0.5;
                        }
                        else if (isIE) {
                            top = 0;
                        }
                        else if (!isPhantom) {
                            top = EMBEDDED ? 2.2 : 3;
                        }

                        if (containerClientWidth > 310) {
                            left++;
                        }
                        if (containerClientWidth > 440) {
                            left++;
                            top -= 0.5;
                        }
                        if (containerClientWidth > 650) {
                            left++;
                            top += 0.5;
                        }
                        if (containerClientWidth > 950) {
                            left++;
                            top += 0.5;
                        }

                        var rect = el.getBoundingClientRect(),
                            cx = (rect.left + rect.right) / 2 - svgRect.left + left,
                            cy = (rect.top + rect.bottom) / 2 - svgRect.top + top;

                        base.removeChild(el);
                        var circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
                        circle.setAttribute('cx', cx);
                        circle.setAttribute('cy', cy);
                        circle.setAttribute('r', EMBEDDED ? '6' : (containerClientWidth < 870 ? '7' : '7.5'));
                        circle.setAttribute('fill', color);
                        base.appendChild(circle);
                    }

                    legend.style.visibility = 'visible';
                }
            }


            function renderChart() {
                if (!pauseRedraw) {
                    setChartArea();
                    dataTable = getDataTable();
                    charts[type].draw(dataTable, chartOptions[type]);
                }
            }


            function renderPieChart() {
                if (!pauseRedraw) {
                    setChartArea();
                    dataTable = getPieDataTable();
                    charts.piechart.draw(dataTable, chartOptions.piechart);
                }
            }


            this.render = function (_currentTab, _type, deep) {
                currentTab = _currentTab;
                type = _type;

                if (!window.google || !google.visualization) {
                    setTimeout(function () {
                        that.render(_currentTab, _type, deep);
                    }, 100);
                }
                else if (table) {
                    google.charts.setOnLoadCallback(function () {
                        if (_type === 'piechart') {
                            getPieSource();
                        }
                        var created = false;

                        if (!charts[_type]) {
                            switch (_type) {
                                case 'linechart':
                                    charts[_type] = new google.visualization.LineChart(_currentTab);
                                    break;
                                case 'barchart':
                                case 'stacked':
                                    charts[_type] = new google.visualization.ColumnChart(_currentTab);
                                    break;
                                case 'piechart':
                                    charts[_type] = new google.visualization.PieChart(_currentTab);
                                    break;
                            }
                            created = charts[_type];
                        }
                        colorizeChart(_type);

                        if (_type === 'piechart') {
                            if (!EMBEDDED) {
                                renderPieSourceSelect();
                            }
                            renderPieChart();
                        }
                        else {
                            renderChart();
                        }

                        if (!EMBEDDED) {
                            equalHeight();
                        }

                        if (created) {
                            google.visualization.events.addListener(created, 'ready', patchSVG);

                            google.visualization.events.addListener(created, 'select', function () {
                                var selection = created.getSelection();
                                selection = selection[0];

                                if (selection) {
                                    if (_type === 'piechart') {
                                        if (pieSource.by === 'column') {
                                            var i = hiddenInPie[selection.row], j = +colZZZ[pieSource.id] + 1;
                                        }
                                        else {
                                            var j = hiddenInPie[selection.row], i = pieSource.id;
                                        }
                                    }
                                    else {
                                        var i = selection.row, j = selection.column;
                                    }

                                    openCallDetails(i, j);
                                }
                            });
                        }
                    });
                }
            };


            function setChartArea() {
                chartArea.top = (EMBEDDED ? (containerClientWidth > 840 ? '18%' : '22.5%') : '11.5%');
            }


            this.resize = function () {
                var type = options.type;
                if (charts[type]) {
                    setChartArea();
                    charts[type].draw(dataTable, chartOptions[type]);
                }
            };


            this.downloadPNG = function () {
                function b64toBlob(b64Data, contentType, sliceSize) {
                    sliceSize |= 512;

                    var byteCharacters = atob(b64Data);
                    var byteArrays = [];

                    for (var offset = 0, len = byteCharacters.length; offset < len; offset += sliceSize) {
                        var slice = byteCharacters.slice(offset, offset + sliceSize),
                            sliceLen = slice.length;

                        var byteNumbers = new Array(sliceLen);
                        for (var i = 0; i < sliceLen; i++) {
                            byteNumbers[i] = slice.charCodeAt(i);
                        }

                        var byteArray = new Uint8Array(byteNumbers);

                        byteArrays.push(byteArray);
                    }

                    return new Blob(byteArrays, {type: contentType});
                }


                var fileName = (options.name.replace(/[^\w\s]/g, '_') || 'noname') + '.png',
                    b64data = charts[options.type].getImageURI();

                if (navigator.msSaveBlob) { // IE 10+
                    navigator.msSaveBlob(b64toBlob(b64data.substr(22), 'image/png'), fileName);
                }
                else {
                    UTILS.downloadUrl(b64data, fileName, b64data);
                }
            };


            this.resetZoom = function () {
                var orig = this.savedZoom;
                if (orig) {
                    START = orig.start;
                    END = orig.end;
                    options.period = orig.period;
                    this.savedZoom = null;
                    resetZoomBtn.style.display = '';
                    changeChartRange(orig.startday, orig.endday);
                }
            };


            if (!EMBEDDED) {
                container.addEventListener('mousedown', mousedown, true);
                window.addEventListener('mouseup', mouseup, true);
                container.addEventListener('wheel', mousewheel);
                byId('left-overlay').addEventListener('click', function () {
                    move(-1);
                });
                byId('right-overlay').addEventListener('click', function () {
                    move(1);
                });
            }
        }


        var callIds = {},
            calls = [],
            queues = {},
            agents = {},
            phones = {},
            minRecordedTime = Infinity,
            maxRecordedTime = 0;


        function addRecordsToDatabase(update) {
            var newCalls = update.cdrs_values;
            var newQueues = update.queues;
            var newAgents = update.agents;
            var newPhones = update.phones;
            var decodeMap = update.cdrs_columns;
            var ulen = decodeMap.length;

            var dbChanged = false;
            var queuesChanged = false;
            var agentPhoneChanged = false;
            var addToBeginning = SERVER.addToBeginning;
            if (addToBeginning) {
                var beginning = [];
            }

            for (var i = 0, n = newCalls.length; i < n; i++) {
                var encodedCall = newCalls[i];
                var call = {};
// todo decode as a literal or do not decode at all, use constants for access instead
                for (j = 0; j < ulen; j++) {
                    call[decodeMap[j]] = encodedCall[j];
                }

                var oldCall = callIds[call.id];
                if (oldCall) {
                    calls.splice(calls.indexOf(oldCall), 1, call);
                }
                else {
                    if (addToBeginning) {
                        beginning.push(call);
                    }
                    else {
                        calls.push(call);
                    }
                }
                callIds[call.id] = call;

                dbChanged = true;
            }

            if (addToBeginning) {
                calls = beginning.concat(calls);
            }


            for (i = 0, n = newQueues.length; i < n; i++) {
                // todo: now I simply overwrite queues. Todo detect queue changes
                var queue = newQueues[i];
                if (!queues[queue.id]) {
                    if (options.queues !== 'none') {
                        dbChanged = true;
                    }
                    queuesChanged = true;
                }
                queues[queue.id] = queue;
                queue.marked = true;

                // todo detect change of available agents
                var queueAgents = queue.agents;
                queue.agents = [];
                queue.availableAgents = [];

                for (var j = 0, m = queueAgents.length; j < m; j++) {
                    var ag = queueAgents[j];
                    queue.agents.push(ag.id);
                    if (ag.available === '1') {
                        queue.availableAgents.push(ag.id);
                    }
                }
            }


            for (i in queues) {
                if (!queues[i].marked) {
                    delete queues[i];
                    if (options.queues !== 'none') {
                        dbChanged = true;
                    }
                    queuesChanged = true;
                }
                else {
                    queues[i].marked = false;
                }
            }


            for (i = 0, n = newAgents.length; i < n; i++) {
                // todo: now I simply overwrite queues. Todo detect queue changes
                var agent = newAgents[i],
                    oldAgent = agents[agent.id],
                    oldAgentEvents = null;

                if (!oldAgent) {
                    if (options.agents !== 'none') {
                        dbChanged = true;
                    }
                    agentPhoneChanged = true;
                }
                else {
                    oldAgentEvents = oldAgent.E;
                }

                agent.E = oldAgentEvents || new QAgentEvents();
                agents[agent.id] = agent;
                agent.marked = true;

                agent.E.add(agent.events);
                if (!dbChanged && visibleCols[COL_loggedIn] && agent.E.events.length && !(options.period === 0 && options.agents === 'none')) {
                    dbChanged = true;
                }
            }

            for (i in agents) {
                if (!agents[i].marked) {
                    delete agents[i];
                    if (options.agents !== 'none') {
                        dbChanged = true;
                    }
                    agentPhoneChanged = true;
                }
                else {
                    agents[i].marked = false;
                }
            }


            for (i = 0, n = newPhones.length; i < n; i++) {
                // todo: now I simply overwrite queues. Todo detect queue changes
                var phone = newPhones[i];
                if (!phones[phone.name]) {
                    if (options.phones !== 'none') {
                        dbChanged = true;
                    }
                    agentPhoneChanged = true;
                }
                phones[phone.name] = phone;
                phone.marked = true;
            }

            for (i in phones) {
                if (!phones[i].marked) {
                    delete phones[i];
                    if (options.phones !== 'none') {
                        dbChanged = true;
                    }
                    agentPhoneChanged = true;
                }
                else {
                    phones[i].marked = false;
                }
            }

            if (!EMBEDDED) {
                if (queuesChanged) {
                    queuesDisplay();
                }
                if (agentPhoneChanged) {
                    phoneAgentDisplay();
                }
            }

            // TODO: update view only if visually displayed info has changed
            return dbChanged;
        }


        function getCallsFromTimePeriod(start, end) {       // todo search index from
            var startIndex,
                endIndex,
                callEnd;

            for (var i = 0, n = calls.length; i < n; i++) {
                callEnd = +calls[i].end;            //TODO do binary search, stupid!!!!!!
                if (startIndex === undefined && callEnd >= start) {
                    startIndex = i;
                }
                if (callEnd < end) {
                    endIndex = i;
                }
                else {
                    break;
                }
            }

            if (startIndex !== undefined && endIndex !== undefined) {
                return calls.slice(startIndex, endIndex + 1);
            }
            else {
                return [];
            }
        }


        function getVisibleColumnsAndRows() {
            for (var i = 1, n = columnNames.length; i < n; i++) {
                visibleCols[i] = +options[columnNames[i]];
            }
            for (i in destinationNames) {
                visibleRows[i] = +options[destinationNames[i]];
            }
            getColumnPositions();
            getRowPositions();
        }


        function setVisibleColumn(pos, value) {
            visibleCols[pos] = value;
            getColumnPositions();
            createReport(true);
        }


        function setVisibleRow(pos, value) {
            visibleRows[pos] = value;
            getRowPositions();
            createReport();
        }


        function getColumnPositions() {
            colPos = [0];
            timeColVisible = false;
            for (var i = 1, n = COLUMNS.length; i < n; i++) {
                var j = reorder[i];
                if (visibleCols[j]) {
                    if (i >= COL_timeStart && i < COL_timeEnd) {
                        timeColVisible = true;
                    }
                    colPos.push(j);
                }
            }
            colPos1 = colPos[1];
            colPosLength = colPos.length;

            colZZZ = new Array(COL_loggedIn + 1);
            for (i = 1, n = COLUMNS.length; i < n; i++) {
                colZZZ[i] = colPos.indexOf(i);
            }
            loggedInPos = colZZZ[COL_loggedIn];
        }


        function getRowPositions() {
            rowPos = [];
            var rowIndex = 0;
            for (var i = 0, n = visibleRows.length; i < n; i++) {
                if (visibleRows[i]) {
                    rowPos[i] = rowIndex++;
                }
            }
        }


        var memorizedIncludeIds = {};

        function getInclude(destination) {

            function getFromMultiSelect(elementId) {
                if (memorizedIncludeIds[elementId]) {
                    return memorizedIncludeIds[elementId];
                }
                else {
                    var options = byId(elementId).options,
                        ids = [];
                    for (var i = 0, n = options.length; i < n; i++) {
                        ids.push(options[i].value);
                    }
                    memorizedIncludeIds[elementId] = ids;
                    return ids;
                }
            }


            if (EMBEDDED) {
                if (destination === 'queues' && options.queuesSelect) {
                    return getFromMultiSelect(options.queuesSelect);
                }
                else {
                    var include = options.include,
                        ids = [];
                    for (var i in include) {
                        var inc = include[i];
                        if (inc.feature === destination) {
                            if (destination === 'agents') {
                                ids.push(inc.dtype + '_' + inc.dnumber);
                            }
                            else {
                                ids.push(inc.dnumber);
                            }
                        }
                    }
                }
            }
            else {
                return getFromMultiSelect(destination + 'include_selected');
            }
        }


        function getTableWithPercentage(csv) {
            var result = new Array(table.length),
                inserts = 0;

            for (var i = 0, n = table.length; i < n; i++) {
                result[i] = table[i].slice();
                if (!csv) {
                    result[i][0] = UTILS.escapeHtml(result[i][0]);
                }
            }

            for (var j = 1; j < colPosLength; j++) {
                var i1 = colPos[j],
                    j0 = j,
                    j1 = j0 + inserts,
                    withPercentage = visibleCols[i1] === 2,
                    time = i1 >= COL_timeStart && i1 < COL_timeEnd,
                    loggedInCol = i1 === COL_loggedIn;

                if (withPercentage || time || loggedInCol) {
                    for (i = 0; i < n; i++) {
                        var row = result[i],
                            perc;

                        if (time) {
                            row[j1] = UTILS.timeFormat(row[j1], 3);
                        }
                        else if (loggedInCol) {
                            row[j1] = (options.period || table[i].hasLIT) ? UTILS.timeFormat(row[j1], 4) : '';
                        }

                        if (withPercentage) {
                            var tblRow = table[i];
                            if (loggedInCol) {
                                if (tblRow[j0] || tblRow.hasLIT) {
                                    perc = tblRow.totalTime ? Math.round(100 * tblRow[j0] / tblRow.totalTime) : 0;
                                }
                                else {
                                    perc = '';
                                }
                            }
                            else {
                                var divide = tblRow.total;
                                perc = divide ? Math.round(100 * tblRow[j0] / divide) : '';
                            }

                            if (csv) {
                                row.splice(j1, 0, perc);
                            }
                            else {
                                if (perc !== '') {
                                    perc += ' %';
                                }
                                row[j1] += ' <small>(' + perc + ')</small>';
                            }
                        }
                    }
                }

                if (withPercentage && csv) {
                    inserts++;
                }
            }

            return result;
        }


        function sortTable() {
            function byCol(col, order) {
                return function (a, b) {
                    if (a[col] > b[col]) {
                        return order;
                    }
                    else if (a[col] < b[col]) {
                        return -order;
                    }
                    else {
                        return 0;
                    }
                }
            }


            if (options.totalrow) {
                var totalRow = table.pop();
            }
            if (TABLE) {
                if (sortingCol > 0) {
                    table.sort(byCol(colZZZ[sortingCol], sortingOrder));
                }
                else if (sortingOrder === -1) {
                    table.reverse();
                }
            }
            if (options.totalrow) {
                table.push(totalRow);
            }
        }


        this.downloadCSV = function (callsInfoTable, fileName, headlineRow) {
            var data = callsInfoTable || (table && getTableWithPercentage(true));
            if (!data) {
                return;
            }

            var str, row;

            if (headlineRow) {
                str = headlineRow;
            }
            else {
                str = '';
                row = [options.period ? 'Time' : 'Destination'];

                for (var i = 1; i < colPosLength; i++) {
                    var newI = colPos[i];
                    row.push(COLUMNS[newI]);
                    if (visibleCols[newI] === 2) {
                        row.push(COLUMNS[newI] + ' %');
                    }
                }
                str += row.join(',') + '\n';
            }

            for (i = 0, n = data.length; i < n; i++) {
                row = data[i];
                for (var j = 0, m = row.length; j < m; j++) {
                    var cell = row[j].toString().replace(/"/g, '""');
                    if (cell.search(/("|,|\n)/g) >= 0) {
                        cell = '"' + cell + '"';
                    }
                    str += j > 0 ? (',' + cell) : cell;
                }
                if (i !== n - 1) {
                    str += '\n';
                }
            }

            if (postId) {
                UTILS.post('/local/qstatistics/csv/', UTILS.serialize({
                    postid: postId,
                    csv: str
                }));
            }
            else {
                fileName = fileName || (options.name.replace(/[^\w\s]/g, '_') || 'noname') + '.csv';
                var csvBlob = new Blob([str], {type: 'text/csv;charset=utf-8;'});

                if (navigator.msSaveBlob) { // IE 10+
                    navigator.msSaveBlob(csvBlob, fileName);
                }
                else {
                    UTILS.downloadUrl(URL.createObjectURL(csvBlob), fileName, str);
                }
            }
        };


        function queuesDisplay() {
            var selected = byId('queuesinclude_selected'),
                unselected = byId('queuesinclude_unselected'),
                strUnselected = '',
                strSelected = '';

            for (var i in queues) {
                var ids = [],
                    name = queues[i].name,
                    str;

                for (var sel = selected.length - 1; sel >= 0; sel--) {
                    ids.push(selected[sel].value);
                }

                str = '<option value="' + i + '">' + UTILS.escapeHtml(name) + '</option>';
                if (ids.indexOf(i) !== -1) {
                    strSelected += str;
                }
                else {
                    strUnselected += str;
                }
            }

            unselected.innerHTML = strUnselected;
            selected.innerHTML = strSelected;
        }


        function phoneTitleDisplay(arrEl) {
            switch (options.phonetitle) {
                case 'name':
                    return arrEl.name;
                case 'description':
                    return arrEl.description || arrEl.name;
                case 'internal':
                    return arrEl.callerid_internal;
                case 'name_description':
                    return arrEl.name + ' ' + (arrEl.description || arrEl.name);
                case 'internal_description':
                    return arrEl.callerid_internal + ' ' + (arrEl.description || arrEl.name);
                case 'description_name':
                    return (arrEl.description || arrEl.name) + ' ' + arrEl.name;
                case 'description_internal':
                    return (arrEl.description || arrEl.name) + ' ' + arrEl.callerid_internal;
            }
        }


        function phoneAgentDisplay() {
            var destinations = [agents, phones],
                as = byId('agentsinclude_selected'),
                au = byId('agentsinclude_unselected'),
                ps = byId('phonesinclude_selected'),
                pu = byId('phonesinclude_unselected');


            for (var j = 0, m = destinations.length; j < m; j++) {
                var arr = destinations[j],
                    selected = j ? ps : as,
                    unselected = j ? pu : au,
                    strUnselected = '',
                    strSelected = '';

                for (var i in arr) {
                    var el = arr[i],
                        ids = [],
                        name,
                        str;

                    for (var sel = selected.length - 1; sel >= 0; sel--) {
                        ids.push(selected[sel].value);
                    }

                    name = phoneTitleDisplay(el);
                    str = '<option value="' + i + '">' + UTILS.escapeHtml(name) + '</option>';
                    if (ids.indexOf(i) !== -1) {
                        strSelected += str;
                    }
                    else {
                        strUnselected += str;
                    }
                }

                unselected.innerHTML = strUnselected;
                selected.innerHTML = strSelected;
            }
        }


        function newRow() {
            var row = new Array(colPosLength);
            row.info = new Array(colPosLength);

            for (var i = 1; i < colPosLength; i++) {
                row[i] = 0;
                // var pos = colPos[i];
                // if (pos !== COL_loggedIn && (pos < COL_timeStart || pos >= COL_timeEnd)) {   // TODO bottleneck here
                row.info[i] = [];
            }

            if (timeColVisible) {
                row[colZZZ[COL_timeStart]] = Infinity;
                row[colZZZ[COL_talkMin]] = Infinity;
                row[colZZZ[COL_totalMin]] = Infinity;
            }

            row.total = 0;
            row.answered = 0;
            row.hasLIT = false;
            if (timeColVisible) {
                row.calls = [];
            }

            return row;
        }


        function addInfo(row, call, i) {
            var pos = colZZZ[i];
            if (pos !== -1) {
                row[pos]++;
                row.info[pos].push(call);
            }
        }


        // cases:
        // 1) if report type is Destination and it's about "static rows": adds things to particular row in the table, if it's visible
        // 2) otherwise the row is passed as an argument and incremented multiple times, and that row is called "multiRow"

        function addToTableOrMultiRow(rowIndex, row, multiRow) {
            if (visibleRows[rowIndex]) {
                multiRow = multiRow || table[rowPos[rowIndex]];

                var ri = row.info,
                    mri = multiRow.info;

                multiRow.total += row.total;

                for (var i = 1; i < colPosLength; i++) {
                    multiRow[i] += row[i];
                    var pos = colPos[i];
                    if (pos !== COL_loggedIn && (pos < COL_timeStart || pos >= COL_timeEnd)) {   // TODO bottleneck here
                        Array.prototype.push.apply(mri[i], ri[i]);
                    }
                }
            }
        }

        // call                  - xml call
        // multiRow              - either appended one time or multiple times to multiRow or created as new row
        // dontAddToMultipleRows - see line above
        //
        // check for usages to understand better

        function putCallToTable(call, multiRow, dontAddToMultipleRows, cameFromPhoneFilter) {
            var stype = call.stype,
                dtype = call.dtype,
                answered = call.answered,
                external = 'external',
                local = 'local',
                isInbound,
                isInternal,
                isOutbound,
                row;

            row = dontAddToMultipleRows ? multiRow : newRow();
            row.total++;

            // total calls
            addInfo(row, call, 1);
            // sla time
            if (answered && (+call.holdtime <= options.slatime)) {
                addInfo(row, call, 2);
            }
            // answered
            if (answered) {
                addInfo(row, call, 3);
            }
            // not answered
            if (!answered) {
                addInfo(row, call, 4);
            }
            // inbound calls
            isInbound = stype === external || stype === local;
            if (isInbound) {
                addInfo(row, call, 5);
            }
            // inbound answered
            if (isInbound && answered) {
                addInfo(row, call, 6);
            }
            // inbound no answer
            if (isInbound && !answered) {
                addInfo(row, call, 7);
            }
            // internal calls
            isInternal = stype !== external && stype !== local && dtype !== external && dtype !== local;
            if (isInternal) {
                addInfo(row, call, 8);
            }
            // internal answered
            if (isInternal && answered) {
                addInfo(row, call, 9);
            }
            // internal no answer
            if (isInternal && !answered) {
                addInfo(row, call, 10);
            }
            // outbound
            isOutbound = dtype === external || dtype === local;
            if (isOutbound) {
                addInfo(row, call, 11);
            }
            // outbound answered
            if (isOutbound && answered) {
                addInfo(row, call, 12);
            }
            // outbound no answer
            if (isOutbound && !answered) {
                addInfo(row, call, 13);
            }

            if (timeColVisible) {
                calcTimeCols(row, call);
                row.calls.push(call);
            }

            // rather weird requirement not to count queuestatus for calls that came from "Telephone lines" filter
            if (!cameFromPhoneFilter) {
                calcQueueuStatusCols(row, call);
            }

            if (!dontAddToMultipleRows) {
                //total
                addToTableOrMultiRow(0, row, multiRow);
                // external callers
                if (stype === external || stype === local) {
                    addToTableOrMultiRow(1, row, multiRow);
                }
                // internal callers
                if (stype !== external && stype !== local && dtype !== external && dtype !== local) {
                    addToTableOrMultiRow(2, row, multiRow);
                }
                // external destinations
                if (dtype === external || dtype === local) {
                    addToTableOrMultiRow(3, row, multiRow);
                }
            }
        }
        

        function calcTimeCols(row, call) {
            var hold = +call.holdtime,
                talk = +call.talktime,
                total = +call.totaltime,
                showTotal = options.totalrow,// todo cache
                pos;

            pos = colZZZ[14];
            if (pos !== -1) {
                row[pos] = Math.min(row[pos], hold);
            }
            pos = colZZZ[16];
            if (pos !== -1) {
                row[pos] = Math.max(row[pos], hold);
            }
            pos = colZZZ[15];
            if (pos !== -1) {
                row[pos] += hold;
            }
            pos = colZZZ[17];
            if (pos !== -1) {
                row[pos] += hold;
            }

            if (call.answered) {
                pos = colZZZ[18];
                if (pos !== -1) {
                    row[pos] = Math.min(row[pos], talk);
                }
                pos = colZZZ[20];
                if (pos !== -1) {
                    row[pos] = Math.max(row[pos], talk);
                }
                pos = colZZZ[19];
                if (pos !== -1) {
                    row[pos] += talk;
                }
                pos = colZZZ[21];
                if (pos !== -1) {
                    row[pos] += talk;
                }
                row.answered++;
            }

            pos = colZZZ[22];
            if (pos !== -1) {
                row[pos] = Math.min(row[pos], total);
            }
            pos = colZZZ[24];
            if (pos !== -1) {
                row[pos] = Math.max(row[pos], total);
            }
            pos = colZZZ[23];
            if (pos !== -1) {
                row[pos] += total;
            }
            pos = colZZZ[25];
            if (pos !== -1) {
                row[pos] += total;
            }

            if (showTotal) {
                minHold = Math.min(minHold, hold);
                maxHold = Math.max(maxHold, hold);
                sumHold += hold;
                minTalk = Math.min(minTalk, talk);
                maxTalk = Math.max(maxTalk, talk);
                sumTalk += talk;
                minTotal = Math.min(minTotal, total);
                maxTotal = Math.max(maxTotal, total);
                sumTotal += total;
            }
        }

        
        function calcQueueuStatusCols(row, call) {
            var dtypeQueue = call.dtype === 'queue',
                stypeQueue = call.stype === 'queue';

            if (dtypeQueue || stypeQueue) {
                var q = call.queuestatus;

                if (q === 'abandon') {
                    addInfo(row, call, 26);
                } else if (q === 'exitwithtimeout') {
                    addInfo(row, call, 28);
                } else if (q === 'completeagent') {
                    addInfo(row, call, 30);
                } else if (q === 'completecaller') {
                    addInfo(row, call, 31);
                } else if (q === 'transfer') {
                    addInfo(row, call, 32);
                } else if (dtypeQueue) {
                    if (q === 'exitempty') {
                        addInfo(row, call, 27);
                    } else if (q === 'exitwithkey') {
                        addInfo(row, call, 29);
                    }
                }
            }
        }


        function reduceTable() {
            function calcTotalRow() {
                if (totalCallsCount) {
                    if (minHold === Infinity) {
                        minHold = 0;
                    }
                    if (minTalk === Infinity) {
                        minTalk = 0;
                    }
                    if (minTotal === Infinity) {
                        minTotal = 0;
                    }

                    var pos,
                        map = {
                        14: minHold,
                        15: sumHold / totalCallsCount,
                        16: maxHold,
                        17: sumHold,
                        18: minTalk,
                        19: totalAnswered ? sumTalk / totalAnswered : 0,
                        20: maxTalk,
                        21: sumTalk,
                        22: minTotal,
                        23: sumTotal / totalCallsCount,
                        24: maxTotal,
                        25: sumTotal
                    };
                    for (var i = COL_timeStart; i < COL_timeEnd; i++) {
                        if (visibleCols[i]) {
                            pos = colZZZ[i];
                            colSum[pos] = map[i];
                        }
                    }
                }

                if (visibleCols[COL_loggedIn] && options.period !== 0) {
                    colSum.info[loggedInPos] = table[0].info[loggedInPos];
                }

                colSum.total = totalCallsCount;
                colSum.totalTime = reportDuration;
                table.push(colSum);
            }


            var reportDuration = currentEndTime - START,
                totalAnswered = 0,
                totalCallsCount = 0,
                showTotal = options.totalrow,
                pos;

            if (showTotal) {
                var colSum = new Array(colPosLength),
                    colSumInfo = colSum.info = new Array(colPosLength);

                for (var j = 1; j < colPosLength; j++) {
                    colSum[j] = 0;
                    colSumInfo[j] = [];
                }

                colSum[0] = 'Total';

                if (timeColVisible) {
                    colSum.calls = [];
                }
            }

            for (var i = 0, n = table.length; i < n; i++) {
                var row = table[i];
                if (showTotal) {
                    var ri = row.info;
                    for (j = 1; j < colPosLength; j++) {
                        colSum.hasLIT |= row.hasLIT;
                        colSum[j] += row[j];
                        pos = colPos[j];
                        if (pos !== COL_loggedIn && (pos < COL_timeStart || pos >= COL_timeEnd)) { //todo if pos === 1 && timeColsVisible use calls instead
                            Array.prototype.push.apply(colSumInfo[j], ri[i]);
                        }
                    }

                    totalAnswered += row.answered;
                    totalCallsCount += row.total;
                    if (timeColVisible) {
                        Array.prototype.push.apply(colSum.calls, row.calls);
                    }
                }

                if (timeColVisible) {
                    pos = colZZZ[COL_timeStart];
                    if (pos !== -1 && row[pos] === Infinity) {
                        row[pos] = 0;
                    }
                    pos = colZZZ[COL_talkMin];
                    if (pos !== -1 && row[pos] === Infinity) {
                        row[pos] = 0;
                    }
                    pos = colZZZ[COL_totalMin];
                    if (pos !== -1 && row[pos] === Infinity) {
                        row[pos] = 0;
                    }

                    if (row.total) {
                        pos = colZZZ[COL_timeStart + 1];
                        if (pos !== -1) {
                            row[pos] /= row.total;
                        }
                        pos = colZZZ[COL_totalMin + 1];
                        if (pos !== -1) {
                            row[pos] /= row.total;
                        }
                    }

                    if (row.answered) {
                        pos = colZZZ[COL_talkMin + 1];
                        if (pos !== -1) {
                            row[pos] /= row.answered;
                        }
                    }
                }

                if (!options.period) {
                    row.totalTime = reportDuration;
                }
            }

            if (showTotal) {
                calcTotalRow();
            }
        }


        function byDestType(filteredCalls) {
            var destinations = [
                'All calls',
                'External callers',
                'Internal call legs',
                'External destinations'
            ];

            for (var i = 0, n = destinations.length; i < n; i++) {
                if (visibleRows[i]) {
                    var row = newRow();
                    row[0] = destinations[i];
                    table.push(row);
                }
            }
            if (table.length) {
                for (i = 0, n = filteredCalls.length; i < n; i++) {
                    putCallToTable(filteredCalls[i]);
                }
            }
        }


        function byTimePeriods() {
            var startTime = START,
                endTime = START,
                calls,
                row,
                formatStr = CONFIG.dateformat;

            if (options.period < DAY) {
                formatStr += ' ' + (CONFIG.timeformat === '12' ? 'hh:mma' : 'HH:mm');
            }

            if ((currentEndTime - START) / options.period > containerClientWidth - 70) {
                alert('Too many rows to display. Please set bigger interval.');
                options.period = 0;
                if (!EMBEDDED) {
                    byId('period').value = 0;
                }
                SERVER.hidePreloader();
                throw 'too many rows to display';
            }

            while (startTime < currentEndTime) {
                row = newRow();

                var start = moment.unix(startTime);
                row[0] = start.format(formatStr);

                if (options.period < DAY) {
                    endTime += options.period;
                }
                else {
                    endTime = start.add(options.period / DAY, 'days').unix();
                }
                endTime = Math.min(endTime, currentEndTime);
                row.intervals = [[startTime, endTime]];

                calls = getCallsFromTimePeriod(startTime, endTime);

                for (var i = 0, n = calls.length; i < n; i++) {
                    putCallToTable(calls[i], row);
                }
                byQueueAgentPhone(calls, row, startTime, endTime);
                row.totalTime = endTime - startTime;
                table.push(row);

                startTime = endTime;
            }
        }


        function byHours(period) {
            var startTime = START,
                endTime = START - START % period,       // normalized
                calls,
                row,
                reportIndex,
                date = moment.unix(startTime),
                totalHours = DAY / period,
                isHalfHours = period === 1800,
                startHour = date.hour();

            if (isHalfHours) {
                startHour = startHour * 2 + Math.floor(date.minute() / 30);
            }

            for (var i = 0; i < totalHours; i++) {
                var hourString,
                    ampm = '';
                row = newRow();
                row.totalTime = 0;
                row.intervals = [];

                reportIndex = startHour + i;
                if (reportIndex >= totalHours) {
                    reportIndex -= totalHours;
                }
                if (isHalfHours) {
                    reportIndex = Math.floor(reportIndex / 2);
                }
                if (CONFIG.timeformat === '12') {
                    ampm = reportIndex >= 12 ? 'pm' : 'am';
                    reportIndex %= 12;
                }
                hourString = UTILS.pad(reportIndex) + ':';
                if (isHalfHours) {
                    hourString += ((i + startHour) % 2) ? '30' : '00';
                }
                else {
                    hourString += '00';
                }

                row[0] = hourString + ampm;
                table[i] = row;
            }

            while (startTime < currentEndTime) {
                endTime += period;
                endTime = Math.min(endTime, currentEndTime);

                date = moment.unix(startTime);
                reportIndex = date.hour();
                if (isHalfHours) {
                    reportIndex = reportIndex * 2 + Math.floor(date.minute() / 30);
                }
                reportIndex -= startHour;
                if (reportIndex < 0) {
                    reportIndex = totalHours + reportIndex;
                }

                row = table[reportIndex];
                calls = getCallsFromTimePeriod(startTime, endTime);
                row.intervals.push([startTime, endTime]);

                for (i = 0, n = calls.length; i < n; i++) {
                    putCallToTable(calls[i], row);
                }
                byQueueAgentPhone(calls, row, startTime, endTime);
                row.totalTime += endTime - startTime;

                startTime = endTime;
            }
        }


        function byDaysOfWeek() {
            var start = moment.unix(START),
                startTime = START,
                end = start,
                endTime = START,
                finish = moment.min(moment(), moment.unix(END)),
                finishTime = finish.unix(),
                calls,
                row,
                reportIndex,
                dayOfWeek,
                startDayOfWeek = start.day(),
                daysOfWeek = [
                    'Sunday',
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday'
                ];

            for (var i = 0; i < 7; i++) {
                row = newRow();
                row.totalTime = 0;
                row.intervals = [];

                reportIndex = i + startDayOfWeek;  // start from startDayOfWeek
                if (reportIndex >= 7) {
                    reportIndex -= 7;
                }
                row[0] = daysOfWeek[reportIndex];
                table[i] = row;
            }

            while (startTime < finishTime) {
                end.add(1, 'days');
                end = moment.min(end, finish);
                endTime = end.unix();

                dayOfWeek = start.day();
                reportIndex = dayOfWeek - startDayOfWeek;  // start from startDayOfWeek
                if (reportIndex < 0) {
                    reportIndex += 7;
                }

                row = table[reportIndex];
                calls = getCallsFromTimePeriod(startTime, endTime);
                row.intervals.push([startTime, endTime]);

                for (i = 0, n = calls.length; i < n; i++) {
                    putCallToTable(calls[i], row);
                }
                byQueueAgentPhone(calls, row, startTime, endTime);
                row.totalTime += endTime - startTime;

                start = end;
                startTime = endTime;
            }
        }


        function byQueueAgentPhone(filteredCalls, multiRow, periodStart, periodEnd) {
            var destinations = ['queues', 'agents', 'phones'];

            for (var d in destinations) {
                var dest = destinations[d],
                    visibleQueues,
                    visibleQueuesLength,
                    ids,
                    arr,
                    destFilter = options[dest];

                switch (dest) {
                    case 'queues':
                        arr = queues;
                        break;
                    case 'agents':
                        arr = agents;
                        break;
                    case 'phones':
                        arr = phones;
                        break;
                }

                switch (destFilter) {
                    case 'use_include':
                        ids = getInclude(dest);
                        break;
                    case 'queues':
                        ids = [];
                        for (var o = 0; o < visibleQueuesLength; o++) {
                            Array.prototype.push.apply(ids, queues[visibleQueues[o]].agents);
                        }
                        UTILS.unique(ids);
                        ids.sort();
                        break;
                    case 'queues_available':
                        ids = [];
                        for (o = 0; o < visibleQueuesLength; o++) {
                            Array.prototype.push.apply(ids, queues[visibleQueues[o]].availableAgents);
                        }
                        UTILS.unique(ids);
                        ids.sort();
                        break;
                    case 'all':
                        ids = Object.keys(arr);
                        break;
                    case 'none':
                        ids = [];
                        break;
                    default:
                        ids = [];
                        for (i in arr) {
                            if (arr[i].panel === '1') {
                                ids.push(i);
                            }
                        }
                }

                if (dest === 'queues') {
                    visibleQueues = ids;
                    visibleQueuesLength = visibleQueues.length;
                }

                for (var j = 0, m = ids.length; j < m; j++) {
                    var call,
                        id = ids[j],
                        el = arr[id],
                        name,
                        match,
                        row = multiRow || newRow();

                    if (el) {
                        if (!multiRow) {
                            if (dest === 'queues') {
                                row[0] = 'Queue: ' + el.name;
                            }
                            else {
                                name = phoneTitleDisplay(el);
                                if (dest === 'agents') {
                                    row[0] = 'Queue agent: ' + name;
                                }
                                else {
                                    row[0] = 'Ext: ' + name;
                                }
                            }
                        }

                        for (var i = 0, n = filteredCalls.length; i < n; i++) {//
                            call = filteredCalls[i];

                            switch (dest) {
                                case 'queues':
                                    match = call.dtype === 'queue' && call.dnumber === id;
                                    break;

                                case 'agents':
                                    match = call.stype === 'queue' && call.dnumber === el.dnumber && call.dtype === el.dtype && visibleQueues.indexOf(call.snumber) !== -1;
                                    break;

                                case 'phones':
                                    match = (call.stype === 'phone' && call.snumber === id) || (call.dtype === 'phone' && call.dnumber === id);
                                    break;
                            }

                            if (match) {
                                putCallToTable(call, row, true, dest === 'phones');
                            }
                        }

                        if (dest === 'agents' && visibleCols[COL_loggedIn]) {
                            row[loggedInPos] += el.E.calcLoggedTime(periodStart || START, periodEnd || END);
                            maxLoggedIn = Math.max(maxLoggedIn, row[loggedInPos]);
                        }

                        if (!multiRow) {
                            row.hasLIT = dest === 'agents';
                            table.push(row);
                        }
                    }
                }
            }
        }


        function htmlConstructor() {
            var openButton = byId('panel-open-button'),
                optionsHeading = byId('options-heading'),
                mainContent = byId('main-content'),
                rightPanel = byId('right-panel'),
                rightMenuHeight = 280 + 38,
                leftMenuHeight = byId('nav_bar').clientHeight,
                isExpanded = false;


            equalHeight = function () {
                var currentTabHeight = TABS.tabs[options.type];
                currentTabHeight = currentTabHeight ? currentTabHeight.offsetHeight : 0;
                mainContent.style.height = Math.max(currentTabHeight, rightMenuHeight, isExpanded ? (rightPanel.clientHeight + 9) : leftMenuHeight) + 'px';
            };


            function toggle() {
                isExpanded = !isExpanded;
                if (isExpanded) {
                    rightPanel.classList.add('expanded');
                    openButton.classList.add('expanded');
                }
                else {
                    rightPanel.classList.remove('expanded');
                    openButton.classList.remove('expanded');
                }
                equalHeight();
            }

            openButton.addEventListener('click', toggle);
            optionsHeading.addEventListener('click', toggle);

            openButton.innerHTML = '';      // bad initial html

            isExpanded = true;
            rightPanel.classList.add('expanded');  // todo initial html
            openButton.classList.add('expanded');


            toggleLROverlay = function (nextType) {
                var showMoveLeftRight = (options.period <= 0 || nextType === 'table' || nextType === 'piechart') ? 'none' : '';
                byId('left-overlay').style.display = showMoveLeftRight;
                byId('right-overlay').style.display = showMoveLeftRight;
            };


            menuButtons = document.getElementById('right-menu').children;
            containerClientWidth = container.clientWidth;
        }


        // resize event listener with throttle
        var handler;
        window.addEventListener('resize', function () {
            clearTimeout(handler);

            handler = setTimeout(function () {
                containerClientWidth = container.clientWidth;

                if (options.type === 'table') {
                    TABLE.resizeHeader();
                }
                else {
                    CHART.resize();
                }
                if (!EMBEDDED) {
                    equalHeight();
                }
            }, 100);
        });


        function createReport(doResize) {
            minHold = Infinity;
            minTalk = Infinity;
            minTotal = Infinity;
            maxHold = 0;
            maxTalk = 0;
            maxTotal = 0;
            sumHold = 0;
            sumTalk = 0;
            sumTotal = 0;
            maxLoggedIn = 0;

            table = [];
            currentEndTime = Math.min(Date.now() / 1000, END);

            if (options.period === 0) {
                var filteredCalls = getCallsFromTimePeriod(START, END);
                byDestType(filteredCalls);
                byQueueAgentPhone(filteredCalls);
            }
            else if (options.period > 0) {
                byTimePeriods()
            }
            else {
                if (options.period > -7 * DAY) {
                    byHours(-options.period);
                }
                else {
                    byDaysOfWeek()
                }
            }

            reduceTable();
            sortTable();

            if (postId) {
                report.downloadCSV();     // download CSV AND do something else
            }

            if (options.type === 'csv') {
                report.downloadCSV();
            }
            else if (EMBEDDED) {
                if (options.type === 'table') {
                    container.style.overflow = 'auto';
                    TABLE.render(container, doResize);
                }
                else {
                    CHART.render(container, options.type);
                }
            }
            else {
                TABS.update();
            }
        }


        function toggleButtons() {
            if (menuButtons) {
                for (var i = 0, n = menuButtons.length; i < n; i++) {
                    if (i === n - 1) {
                        var disabled = options.type === 'table';  // don't show PNG if type === 'table'
                    }
                    else {
                        disabled = false;
                    }
                    menuButtons[i].disabled = disabled;
                }
                menuButtons = null;
            }
        }


        function Form(formEl) {
            var that = this,
                savedScrollX,
                savedScrollY,

                submitBtn = formEl.querySelectorAll('input[type="submit"]'),
                titleElement = document.getElementsByTagName('title')[0],
                originalTitle = formEl.name.value,
                loadButton = submitBtn[0],
                saveButton = submitBtn[1],
                copyButton = submitBtn[2],
                copyButtonClicked,
                dirty,
                typeChanged;


            this.preventScroll = function () {
                window.scrollTo(savedScrollX, savedScrollY);
            };


            this.showNewTime = function (startDay, endDay) {
                if (startDay === undefined) {
                    startDay = '1';
                }
                if (endDay === undefined) {
                    endDay = '1';
                }

                var start = moment.unix(START),
                    end = moment.unix(END),
                    y1, m1, d1, y2, m2, d2;

                options.startday = startDay;
                options.endday = endDay;
                if (!EMBEDDED) {
                    byId('startdate').style.display = startDay === '1' ? '' : 'none';
                    byId('enddate').style.display = endDay === '1' ? '' : 'none';
                }
                options.start_year = y1 = start.year();
                options.end_year = y2 = end.year();
                options.start_month = m1 = start.month() + 1;
                options.end_month = m2 = end.month() + 1;
                options.start_day = d1 = start.date();
                options.end_day = d2 = end.date();
                options.start_hour = start.hours();
                options.end_hour = end.hours();
                options.start_minute = start.minutes();
                options.end_minute = end.minutes();
                options.start_second = start.seconds();
                options.end_second = end.seconds();
                options.start_buffer = y1 + '-' + m1 + '-' + d1;
                options.end_buffer = y2 + '-' + m2 + '-' + d2;
                UTILS.jsonToForm(options, formEl);
            };


            function setWatchers() {
                var timeControls = [
                        'startday',
                        'start_year',
                        'start_month',
                        'start_day',
                        'start_hour',
                        'start_minute',
                        'start_second',
                        'endday',
                        'end_year',
                        'end_month',
                        'end_day',
                        'end_hour',
                        'end_minute',
                        'end_second'
                    ],
                    filters = [
                        'phonetitle',
                        'slatime',
                        'totalrow',
                        'queues',
                        'agents',
                        'phones'
                    ],
                    i;

                for (i = 0, n = formEl.length; i < n; i++) {
                    // react on buttons below, not selects
                    if (formEl[i].getAttribute('multiple') === null) {
                        formEl[i].addEventListener('change', function () {
                            options[this.name] = this.value;
                            onFormDirty();
                        });
                    }
                }

                byId('name').addEventListener('keyup', function () {
                    if (this.value !== originalTitle) {
                        onFormDirty();
                    }
                });

                byId('period').addEventListener('change', function () {
                    options.period = +this.value;
                    byId('heading_rows').innerHTML = options.period ? 'Sum of destinations:' : 'Display destinations:';
                    if (!loadButton) {
                        toggleLROverlay(options.type);
                        createReport();
                    }
                    that.preventScroll();
                });

                byId('totalrow').addEventListener('change', function () {
                    options.totalrow = +this.value;
                });

                byId('phonetitle').addEventListener('change', function () {
                    if (!loadButton) {
                        phoneAgentDisplay();
                    }
                });

                for (i in timeControls) {
                    byId(timeControls[i]).addEventListener('change', function () {
                        that.preventScroll();
                        if (!loadButton) {
                            SERVER.updateRange();
                        }
                    });
                }
                for (i = 1, n = columnNames.length; i < n; i++) {
                    byId(columnNames[i]).addEventListener('change', function () {
                        var pos = columnNames.indexOf(this.id);
                        if (!loadButton) {
                            setVisibleColumn(pos, +this.value);
                        }
                        that.preventScroll();
                    });
                }
                for (i in destinationNames) {
                    byId(destinationNames[i]).addEventListener('change', function () {
                        var pos = destinationNames.indexOf(this.id);
                        if (!loadButton) {
                            setVisibleRow(pos, +this.value);
                        }
                        that.preventScroll();
                    });
                }
                for (i in filters) {
                    byId(filters[i]).addEventListener('change', function () {
                        if (!loadButton) {
                            createReport();
                        }
                        equalHeight();
                        that.preventScroll();
                    });
                }

                var buttons = formEl.querySelectorAll('input[type="button"]');
                for (i = 0; i < buttons.length; i++) {
                    buttons[i].addEventListener('click', function () {
                        onFormDirty();
                        if (!loadButton) {
                            createReport();
                        }
                        that.preventScroll();
                    });
                }


                window.qsPolling = {
                    update: function () {
                        that.preventScroll();
                        if (!loadButton) {
                            SERVER.updateRange();
                        }
                        onFormDirty();
                    }
                };

            }


            function onFormClean() {
                saveButton.disabled = true;
                saveButton.value = 'Report saved';
                if (copyButtonClicked) {
                    copyButton.disabled = true;
                    copyButton.value = 'Report copied';
                }
                dirty = false;
                typeChanged = false;
            }


            function onFormDirty() {
                if (!dirty) {
                    that.enableSaveButton();
                    dirty = true;
                }
            }


            this.enableSaveButton = function () {
                typeChanged = true;
                saveButton.disabled = false;
                saveButton.value = 'Save report';
                copyButton.disabled = false;
                copyButton.value = 'Save as copy';
            };


            function submit(evt) {

                // prevent default first, because later the code can throw an exception, or you just forget it and the form will get submitted
                evt.preventDefault();

                if (!options.name) {
                    window.scrollTo(0, 0);
                    formEl.name.focus();
                    alert('Please enter the report name.');
                    return false;
                }

                if (!dirty && !typeChanged && !copyButtonClicked) {
                    return false;
                }

                if (loadButton) {
                    SERVER.getRangeFromOptions();
                }

                options.startdate = START;
                options.enddate = END;
                options.starttime = START - moment.unix(START).startOf('day').unix();
                options.endtime = END - moment.unix(END).startOf('day').unix();

                CHART.resetZoom();

                if (copyButtonClicked) {
                    options.id = 0;
                    if (options.name === originalTitle) {
                        options.name += ' (copy)';
                        formEl.name.value = options.name;
                    }
                }
                originalTitle = options.name;

                titleElement.innerHTML = 'Call statistics :: ' + UTILS.escapeHtml(options.name);

                var oldId = options.id;
                UTILS.post(formEl.getAttribute('action'), UTILS.serialize(options, true), function (response) {
                    var id = response.getElementsByTagName('return')[0].getAttribute('id');
                    options.id = id;
                    if (id !== oldId) {
                        window.history.pushState('', options.name, '//' + location.host + location.pathname + '?id=' + id);
                    }
                    onFormClean();
                    copyButtonClicked = false;
                });

                copyButton.style.display = '';
                equalHeight();

                return false;
            }


            setWatchers();

            if (copyButton) {
                loadButton.addEventListener('click', function (evt) {
                    evt.preventDefault();
                    SERVER.updateRange();
                    getVisibleColumnsAndRows();
                    loadButton.style.display = 'none';
                    equalHeight();
                    loadButton = null;
                });
            }
            else {
                copyButton = saveButton;
                saveButton = loadButton;
                loadButton = null;
            }

            if (options.id) {
                onFormClean();
                titleElement.innerHTML = 'Call statistics :: ' + UTILS.escapeHtml(options.name);
            }
            else {
                titleElement.innerHTML = 'Call statistics :: New report';
            }

            formEl.addEventListener('submit', submit);

            copyButton.addEventListener('click', function () {
                copyButtonClicked = true;
            });

            if (!options.id) {
                copyButton.style.display = 'none';
            }

            window.addEventListener('scroll', function () {
                savedScrollX = window.pageXOffset;
                savedScrollY = window.pageYOffset;
            });

            window.addEventListener("popstate", function () {
                location.reload();
            });

            window.onbeforeunload = function () {
                if (dirty) {
                    return "You have not saved your report options. If you navigate away, your changes will be lost";
                }
            };

            if (!loadButton) {
                SERVER.updateRange();
            }
        }


        function openCallDetails (i, j) {
            var jj = colPos[j];

            if (jj >= COL_timeStart && jj < COL_timeEnd) {
                var info = table[i].calls;
                if (jj >= COL_timeStart + 4 && jj < COL_timeStart + 8) { // talk time
                    var newInfo = [];
                    for (var x = 0, xx = info.length; x < xx; x++) {
                        if (info[x].answered) {
                            newInfo.push(info[x]);
                        }
                    }
                    info = newInfo;
                }
                new Popup(info, j);
            }
            else if (jj !== COL_loggedIn) {
                new Popup(table[i].info[j], j);
            }
            else {
                new Popup(table[i], j, true);
            }
        }


        function Popup(calls, col, isLoggedInTime) {
            var overlay,
                modal,
                row,
                callsTbl = [],
                theadHtml = '<th>Status<br/>Direction</th><th>Calling number<br/>Called number</th><th>Start<br/>End</th><th>Billable time<br/>Cost</th>',
                tbodyHtml = '',
                filenameCsv,
                headlineCsv,
                formatStr = CONFIG.dateformat;


            function escListen (evt) {
                if (evt.keyCode === 27) {
                    closeModal();
                }
            }


            function closeModal() {
                overlay.className = '';
                document.removeEventListener('keyup', escListen);
                setTimeout(function () {
                    document.body.removeChild(overlay);
                }, 190);
            }


            function capitalise(str) {
                return str.charAt(0).toUpperCase() + str.slice(1);
            }


            formatStr += ' ' + (CONFIG.timeformat === '12' ? 'hh:mm:ssa' : 'HH:mm:ss');

            if (calls && calls.length) {
                if (!isLoggedInTime) {
                    filenameCsv = COLUMNS[colPos[col]] + '.csv';
                    headlineCsv = 'Status,Direction,Calling type,Calling number,Called type,Called number,Start,End,Billable time,Cost,Call ID\n';

                    var secondTable = [], row1;

                    for (var i = 0, n = calls.length; i < n; i++) {
                        var call = calls[i],
                            destination,
                            ctype = call.ctype,
                            stype = call.stype,
                            callingNumber,
                            calledNumber;

                        if (call.dtype === 'external') {
                            destination = 'Outbound';
                        }
                        else if (stype === 'external') {
                            destination = 'Inbound';
                        }
                        else {
                            destination = 'Internal';
                        }

                        if (stype === "phone" || stype === "local" || stype === "external") {
                            callingNumber = call.snumber;
                        }
                        else {
                            callingNumber = capitalise(stype);
                        }

                        calledNumber = call.cnumber;
                        if (calledNumber === '' || calledNumber === null) {
                            calledNumber = capitalise(ctype);
                        }

                        row = [
                            call.answered ? 'Answered' : 'Not answered',
                            destination,
                            stype,
                            callingNumber,
                            ctype,
                            calledNumber,
                            moment.unix(call.start).format(formatStr),
                            moment.unix(call.end).format(formatStr),
                            UTILS.timeFormat(+call.talktime, 2),
                            call.symbol + call.cost,
                            call.callid
                        ];
                        row1 = [
                            call.answered ? 'Answered' : 'Not answered',
                            destination,
                            stype,
                            call.snumber,
                            ctype,
                            call.cnumber,
                            moment.unix(call.start).format(formatStr),
                            moment.unix(call.end).format(formatStr),
                            UTILS.timeFormat(+call.talktime, 2),
                            call.symbol + call.cost,
                            call.callid
                        ];
                        tbodyHtml += '<tr><td>' +
                            row[0] + '</br>' + row[1] + '</td><td>' +
                            row[3] + '</br>' + row[5] + '</td><td>' +
                            row[6] + '</br>' + row[7] + '</td><td>' +
                            row[8] + '</br>' + row[9] + '</td></tr>';
                        callsTbl.push(row);
                        secondTable.push(row1);
                    }
                }
                else {
                    filenameCsv = 'Available time.csv';
                    headlineCsv = 'Agent,Time,Event\n';
                    theadHtml = '<th>Agent</th><th>Time</th><th>Event</th>';
                    var intervals = calls.intervals || [[START, currentEndTime]];

                    var info = calls.info[col];
                    if (info) {
                        for (var j = 0, m = intervals.length; j < m; j++) {
                            var interval = intervals[j];
                            for (var i = 0, n = info.length; i < n; i++) {
                                var el = info[i].E.events;
                                for (var ii = 0, nn = el.length; ii < nn; ii++) {
                                    var time = el[ii].time;
                                    if (time >= interval[0] && time < interval[1]) {
                                        row = [info[i].name, time, el[ii].isLogin ? 'Available' : 'Unvailable'];
                                        callsTbl.push(row);
                                    }
                                }
                            }
                        }
                        callsTbl.sort(function (a, b) {
                            return a[1] - b[1];
                        });
                    }

                    n = callsTbl.length;
                    if (n) {
                        for (i = 0; i < n; i++) {
                            row = callsTbl[i];
                            row[1] = moment.unix(row[1]).format(formatStr);
                            tbodyHtml += '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td><td>' + row[2] + '</td></tr>';
                        }
                    }
                    else {
                        tbodyHtml = '<tr><td colspan="3" class="empty-row">No events</td></tr>';
                    }
                }
            }
            else {
                tbodyHtml = '<tr><td colspan="4" class="empty-row">No calls</td></tr>';
            }


            var html = '<overlay><modal class="results"><table cellpadding="0" cellspacing="0"><thead><tr class="head">' + theadHtml + '</tr></thead><tbody>' + tbodyHtml + '<tr class="foot"><td class="button" colspan="4"><input type="button" style="float:left" id="modal-close" class="universal" value="Close window">';
            if (callsTbl.length) {
                html += '<input type="button" id="modal-csv" class="universal secondary" value="Export as .csv">';
            }
            html += '</td></tr></tbody></table></modal></overlay>';
            document.body.insertAdjacentHTML('beforeend', html);

            overlay = document.querySelector('overlay');
            modal = document.querySelector('modal');

            overlay.onclick = closeModal;
            byId('modal-close').onclick = closeModal;
            if (callsTbl.length) {
                byId('modal-csv').onclick = function () {
                    vs.report.downloadCSV(secondTable || callsTbl, filenameCsv, headlineCsv);
                };
            }
            modal.addEventListener('click', function (evt) {
                evt.stopPropagation();
            });
            document.addEventListener('keyup', escListen);

            setTimeout(function () {
                overlay.className = 'active';
            });
        }


        function Server() {
            var that = this,
                username = CONFIG.username,
                password = CONFIG.password,
                xhr,
                preloader,
                lastToday,
                requestStart,
                requestEnd,
                stopPolling = false,
                timeoutHandle,
                isFirstRequest,
                errorsShown = 0,
                updateRangeOnEveryRequest = false;


            this.getRangeFromOptions = function () {
                var start,
                    end;

                function setStart() {
                    var startDay = options.startday;
                    if (startDay === '1') {
                        if (options.start_year) {
                            start = moment({
                                year: options.start_year,
                                month: options.start_month - 1,
                                day: options.start_day
                            });
                        }
                        else {
                            start = +options.startdate;
                            return;
                        }
                    }
                    else {
                        start = moment().add(startDay, 'days');
                    }

                    if (options.start_hour !== undefined) {
                        start.set({
                            hour: options.start_hour,
                            minute: options.start_minute,
                            second: options.start_second
                        });
                    }
                    else {
                        start.set({
                            hour: Math.floor(options.starttime / 3600),
                            minute: Math.floor((options.starttime % 3600) / 60),
                            second: options.starttime % 60
                        });
                    }
                    start = start.unix();
                }


                function setEnd() {
                    var endDay = options.endday;
                    if (endDay === '1') {
                        if (options.end_year) {
                            end = moment({
                                year: options.end_year,
                                month: options.end_month - 1,
                                day: options.end_day
                            });
                        }
                        else {
                            end = +options.enddate;
                            return;
                        }
                    }
                    else {
                        end = moment().add(endDay, 'days');
                    }

                    if (options.end_hour !== undefined) {
                        end.set({
                            hour: options.end_hour,
                            minute: options.end_minute,
                            second: options.end_second
                        });
                    }
                    else {
                        end.set({
                            hour: Math.floor(options.endtime / 3600),
                            minute: Math.floor((options.endtime % 3600) / 60),
                            second: options.endtime % 60
                        });
                    }
                    end = end.unix();
                }


                setStart();
                setEnd();

                START = Math.min(start, end);
                END = Math.max(start, end);

                if (START * 1000 > Date.now()) {
                    alert('The start time cannot be in the future.');
                    // todo, this case should be made more friendly
                    stopPolling = true;
                    SERVER.hidePreloader();
                    throw 'start > now';
                }

                if (CHART) {
                    CHART.savedZoom = null;
                }
            };


            function getRangeFromDropdown() {
                updateRangeOnEveryRequest = false;

                switch (byId(options.time).value) {
                    case '0_hour':
                        updateRangeOnEveryRequest = true;
                        START = moment().startOf('hour');
                        END = moment().endOf('hour');
                        break;

                    case '0_day':
                        START = moment().startOf('day');
                        END = moment().endOf('day');
                        break;

                    case '1_day':
                        START = moment().startOf('day').add(-1, 'days');
                        END = moment().endOf('day').add(-1, 'days');
                        break;

                    case '7_days':
                        START = moment().startOf('day').add(-7, 'days');
                        END = moment().endOf('day');
                        break;

                    case '0_month':
                        START = moment().startOf('month');
                        END = moment().endOf('month');
                        break;

                    case '1_month':
                        START = moment().startOf('month').add(-1, 'months');
                        END = moment().startOf('month').add(-1, 'seconds');
                        break;
                }

                START = START.unix();
                END = END.unix();
            }


            this.tryNewRequest = function (success, error) {
                clearTimeout(timeoutHandle);  // stop polling isn't harmful?

                if (!EMBEDDED) {
                    var polling = function() {
                        timeoutHandle = setTimeout(function () {
                            that.tryNewRequest();
                        }, +CONFIG.refresh);
                    }
                }

                if (!xhr && !stopPolling && !document.hidden && requestEnd >= requestStart/* && requestStart < Date.now() / 1000*/) {
                    var request = '?_username=' + encodeURIComponent(username) + ';_password=' + encodeURIComponent(password) + ';start=' + requestStart + ';end=' + requestEnd + ';recursive=' + options.recursive + ';id=' + (options.id || 0) + ';refresh=' + (CONFIG.refresh);
                    xhr = UTILS.get(request,
                        function (r) {
                            xhr = null;
                            response(r);
                            success && success();
                            polling && polling();
                        }, function () {    // on error, poll again
                            xhr = null;
                            error && error();
                            polling && polling();
                        });
                }
                else {
                    error && error();
                }
            };


            this.stopRequest = function () {
                clearTimeout(timeoutHandle);
                if (xhr) {
                    xhr.abort();
                    xhr = null;
                }
            };


            this.updateRange = function () {
                lastToday = moment().startOf('day');

                if (EMBEDDED && options.time) {
                    getRangeFromDropdown();
                } else {
                    this.getRangeFromOptions();
                }

                errorsShown = 0;
                stopPolling = false;
                isFirstRequest = true;
                this.addToBeginning = false;

                // if all required data is in the cache, don't query server
                if (START >= minRecordedTime && END <= maxRecordedTime) {
                    createReport();
                    stopPolling = true;
                    return;
                }
                // query only what is missing (but only from the beginning)
                else if (START < minRecordedTime && END >= minRecordedTime) {
                    createReport();
                    requestStart = START;
                    requestEnd = minRecordedTime;
                    this.addToBeginning = true;
                }
                // query only what is missing (but only from the end)
                else if (START <= maxRecordedTime && END > maxRecordedTime) {
                    createReport();
                    requestStart = maxRecordedTime;
                    requestEnd = END;
                }
                // if missing data is on both sides, just query everything
                else {
                    requestStart = START;
                    requestEnd = END;
                }

                var delta = 0;
                if (requestStart < minRecordedTime) {
                    delta += minRecordedTime - requestStart;
                }
                if (Math.min(requestEnd, Date.now() / 1000) > maxRecordedTime) {
                    delta += Math.min(requestEnd, Date.now() / 1000) - maxRecordedTime;
                }

                if (!preloader && delta > 300) {
                    showPreloader();
                }

                this.stopRequest();
                this.tryNewRequest();
            };


            function response(response) {
                that.hidePreloader();

                var json = JSON.parse(response);

                // break polling loop on error
                if (json.errors) {
                    if (!errorsShown) {
                        errorsShown++;
                        for (var j in json.errors) {
                            alert(json.errors[j].message);  // todo concat
                        }
                    }
                }
                else {
                    var updateEnd = +json.updated,
                        anythingChanged = addRecordsToDatabase(json);

                    minRecordedTime = Math.min(minRecordedTime, requestStart);
                    maxRecordedTime = Math.max(maxRecordedTime, Math.min(requestEnd, updateEnd));

                    if (updateRangeOnEveryRequest) {
                        getRangeFromDropdown();
                    }

                    if (isFirstRequest || anythingChanged) {
                        createReport(isFirstRequest);
                    }

                    isFirstRequest = false;
                    toggleButtons();

                    if (END <= maxRecordedTime) {
                        stopPolling = true;
                    }
                    else {
                        // Handle the change of day at midnight. If the start or end day is not a specific date then the report
                        // period should change every day.
                        if (moment().startOf('day').unix() !== lastToday.unix()) {
                            if (EMBEDDED || options.startday !== '1' || options.endday !== '1') {
                                that.updateRange();
                                return;     // quit loop
                            }
                        }

                        requestStart = maxRecordedTime;
                        requestEnd = END;
                    }
                }

                SERVER.addToBeginning = false;
            }


            function showPreloader() {
                preloader = document.createElement('IMG');
                preloader.src = '/local/qstatistics/include/img/ajax.gif';
                preloader.alt = '';
                preloader.className = 'ajax-preloader';
                if (!EMBEDDED) {
                    preloader.style.position = 'fixed';
                }
                container.appendChild(preloader);
            }


            this.hidePreloader = function () {
                if (preloader) {
                    container.removeChild(preloader);
                    preloader = false;
                }
            };


            if (!EMBEDDED) {
                document.addEventListener('visibilitychange', function () {
                    if (document.hidden) {
                        clearTimeout(timeoutHandle);
                    }
                    else {
                        that.tryNewRequest();
                    }
                });
                // window.addEventListener('beforeunload', function () {
                //     that.tryNewRequest();
                // });
            }
        }


        function Table() {
            var currentTab,
                htmlTable,
                theadTr,
                theadChildren,
                tbody,
                blockRefresh;


            this.render = function (slide, doResize) {
                if (blockRefresh) {
                    return;
                } // todo deep vs shallow rerender

                var str = '',
                    data = getTableWithPercentage();

                currentTab = slide;
                if (data) {
                    for (var i = 0, n = data.length; i < n; i++) {
                        str += '<tr><td>' + data[i].join('</td><td>') + '</td></tr>';
                    }
                }
                slide.innerHTML = '<table cellpadding="0" cellspacing="0" style="margin-bottom: 1px"><thead><tr class="head">' + createHeader() + '</tr></thead><tbody>' + str + '</tbody></table>';

                htmlTable = slide.children[0];
                theadTr = htmlTable.children[0].children[0];
                theadChildren = theadTr.children;
                tbody = htmlTable.children[1];

                if (doResize) {
                    this.resizeHeader();
                }
                assignHeaderEvents();
                assignBodyEvents();

                if (!EMBEDDED) {
                    equalHeight();
                    FORM.preventScroll();
                }
            };


            function createHeader() {
                function getSorting(i) {
                    if (sortingCol === i) {
                        return sortingOrder === 1 ? ' class="asc"' : ' class="desc"';
                    }
                    else {
                        return '';
                    }
                }


                var str = '<th style="position: relative" id="0col"' + getSorting(0) + '>' + (options.period ? 'Time' : 'Destination') + '</th>';

                for (var i = 1; i < colPosLength; i++) {
                    var newI = colPos[i];
                    str += '<th style="position: relative" id="' + newI + 'col" draggable="true" ondragover="return false"' + getSorting(newI) + '>' + COLUMNS[newI] + '</th>';
                }

                return str;
            }

            // TODO old table compare with new one, and then rerender


            this.resizeHeader = function () {
                if (theadTr) {
                    theadTr.style.fontSize = '';
                    var containerWidth = currentTab.clientWidth,
                        tableWidth = htmlTable.clientWidth,
                        fontSize = 13;

                    if (containerWidth >= tableWidth) {
                        return;
                    }

                    do {
                        theadTr.style.fontSize = --fontSize + 'px';
                    } while (fontSize > 10 && containerWidth < htmlTable.clientWidth);
                }
            };


            function assignHeaderEvents() {
                var tr = htmlTable.children[0].children[0],
                    startTh,
                    startId;

                tr.addEventListener('click', function (evt) {
                    startTh = evt.target;
                    startId = parseInt(startTh.id);

                    if (sortingCol === startId) {
                        sortingOrder *= -1;
                    }
                    else {
                        sortingOrder = -1;
                    }
                    sortingCol = startId;
                    if (startId) {
                        if (EMBEDDED) {
                            createReport();
                        }
                        else {
                            sortTable();
                            TABS.update();
                        }
                    }
                    else {
                        createReport();
                    }
                });

                tr.addEventListener('dragstart', function (evt) {
                    blockRefresh = true;
                    startTh = evt.target;
                    startId = parseInt(startTh.id);
                    startTh.style.opacity = 0.5;
                    startTh.style.outline = '1px dashed white';
                    evt.dataTransfer.effectAllowed = 'move';
                    evt.dataTransfer.dropEffect = 'move';
                });

                tr.addEventListener('dragover', function (evt) {
                    var target = evt.target;

                    for (var i = 0, n = theadChildren.length; i < n; i++) {
                        var el = theadChildren[i];
                        if (el !== startTh && el !== target) {
                            el.style.opacity = '';
                        }
                    }

                    var currId = parseInt(target.id);
                    if (!currId) {
                        return false;
                    }

                    if (startTh !== target) {
                        target.style.opacity = 0.75;
                    }
                    else {
                        return false;
                    }
                });

                tr.addEventListener('dragend', function () {
                    blockRefresh = false;
                    for (var i = 0, n = theadChildren.length; i < n; i++) {
                        theadChildren[i].style.opacity = '';
                        startTh.style.outline = '';
                    }
                });

                tr.addEventListener('drop', function (evt) {
                    blockRefresh = false;
                    var target = evt.target,
                        currId = parseInt(target.id);

                    startTh.style.opacity = 1;
                    if (startTh !== target) {
                        var id1 = reorder.indexOf(currId),
                            id2 = reorder.indexOf(startId);
                        var temp = reorder[id1];
                        reorder[id1] = reorder[id2];
                        reorder[id2] = temp;
                        getColumnPositions();
                        createReport();
                    }
                });
            }


            function assignBodyEvents() {
                var tbody = htmlTable.children[1],
                    mouseMoves = 0;

                tbody.addEventListener('mousedown', function () {
                    mouseMoves = 0;
                });

                tbody.addEventListener('mousemove', function () {
                    mouseMoves++;
                });

                tbody.addEventListener('mouseup', function (evt) {
                    if (mouseMoves < 3) {
                        var target = evt.target;
                        if (target.tagName === 'SMALL') {
                            target = target.parentNode;
                        }
                        var row = target.parentNode,
                            bc = tbody.children;
                        for (var i = 0, n = bc.length; i < n; i++) {
                            if (row === bc[i]) {
                                var rc = row.children;
                                for (var j = 1, m = rc.length; j < m; j++) {
                                    if (target === rc[j]) {
                                        break;
                                    }
                                }
                                break;
                            }
                        }

                        if (j !== m) {
                            openCallDetails(i, j);
                        }
                    }
                });
            }


            var rightMenu = byId('right-menu'),
                panelOpenBtn = byId('panel-open-button');

            if (!EMBEDDED) {
                var banner = byId('h_title'),
                    bannerHeight = banner.clientHeight;

                this.onscroll = function () {
                    if (theadChildren) {
                        if (bannerHeight < 40) {
                            bannerHeight = banner.clientHeight;
                        }
                        if (bannerHeight) {
                            var scroll = window.pageYOffset - 53 - bannerHeight;

                            if (scroll > 0) {
                                panelOpenBtn.style.top = scroll + 'px';
                                rightMenu.style.top = scroll + 43 + 'px';
                                if (options.type === 'table') {
                                    for (var i = 0, n = theadChildren.length; i < n; i++) {
                                        theadChildren[i].style.top = scroll + 'px';
                                    }
                                }
                            }
                            else {
                                panelOpenBtn.style.top = '';
                                rightMenu.style.top = '43px';
                                if (options.type === 'table') {
                                    for (i = 0, n = theadChildren.length; i < n; i++) {
                                        theadChildren[i].style.top = '';
                                    }
                                }
                            }
                        }
                    }
                };

                window.addEventListener('scroll', this.onscroll);
            }
        }


        function Tabs() {
            var types = ['table', 'linechart', 'barchart', 'stacked', 'piechart'],
                type = options.type,
                upToDate = [],
                zIndex = 1,
                slideIndex = types.indexOf(type),
                str = '';

            for (var i in types) {
                str += '<slide style="z-index: ' + (+i === slideIndex ? 1 : 0) + '"></slide>';
            }

            container.innerHTML = str +
                '<div id="piechart-chooser"></div><button id="zoom-out" onclick="vs.chart.resetZoom()" class="universal">Reset chart</button>' +
                '<div id="zooming-overlay" ondragstart="return false"></div><div id="left-overlay">&#10096;</div><div id="right-overlay">&#10097;</div>';
            byId('main-content').insertAdjacentHTML('afterend', '<section id="right-menu"><button id="go-table" onclick="vs.tabs.goTo(\'table\')" disabled></button><button id="go-linechart" onclick="vs.tabs.goTo(\'linechart\')" disabled></button><button id="go-barchart" onclick="vs.tabs.goTo(\'barchart\')" disabled></button><button id="go-stacked" onclick="vs.tabs.goTo(\'stacked\')" disabled></button><button id="go-piechart" onclick="vs.tabs.goTo(\'piechart\')" disabled></button><button id="go-csv" onclick="vs.report.downloadCSV()" disabled></button><button id="go-png" onclick="vs.chart.downloadPNG()" disabled></button></section>');
            // todo put this in thml

            var children = container.children,
                goPng = byId('go-png'),
                pieSourceChooser = byId('piechart-chooser');

            this.tabs = {};


            this.goTo = function (nextType) {
                var slide = children[slideIndex],
                    nextSlideIndex = types.indexOf(nextType),
                    nextSlide = children[nextSlideIndex];

                // if chart has bee zoomed and we are moving to other tab, then cancel zoom and recreate report
                if (CHART.savedZoom && slideIndex !== nextSlideIndex) {
                    byId('go-' + type).className = '';
                    type = nextType;
                    CHART.resetZoom();
                    return; // .resetZoom() will call goTo in the end
                }

                this.tabs[nextType] = nextSlide;

                if (nextSlideIndex !== slideIndex) {
                    slide.style.opacity = 0;
                    nextSlide.style.zIndex = ++zIndex;
                    nextSlide.style.opacity = 1;
                    byId('go-' + type).className = '';
                    FORM.enableSaveButton();
                }

                type = options.type = nextType;

                if (!upToDate[nextSlideIndex]) {
                    if (nextType === 'table') {
                        TABLE.render(nextSlide, true);
                    }
                    else {
                        CHART.render(nextSlide, nextType);
                    }
                }
                upToDate[nextSlideIndex] = true;

                goPng.disabled = (nextType === 'table');
                pieSourceChooser.style.display = nextType === 'piechart' ? '' : 'none';
                byId('go-' + nextType).className = 'active';
                toggleLROverlay(nextType);

                slideIndex = nextSlideIndex;

                equalHeight();
                TABLE.onscroll();
            };


            this.update = function () {
                upToDate = [];
                this.goTo(type);
            };
        }


        var SERVER = this.server = new Server();

        if (!EMBEDDED) {
            var TABS = new Tabs(),
                TABLE = new Table(),
                FORM = new Form(formEl);

            htmlConstructor();
        }


        for (var i = 1, n = COLUMNS.length; i < n; i++) {
            reorder[i] = i;
        }

        getVisibleColumnsAndRows();


        if (EMBEDDED) {
            container = container.children[1] || container;
            if (options.type === 'table') {
                var TABLE = new Table();
                container.classList.add('results');
            }
            else {
                var CHART = new Chart();
            }
            // todo do I recalculate everything if sorting of first column changes?

            if (options.time) {
                byId(options.time).addEventListener('change', function () {
                    SERVER.updateRange();
                });
            }
            if (options.queuesSelect) {
                byId(options.queuesSelect).addEventListener('change', function () {
                    debugger;
                    options.queues = 'use_include';
                    delete memorizedIncludeIds[options.queuesSelect];
                    createReport();
                });
            }
            SERVER.updateRange();
        }
        else {
            var CHART = new Chart();
            toggleLROverlay('table');
            equalHeight();
        }

        window.vs = {
            tabs: TABS,
            chart: CHART,
            report: report
        };

    }


    function Utils() {
        var DAY = 86400;


        this.unique = function (arr) {
            for (var i = 0, j; i < arr.length; i++) {
                while ((j = arr.indexOf(arr[i], i + 1)) !== -1) {
                    arr.splice(j, 1);
                }
            }
        };


        this.pad = function (s) {
            if (s < 10) {
                s = '0' + s;
            }
            return s;
        };


        this.timeFormat = function (period, minPeriod) {
            period = Math.round(period);
            var time = Math.floor(period / DAY),
                str = '';

            if (time || minPeriod === 4) {
                str = this.pad(time) + ':';
            }
            time = Math.floor((period % DAY) / 3600);
            if (time || str || minPeriod === 3) {
                str += this.pad(time) + ':';
            }
            time = Math.floor((period % 3600) / 60);
            if (time || str || minPeriod === 2) {
                str += this.pad(time) + ':';
            }
            time = period % 60;
            str += this.pad(time);
            return str;
        };


        this.googleTimeFormat = function (period, length) {
            var result = [];

            if (length === 4) {
                result.push(Math.floor(period / DAY));
            }

            result.push(Math.floor((period % DAY) / 3600), Math.floor((period % 3600) / 60), Math.floor(period % 60));
            return result;
        };


        this.downloadUrl = function (url, fileName, str) {
            var link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            if (link.download || !str) {
                link.click();
            }
            else {
                location.href = "data:application/octet-stream," + encodeURIComponent(str);
                alert('Sorry, downloads don\'t work well in your browser. Please add extension to your newly downloaded file.');
            }
            document.body.removeChild(link);
        };


        this.get = function (uri, success, failure) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/local/qstatistics/update/' + uri);
            xhr.onload = function () {
                // anything smarter? detect network loss?
                if (xhr.status === 200) {
                    success(xhr.responseText);
                }
                else {
                    failure();
                }
            };
            xhr.onerror = failure;
            xhr.send();

            return xhr;
        };


        this.post = function (url, payload, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
            xhr.onload = function () {
                // anything smarter? detect network loss?
                if (xhr.status === 200) {
                    callback && callback(xhr.responseXML);
                }
            };
            xhr.onerror = function () {
                alert('Can\'t reach server to save report settings!');
            };
            xhr.send(payload);

            return xhr;
        };


        this.contains = function (haystack, needle) {
            if (haystack.contains) {
                return haystack.contains(needle);
            }
            else {
                while (needle && needle !== haystack) {
                    needle = needle.parentNode;
                }
                return needle;
            }
        };


        this.formToJson = function (formEl) {
            var result = {};

            for (var i = 0, n = formEl.length; i < n; i++) {
                var el = formEl[i];
                // don't add those selects to options
                if (el.getAttribute('multiple') === null) {
                    result[el.name] = el.value;
                }
            }
            return result;
        };


        this.jsonToForm = function (json, formEl) {
            for (var i in json) {
                if (i) {
                    if (formEl[i] !== undefined) {
                        formEl[i].value = json[i];
                    }
                    else {
                        formEl.insertAdjacentHTML('beforeend', '<input type="hidden" name="' + i + '" value="' + UTILS.escapeHtml(json[i]) + '"/>');
                    }
                }
            }
        };


        this.serialize = function (json, form) {
            var result = [];

            for (i in json) {
                if (i) {
                    result.push(i + '=' + encodeURIComponent(json[i]));
                }
            }

            if (form) {
                var destination = ['queues', 'agents', 'phones'];
                for (var i = 0, n = destination.length; i < n; i++) {
                    var dest = destination[i],
                        selected = byId(dest + 'include_selected').options,
                        unselected = byId(dest + 'include_unselected').options;

                    for (var j = 0, m = selected.length; j < m; j++) {
                        result.push(dest + 'include' + '=' + encodeURIComponent(selected[j].value));
                    }

                    for (j = 0, m = unselected.length; j < m; j++) {
                        result.push(dest + 'include_unselected' + '=' + encodeURIComponent(unselected[j].value));
                    }
                }
            }

            return result.join('&');
        };


        this.escapeHtml = function (value) {
            var map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };

            if (typeof value !== 'string') {
                return value;
            }
            else {
                return value.replace(/[&<>"']/g, function (m) {
                    return map[m];
                });
            }
        };
    }


    function byId(id) {
        return document.getElementById(id);
    }


    // INIT
    // singletons are UPPER case
    var UTILS = new Utils();
    var CONFIG = UTILS.formToJson(document.settings);
    if (!CONFIG.dateformat) {
        CONFIG.dateformat = 'YYYY-MM-DD';
    }
    if (!CONFIG.timeformat) {
        CONFIG.timeformat = '24';
    }
    moment.tz.setDefault(CONFIG.timezone);
    var SAME_TZ = (new Date()).getTimezoneOffset() === moment().utcOffset();      // same timezone

    var reportServers = [];

    if (EMBEDDED) {
        for (var i = 0; i < EMBEDDED.length; i++) {
            var em = EMBEDDED[i];
            em.report.time = em.time;
            em.report.include = em.include;
            em.report.queuesSelect = em.queues;

            var report = new Report(em.report, byId(em.container));
            reportServers.push(report.server);
        }
    }
    else {
        var formEl = document.getElementsByTagName('form');
        formEl = formEl[formEl.length - 1];

        new Report(UTILS.formToJson(formEl), byId('left-content'), formEl);
    }




// TODO move the below to separate class

    if (EMBEDDED) {
        var offsetTimeouts = [],
            requestsEnded,
            postId = EMBEDDED[0].postid;


        function poll() {
            requestsEnded = 0;

            function promiseAll () {
                requestsEnded++;
                if (EMBEDDED.length === requestsEnded) {
                    timeoutHandle = setTimeout(poll, +CONFIG.refresh);
                }
            }


            for (var i = 0; i < reportServers.length; i++) {
                var offset = EMBEDDED && (+EMBEDDED[i].offset) || 0;
                if (offset) {
                    offsetTimeouts[i] = setTimeout(reportServers[i].tryNewRequest.bind(reportServers[i], promiseAll, promiseAll), offset);
                }
                else {
                    reportServers[i].tryNewRequest(promiseAll, promiseAll);
                }
            }
        }

        if (!document.hidden) {
            var timeoutHandle = setTimeout(poll, +CONFIG.refresh);
        }


        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                for (var i = 0; i < reportServers.length; i++) {
                    clearTimeout(offsetTimeouts[i]); // clear individual timeout with offset
                }
                clearTimeout(timeoutHandle);   // clear global polling cycle
            }
            else {
                for (i = 0; i < reportServers.length; i++) {
                    reportServers[i].tryNewRequest();
                }
                timeoutHandle = setTimeout(poll, +CONFIG.refresh);
            }
        });

        //window.addEventListener('beforeunload', poll);
    }
}