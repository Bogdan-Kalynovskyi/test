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
            now_END,
            reorder = [],
            colOrig,
            rowOrig,
            colPos,
            colPos1,
            cPos1EqualsM1,
            availPos,
            breakPos,
            lunchPos,
            colPosLength,
            table,
            sortingCol = 0,
            sortingOrder = 1,
            timeColVisible,
            queueStatusColVisible,
            agentStatusColVisible,
            destRowsVisible,
            isQstatistics = getQstatistics(),
            updatesHaveNoEvents,

            START,
            END,

            usedAgents,
            startSearchFromIndex,
            maxStateTime,

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
                'logintime',
                'breaktime',
                'lunchtime'
            ],
            destinationNames = [
                'allcalls',
                'inbound',
                'internal',
                'outbound'
            ],
            columnTitles = [
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
                'Available time',
                'Break Time',
                'Lunch time'
            ],

            colsCount = columnNames.length,  // == columnTitles????

            // todo define constants for all other columns (currently we have magic numbers)
           // COL_inbound = 5,
            COL_inboundA = 6,
            COL_inboundB = 7,
           // COL_internal = 8,
            COL_internalA = 9,
            COL_internalB = 10,
           // COL_outbound = 11,
            COL_outboundA = 12,
            COL_outboundB = 13,
            COL_timeStart = 14,
            COL_talkMin = 18,
            COL_totalMin = 22,
            COL_timeEnd = 26,
            COL_availTime = 33,
            COL_breakTime = 34,
            COL_lunchTime = 35;

        var KEY_id = 0,
            KEY_callid = 1,
            KEY_start = 2,
            KEY_answered = 3,
            KEY_end = 4,
            KEY_stype = 5,
            KEY_snumber = 6,
            KEY_ctype = 7,
            KEY_cnumber = 8,
            KEY_dtype = 9,
            KEY_dnumber = 10,
            KEY_holdtime = 11,
            KEY_talktime = 12,
            KEY_totaltime = 13,
            KEY_queuestatus = 14;

        var STATUS_avail = 0,
            STATUS_break = 1,
            STATUS_lunch = 2,
            STATUS_unavail = 3;


        options.type = options.type || 'table';
        options.period = +options.period;         // special greeting to options.period
        options.totalrow = +options.totalrow;     // special greeting to options.totalrow
        var oldOptionsPeriod = options.period;


        function appendArrays(a1, a2) {
            var l1 = a1.length,
                l2 = a2.length;

            for (i = 0; i < l2; i++) {
                a1[l1 + i] = a2[i];
            }
        }


        function isTimeCol(col) {
            return col >= COL_timeStart && col < COL_timeEnd;
        }
        function isTimePos(pos) {
            var orig = colOrig[pos];
            return orig >= COL_timeStart && orig < COL_timeEnd;
        }


        function isAgentStatusCol(col) {
            return col >= COL_availTime && col <= COL_lunchTime;
        }
        function isAgentStatusPos(pos) {
            return pos === availPos || pos === breakPos || pos === lunchPos;
        }

        function getQstatistics() {
            return options.abandon !== 0 || options.noagent !== 0 || options.timeout !== 0 || options.keypress !== 0 || options.agent !== 0 || options.caller !== 0 || options.transfer !== 0 || options.logintime !== 0 || options.breaktime !== 0 || options.lunchtime !== 0 || options.type === 'reasons';
        }



        function QAgentEvents() {
            this.events = [];

            var as = CONFIG.extraevents === 1;            // is always kept sorted


            // Sort array of objects by .time
            function byTime(a, b) {
                return a.time - b.time;
            }


            // Takes htmlNodesCollection and adds them to array. Checks for duplicates. Sorts. Returns whether array was changed
            this.add = function (arr) {
                var isChanged = false;

                for (var i = 0, n = arr.length; i < n; i++) {
                    var ev = arr[i],
                        event = {
                        time: +ev.time,
                        status: STATUS_avail
                    };

                    if (as) {
                        if (ev.status === 'break') {
                            event.status = STATUS_break;
                        }
                        else if (ev.status === 'lunch') {
                            event.status = STATUS_lunch;
                        }
                        else if (ev.status === 'unavailable') {
                            event.status = STATUS_unavail;
                        }
                    }
                    else if (ev.status !== 'available') {
                        event.status = STATUS_unavail;
                    }

                    for (var j = this.events.length - 1; j >= 0; j--) {
                        if (this.events[j].time === event.time && this.events[j].status === event.status) {
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


            this.reasons = function (periodStart, periodEnd) {
                var start,              // start and end of logged in period,
                    end,                // is composed out of a pair of events.
                    i = 1,
                    status,
                    event = this.events[0],
                    reasons = [];


                function try2RecordEvent() {
                    if (end > periodStart) {
                        start = Math.max(periodStart, start);
                        reasons.push({
                            start: start,
                            end: end,
                            status: status
                        });
                    }
                }


                if (event) {
                    start = event.time;
                    status = event.status;
                    event = this.events[1];

                    while (event && event.time < periodEnd) {
                        end = event.time;
                        try2RecordEvent();

                        status = event.status;
                        start = end;

                        i++;
                        event = this.events[i];
                    }

                    end = Math.min(now_END, periodEnd);
                    try2RecordEvent();
                }

                return reasons;
            };
        }


        function Reasons() {
            var that = this,
                as = CONFIG.extraevents === 1;

            function collectEvents(events, agentName) {
                var info = as ? [[], [], [], [], []] : [[], [], []];

                for (var i = 0, n = events.length; i < n; i++) {
                    var ev = events[i];
                    if (ev.time >= START && ev.time < END) {
                        ev.name = agentName;

                        info[0].push(ev);
                        if (ev.status === STATUS_avail) {
                            info[1].push(ev);
                        }
                        else {
                            if (as) {
                                if (ev.status === STATUS_break) {
                                    info[2].push(ev);
                                }
                                else if (ev.status === STATUS_lunch) {
                                    info[3].push(ev);
                                }
                                info[4].push(ev);
                            }
                            else {
                                info[2].push(ev);
                            }
                        }
                    }
                }
                return info;
            }


            this.render = function (container) {
                var googleData = [],
                    googleColors = [],
                    statusMap = {
                        0: 'Available',
                        1: 'Break',
                        2: 'Lunch',
                        3: 'Unavailable'
                    },
                    colorsMap = {
                        Available: 'green',
                        Break: 'red',
                        Lunch: 'blue',
                        Unavailable: 'orange'
                    },
                    tableData = [],
                    st = new Date((START - TIMEZONE_DIFF) * 1000),
                    en = new Date((END - TIMEZONE_DIFF) * 1000);

                if (options.totalrow) {
                    var totalRow = ['Total', 0, 0, 0, 0],
                    tri = totalRow.info = [[], [], [], [], []];
                }

                for (var a in usedAgents) {
                    var agent = agents[usedAgents[a]],
                        agentName = phoneTitleDisplay(agent),
                        reasons = agent.E.reasons(START, END),
                        reasonSum = [0, 0, 0, 0],
                        tableDataRow;

                    for (var i = 0; i < reasons.length; i++) {
                        var reason = reasons[i],
                            status = statusMap[reason.status];

                        googleData.push([agentName, status, new Date((reason.start - TIMEZONE_DIFF) * 1000), new Date((reason.end - TIMEZONE_DIFF) * 1000)]);
                        if (googleColors.indexOf(colorsMap[status]) === -1) {
                            googleColors.push(colorsMap[status]);
                        }
                        reasonSum[reason.status] += reason.end - reason.start;
                    }

                    if (!reasons.length) {
                        googleData.push([agentName, '', en, en]);
                        if (googleColors.indexOf('#d3d3d3') === -1) {
                            googleColors.push('#d3d3d3');
                        }
                    }

                    reasonSum[3] += reasonSum[1] + reasonSum[2];
                    if (as) {
                        tableDataRow = [agentName, now_END - START - reasonSum[3], reasonSum[1], reasonSum[2], reasonSum[3]];
                    }
                    else {
                        tableDataRow = [agentName, now_END - START - reasonSum[3], reasonSum[3]];
                    }
                    tableDataRow.info = collectEvents(agent.E.events, agentName);

                    if (totalRow) {
                        for (var j = 0, m = tableDataRow.length; j < m; j++) {
                            if (j) {
                                totalRow[j] += tableDataRow[j];
                            }
                            tri[j].push.apply(tri[j], tableDataRow.info[j]);
                        }
                    }

                    tableData.push(tableDataRow);
                }

                if (totalRow) {
                    tableData.push(totalRow);
                }

                if (a !== undefined) {                // non empty agents
                    SORTABLE.render(container, tableData, function () {
                        var chart = new google.visualization.Timeline(container.children[0]);
                        var dataTable = new google.visualization.DataTable();
                        dataTable.addColumn({type: 'string', id: 'Name'});
                        dataTable.addColumn({type: 'string', id: 'Status'});
                        dataTable.addColumn({type: 'date', id: 'Start'});
                        dataTable.addColumn({type: 'date', id: 'End'}); // todo adjust timezone
                        dataTable.addRows(googleData);
                        chart.draw(dataTable, {
                            colors: googleColors,
                            hAxis: {
                                minValue: st,
                                maxValue: en
                            }
                        });

                        that.chart = chart;
                    });
                }
                else {
                    container.innerHTML = '<h1 style="color: gray; text-align: center; margin-top: 2em"> No Events </h1>'
                }
            }
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
                oldOptions,
                zoomingOverlay = byId('zooming-overlay'),
                resetZoomBtn = byId('zoom-out'),
                rectSVG,
                startX,
                endX = null,
                goodEvt,
                lastPieSourceStr,
                byCol,
                byRow,
                hiddenInPie,
                pauseRedraw,
                dateFormat = CONFIG.dateformat.replace('YYYY', 'yyyy').replace('DD', 'dd'),
                chartArea = {
                    left: '5.5%',
                    top: 0,
                    height: (EMBEDDED ? '70%' : null),
                    bottom: '20%'
                },
                legend = {
                    position: 'top',
                    maxLines: 3
                },
                series = [],
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


            var pieSource = {
                _getRowFromHash: function (i) {
                    this.hash = i;

                    if (this.hash === 'total') {
                        this.hash = btoa('total');
                    }

                    var decoded = atob(this.hash);
                    var n = table.length;
                    for (i = 0; i < n; i++) {
                        if (table[i][0] === decoded) {
                            break;
                        }
                    }
                    if (i === n) {
                        i = options.totalrow ? n - 1 : 0;
                        this.hash = btoa(table[i][0]);
                    }

                    this.id = i;
                },

                _getRowFromIndex: function (i) {
                    var n = table.length;
                    if (i >= n || (options.period !== 0 && !table[i].total)) {
                        if (options.period !== 0) {
                            if (options.totalrow) {
                                for (i = n - 1; i >= 0; i--) {
                                    if (table[i].total) {
                                        break;
                                    }
                                }
                            }
                            else {
                                for (i = 0; i < n; i++) {
                                    if (table[i].total) {
                                        break;
                                    }
                                }
                            }
                            if (i === n || i === -1) {     // no rows in table: quite possible situation
                                this.by = 'column';
                                this.id = colOrig[1];
                                return;
                            }
                        }
                        else {
                            i = options.totalrow ? n - 1 : 0;
                        }
                    }

                    this.hash = btoa(table[i][0]);
                    this.id = i;
                },

                initFromValue: function(by, id) {
                    this.by = by;
                    this.hash = null;

                    if (isNaN(id)) {
                        this._getRowFromHash(id);
                    }
                    else {
                        id = +id;
                        if (by === 'column') {
                            if (colPos[id] === -1) {
                                id = colOrig[1];
                            }
                            this.id = id;
                        }
                        else {
                            this._getRowFromIndex(id)
                        }
                    }

                    options.piesource = this.by + '_' + (this.hash || this.id);

                    this.setDropdowns();
                },

                initFromOptions: function () {
                    var split = options.piesource;
                    if (split) {
                        split = split.split('_');
                        this.initFromValue(split[0], split[1]);
                    }
                    else {
                        this.initFromValue('column', colOrig[1]);
                    }
                },

                setDropdowns: function (force) {
                    if (byCol && byRow) {
                        if (force || this.lastBy !== this.by || this.lastId !== this.id) {
                            if (this.by === 'column') {
                                byCol.value = this.hash || this.id;
                                byRow.value = '';
                                if (byCol.selectedIndex === -1) {
                                    this.id = colOrig[0];
                                    byCol.value = this.id;
                                }
                            }
                            else {
                                byRow.value = this.hash || this.id;
                                byCol.value = '';
                                if (byRow.selectedIndex === -1 && table.length) {
                                    this.hash = btoa(table[0][0]);
                                    this.id = 0;
                                }
                            }

                            this.lastBy = this.by;
                            this.lastId = this.id;
                        }
                    }
                }
            };


            var chartTime = {
                init: function () {
                    this.format = CONFIG.timeformat === 12 ? 'hh:mma' : 'HH:mm';
                    this.hoursOnly = options.period > 0 && options.period < DAY && now_END - START <= DAY;
                },
                legend: function (dbRow) {
                    return this.hoursOnly ? moment.unix(dbRow.intervals[0][0]).format(this.format) : dbRow[0];
                }
            };


            function colorizeChart(type) {
                var allColors =
                    [
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
                        "yellow",
                        "#006600",
                        '#dddd00',
                        '#00dddd',
                        '#dd00dd'
                    ];

                if (type === 'piechart') {
                    pieSource.initFromOptions();

                    var colors = [];

                    if (pieSource.by === 'row') {
                        var totalCallsColOnly = (colPosLength === 2 && visibleCols[1]);
                        for (var i = 1; i < colPosLength; i++) {
                            if (totalCallsColOnly || i !== colPos1) {      // don't include "Total calls" column, unless it is the only one
                                colors.push({color: allColors[colOrig[i] - 1]});
                            }
                        }
                        chartOptions.piechart.colors = colors;
                    }
                    else if (options.period === 0 && table.length <= allColors.length) {
                        if (destRowsVisible) {
                            i = options.allcalls ? 1 : 0;            // in Destination mode, don't show "All calls" in chart

                            if (i === table.length) {
                                i = 0;
                            }

                            for (; i < rowOrig.length; i++) {
                                colors.push({color: allColors[rowOrig[i]]});
                            }
                            for (; i < table.length; i++) {
                                colors.push({color: allColors[i]});
                            }
                            chartOptions.piechart.colors = colors;
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
                        series[i - 1] = {color: allColors[colOrig[i] - 1]};
                    }
                    chartOptions[type].series = series;
                }
            }


            function renderPieSourceSelect() {
                var str = 'Display:<label> column <select id="piechart-by-column"><option value>Choose column</option>';

                for (var i = 1; i < colsCount; i++) {
                    if (visibleCols[i]) {
                        str += '<option value="' + i + '">' + columnTitles[i] + '</option>';
                    }
                }

                str += '</select></label><label> or row <select id="piechart-by-row"><option value>Choose row</option>';

                var tblLength = table.length;
                for (i = 0; i < tblLength; i++) {
                    var row = table[i];
                    if (options.period === 0 || row.total) {
                        str += '<option value="' + btoa(row[0]) + '">' + chartTime.legend(row) + '</option>';
                    }
                }
                str += '</select></label>';
                if (str !== lastPieSourceStr) {
                    byId('piechart-chooser').innerHTML = str;
                    lastPieSourceStr = str;

                    byCol = byId('piechart-by-column');
                    byRow = byId('piechart-by-row');

                    pieSource.setDropdowns(true);


                    function onDropdownChange(by) {
                        if (this.value === '') {
                            pieSource.setDropdowns(true);
                        }
                        else {
                            pieSource.initFromValue(by, this.value);
                            FORM.enableSaveButton();
                            colorizeChart('piechart');
                            renderPieChart();
                        }
                    }

                    // set dropdown behaviour
                    byCol.onchange = onDropdownChange.bind(byCol, 'column');
                    byRow.onchange = onDropdownChange.bind(byRow, 'row');
                }
            }


            function cacheTableHeader(pieChartRow, pieChartCol) {
                var maxNumber = 0,
                    maxTime = 0,
                    row;

                // when table row is displayed as pie chart
                if (pieChartRow !== undefined) {
                    row = table[pieChartRow];
                    for (var i = 1; i < colPosLength; i++) {
                        if (isAgentStatusPos(i)) {
                            maxTime = Math.max(maxTime, row[i]);
                        }
                        else {
                            maxNumber = Math.max(maxNumber, row[i]);
                        }
                    }
                    loggedInTimeDivider = maxNumber ? (maxTime / maxNumber * 26) : maxStateTime;
                }
                // when logged in time column is displayed
                else if (isAgentStatusCol(pieChartCol)) {
                    loggedInTimeDivider = maxStateTime;      // average
                }
                // not a pie chart
                else if (agentStatusColVisible) {
                    if (maxTotalNumber === undefined) {
                        maxTotalNumber = 0;
                        var tblLength = table.length;
                        for (i = 0; i < tblLength; i++) {
                            row = table[i];
                            for (var j = 1; j < colPosLength; j++) {
                                if (!isTimePos(j) && !isAgentStatusPos(j)) {
                                    maxTotalNumber = Math.max(maxTotalNumber, row[j]);
                                }
                            }
                        }
                    }
                    loggedInTimeDivider = maxTotalNumber ? (maxStateTime / maxTotalNumber * 26) : maxStateTime;
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
                        tableHeader.push(columnTitles[colOrig[i]] + (isAgentStatusPos(i) ? timeUnit : ''));
                    }
                }
            }


            function getPieDataTable() {
                var pieChartOptions = chartOptions.piechart,
                    dbRow,
                    id = pieSource.id,
                    data = [['', '']],                    // in pieChart, first row seems not to have any useful information
                    sumOfVisibleCells = 0,
                    tblLength = table.length;
                // todo what if piechart displays only duration cols?
                // display units for duration cols to make them more friendly


                hiddenInPie = [];

                if (pieSource.by === 'column') {
                    if (colPosLength) {
                        cacheTableHeader(undefined, id);
                        var pos = colPos[id],
                            i = (options.period === 0 && +options.allcalls) ? 1 : 0,            // in Destination mode, don't show "All calls" in chart
                            lastRow = tblLength - (options.totalrow ? 1 : 0);                   // also, never show "Total" row in piechart

                        if (i === lastRow && tblLength > 1) {
                            if (options.totalrow) {
                                lastRow++;
                            }
                            else if (+options.allcalls) {
                                i--;
                            }
                        }

                        for (; i < lastRow; i++) {
                            dbRow = table[i];
                            if (!isAgentStatusCol(id)) {
                                if (options.period === 0 || dbRow.total) {
                                    data.push([chartTime.legend(dbRow), dbRow[pos]]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += dbRow[pos];
                                }
                            }
                            else {
                                if (dbRow[pos] || dbRow.hasLIT) {
                                    data.push([dbRow[0] + timeUnit, +(dbRow[pos] / loggedInTimeDivider).toFixed(2)]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += dbRow[pos];
                                }
                            }
                        }
                    }
                }

                // row
                else {
                    if (table[id] && (options.period === 0 || table[id].total)) {

                        var totalCallsColOnly = (colPosLength === 2 && visibleCols[1]);

                        cacheTableHeader(id);
                        dbRow = table[id];

                        var headerLength = tableHeader.length;    // colPosLength?
                        for (i = 1; i < headerLength; i++) {
                            if (totalCallsColOnly || i !== colPos1) {
                                if (!isAgentStatusPos(i)) {
                                    data.push([tableHeader[i], dbRow[i]]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += dbRow[i];
                                }
                                else if (options.period || dbRow[i]) {
                                    data.push([tableHeader[i], +(dbRow[i] / loggedInTimeDivider).toFixed(2)]);
                                    hiddenInPie.push(i);
                                    sumOfVisibleCells += dbRow[i];
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
                        top: '14%',
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
                var googleTimeDateFormat,
                    data = [tableHeader],
                    hasIntegerCols = false,
                    hasDurationCols = false,
                    colAxisIndex = [],
                    lastRow = table.length - (options.totalrow ? 1 : 0);            // for time-based reports, don't show "Total" row
                if (lastRow === 0) {
                    lastRow = table.length;
                }

                for (var j = 0; j < lastRow; j++) {
                    var dbRow = table[j],
                        row = dbRow.slice(),
                        startTime = options.period > 0 && dbRow.intervals[0][0];

                    // for time - based reports
                    if (!TIMEZONE_DIFF && options.period > 0) {
                        row[0] = new Date(startTime * 1000);
                    }
                    else {
                        row[0] = chartTime.legend(dbRow);
                    }

                    for (var i = 1; i < colPosLength; i++) {
                        var i1 = colOrig[i],
                            j1 = i,
                            isTime = isTimeCol(i1);

                        if (isTime) {
                            row[j1] = UTILS.googleTimeFormat(row[j1]);
                        }
                        else if (isAgentStatusCol(i1)) {
                            // If agent was logged in for the whole time, the "logged in" chart should look as a straight line. .. // doto doesnt work
                            // For time-period-based that.report type, row[0] is a Date object
                            if (startTime && (!TABLE || sortingCol === 0) && j === lastRow - 1) {   // todo save sortingCol and reorder into options and db
                                row[j1] *= options.period / (now_END - startTime);
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
                            for (i = 1; i < colPosLength; i++) {
                                series[i - 1].targetAxisIndex = colAxisIndex[i - 1];
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


                if (options.period > 0 && options.period < DAY && now_END - START <= DAY) {
                    googleTimeDateFormat = CONFIG.timeformat === 12 ? 'hh:mmaa' : 'HH:mm';
                }
                else {
                    googleTimeDateFormat = dateFormat;
                    if (options.period < DAY) {
                        googleTimeDateFormat += ' ' + (CONFIG.timeformat === 12 ? 'hh:mmaa' : 'HH:mm');
                    }
                }

                // google charts display time on x axis better than I do, because they know font and the scale
                if (!TIMEZONE_DIFF && options.period > 0) {
                    chartOptions[type].hAxis = {
                        format: googleTimeDateFormat,
                        viewWindow: {
                            min: new Date(START * 1000),
                            max: new Date(now_END * 1000)
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


            function saveOptions() {
                if (!oldOptions) {
                    oldOptions = {
                        start: START,
                        end: END,
                        nowEnd: now_END,
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


            function move(direction, element) {
                var now = Date.now() / 1000,
                    leftTime = START,
                    rightTime = now_END,
                    delta = (rightTime - leftTime) * 0.1 * direction;
                if (direction < 0 || rightTime !== now) {
                    saveOptions();

                    START += delta;
                    END = rightTime + delta;
                    now_END = Math.min(now + 1, END);

                    changeChartRange();
                }
                else {
                    element.style.opacity = 0;
                    setTimeout(function () {
                        element.style.opacity = '';
                    }, 600);
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
                    saveOptions();

                    var leftTime = START,
                        rightTime = now_END;

                    START += (rightTime - leftTime) * (minX - window.pageXOffset - rectSVG.left) / rectSVG.width;
                    END = rightTime - (rightTime - leftTime) * (rectSVG.right + window.pageXOffset - maxX) / rectSVG.width;
                    now_END = Math.min(Date.now() / 1000 + 1, END);
                    options.period = oldOptions.period * (now_END - START) / (oldOptions.nowEnd - oldOptions.start);

                    changeChartRange();

                    container.onmousemove = null;
                }

                endX = null;
            }


            function mousewheel(evt) {
                if (options.period && options.type !== 'piechart') {
                    var svgr = charts[options.type] && charts[options.type].svgr;
                    if (svgr && evt.deltaY && (svgr === evt.target || UTILS.contains(svgr, evt.target))) {
                        saveOptions();

                        var leftTime = START,
                            rightTime = now_END,
                            rectSVG = svgr.getBoundingClientRect(),
                            center = evt.pageX + window.pageXOffset,
                            left = center - rectSVG.left,
                            right = rectSVG.right - center,
                            zoom = evt.deltaY > 0 ? -0.06 : 0.06;

                        START += (rightTime - leftTime) * left / rectSVG.width * zoom;
                        END = rightTime - (rightTime - leftTime) * right / rectSVG.width * zoom;
                        now_END = Math.min(Date.now() / 1000 + 1, END);
                        options.period = oldOptions.period * (now_END - START) / (oldOptions.nowEnd - oldOptions.start);

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
                currentTab = _currentTab;       // those 2 can be taken globally as well
                type = _type;

                if (!window.google || !google.visualization) {
                    setTimeout(function () {
                        that.render(_currentTab, _type, deep);
                    }, 100);
                }
                else if (table) {
                    google.charts.setOnLoadCallback(function () {
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
                        chartTime.init();
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

                                if (selection && selection.row !== null) {
                                    if (_type === 'piechart') {
                                        if (pieSource.by === 'column') {
                                            var i = hiddenInPie[selection.row], j = colPos[pieSource.id];
                                        }
                                        else {
                                            var j = hiddenInPie[selection.row], i = pieSource.id;
                                        }
                                    }
                                    else {
                                        var i = selection.row, j = selection.column;
                                    }

                                    openCallDetails(i, j);

                                    //google.visualization.setSelection([]);
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
                function b64toBlob(b64Data, contentType) {
                    var sliceSize = 1024,
                        byteCharacters = atob(b64Data),
                        byteArrays = [];

                    for (var offset = 0, len = byteCharacters.length; offset < len; offset += sliceSize) {
                        var slice = byteCharacters.slice(offset, offset + sliceSize),
                            sliceLen = slice.length;

                        var byteNumbers = new Array(sliceLen);
                        for (var i = 0; i < sliceLen; i++) {
                            byteNumbers[i] = slice.charCodeAt(i);
                        }

                        byteArrays.push(new Uint8Array(byteNumbers));
                    }

                    return new Blob(byteArrays, {type: contentType});
                }


                var fileName = (options.name.replace(/[^\w\s]/g, '_') || 'noname') + '.png',
                    source = options.type === 'reasons' ? REASONS.chart : charts[options.type],
                    b64data = source.getImageURI();

                if (navigator.msSaveBlob) { // IE 10+
                    navigator.msSaveBlob(b64toBlob(b64data.substr(22), 'image/png'), fileName);
                }
                else {
                    UTILS.downloadUrl(b64data, fileName, b64data);
                }
            };


            this.zoomHasChanged = function () {
                return oldOptions;
            };


            this.resetZoom = function () {
                if (oldOptions) {
                    START = oldOptions.start;
                    END = oldOptions.end;
                    now_END = oldOptions.nowEnd;
                    options.period = oldOptions.period;
                    resetZoomBtn.style.display = '';

                    changeChartRange(oldOptions.startday, oldOptions.endday);

                    oldOptions = null;
                    return true;
                }
            };


            if (!EMBEDDED) {
                container.addEventListener('mousedown', mousedown, true);
                window.addEventListener('mouseup', mouseup, true);
                container.addEventListener('wheel', mousewheel);
                byId('left-overlay').addEventListener('click', function () {
                    move(-1, this);
                });
                byId('right-overlay').addEventListener('click', function () {
                    move(1, this);
                });
            }
        }


        var calls,
            callIds,
            queues,
            agents,
            phones,
            minRecordedTime,
            maxRecordedTime,
            maxTotalNumber;

        function clearAllCalls() {
            calls = [];
            callIds = null;
            queues = {};
            agents = {};
            phones = {};
            usedAgents = [];
            minRecordedTime = Infinity;
            maxRecordedTime = 0;
            maxTotalNumber = undefined;
            updatesHaveNoEvents = false;
        }


        function addRecordsToDatabase(update) {
            var newCalls = update.cdrs_values;
            var newQueues = update.queues;
            var newAgents = update.agents;
            var newPhones = update.phones;

            var dbChanged = false;
            var queuesChanged = false;
            var agentPhoneChanged = false;
            var anyCallsPreviously = calls.length;

            if (newCalls.length) {
                if (anyCallsPreviously) {
                    if (!callIds) {
                        callIds = {};
                        for (var i = 0, n = calls.length; i < n; i++) {
                            var call = calls[i];
                            callIds[call[KEY_id]] = call;       // todo pay attention, bottleneck here.
                        }
                    }
                    for (i = 0, n = newCalls.length; i < n; i++) {
                        call = newCalls[i];
                        var oldCall = callIds[call[KEY_id]];   // integer keys?
                        if (oldCall) {
                            calls[calls.indexOf(oldCall)] = call;
                        }
                        callIds[call[KEY_id]] = call;       // todo pay attention, bottleneck here.
                    }

                    if (SERVER.addToBeginning) {
                        appendArrays(newCalls, calls);
                        calls = newCalls;
                    }
                    else {
                        appendArrays(calls, newCalls);
                    }
                }
                else {
                    calls = newCalls;
                }

                dbChanged = true;
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
                if (!dbChanged && agentStatusColVisible && agent.E.events.length && !(options.period === 0 && options.agents === 'none')) {
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

            for (var i = startSearchFromIndex, n = calls.length; i < n; i++) {
                callEnd = +calls[i][KEY_end];            //TODO do binary search, but considering the fact that searched element is closer to beginning
                if (startIndex === undefined) {
                    if (callEnd >= start) {
                        startIndex = i;
                        if (callEnd < end) {
                            endIndex = i;
                        }
                    }
                }
                else if (callEnd < end) {
                    endIndex = i;
                }
                else {
                    break;
                }
            }

            if (startIndex !== undefined && endIndex !== undefined) {
                startSearchFromIndex = endIndex + 1;
                return calls.slice(startIndex, endIndex + 1);
            }
            else {
                return [];
            }
        }


        function getVisibleColumnsAndRows() {
            for (var i = 1; i < colsCount; i++) {
                visibleCols[i] = options[columnNames[i]];
            }
            for (i in destinationNames) {
                visibleRows[i] = options[destinationNames[i]];
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
            colOrig = [0];
            timeColVisible = false;
            queueStatusColVisible = false;
            colPos = new Array(COL_lunchTime + 1);

            for (var i = 1; i < colsCount; i++) {
                var j = reorder[i];
                if (visibleCols[j]) {
                    if (isTimeCol(i)) {
                        timeColVisible = true;
                    }
                    else if (i >= COL_timeEnd && i < COL_availTime) {
                        queueStatusColVisible = true;
                    }
                    else if (isAgentStatusCol(i)) {
                        agentStatusColVisible = true;
                    }
                    colOrig.push(j);
                }
                colPos[i] = colOrig.indexOf(i);
            }
            colPosLength = colOrig.length;

            colPos1 = colPos[1];
            cPos1EqualsM1 = colPos1 === -1;
            availPos = colPos[COL_availTime];
            breakPos = colPos[COL_breakTime];
            lunchPos = colPos[COL_lunchTime];
        }


        function getRowPositions() {
            rowOrig = [];
            var rowIndex = 0;
            destRowsVisible = false;
            for (var i = 0, n = visibleRows.length; i < n; i++) {
                if (visibleRows[i]) {
                    rowOrig[i] = rowIndex++;
                    destRowsVisible = true;
                }
            }
        }

//todo when all 4 rows are inactive
        // then stop many calculations because no sense
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
                        if (EMBEDDED) {
                            if (options[i].selected) {
                                ids.push(options[i].value);
                            }
                        }
                        else {
                            ids.push(options[i].value);
                        }
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
                    return ids;
                    // todo memorise me too
                }
            }
            else {
                return getFromMultiSelect(destination + 'include_selected');
            }
        }


        function getTableWithPercentage(csv) {
            var result = new Array(table.length),
                inserts = 0;

            for (var i = 0, tblLength = table.length; i < tblLength; i++) {
                result[i] = table[i].slice();
                if (!csv) {
                    result[i][0] = UTILS.escapeHtml(result[i][0]);
                }
            }

            for (var j = 1; j < colPosLength; j++) {
                var i1 = colOrig[j],
                    j0 = j,
                    j1 = j0 + inserts,
                    withPercentage = visibleCols[i1] === 2,
                    isTime = timeColVisible && isTimeCol(i1),
                    isAgentStatus = isAgentStatusCol(i1);

                if (withPercentage || isTime || isAgentStatus) {
                    for (i = 0; i < tblLength; i++) {
                        var row = result[i],
                            perc;

                        if (isTime) {
                            row[j1] = UTILS.timeFormat(row[j1], 3);
                        }
                        else if (isAgentStatus) {
                            row[j1] = (options.period || table[i].hasLIT) ? UTILS.timeFormat(row[j1], 4) : '';
                        }

                        if (withPercentage) {
                            var tblRow = table[i];
                            if (isAgentStatus) {
                                if (tblRow[j0] || tblRow.hasLIT) {
                                    perc = tblRow.totalTime ? Math.round(100 * tblRow[j0] / tblRow.totalTime) : 0;
                                }
                                else {
                                    perc = '';
                                }
                            }
                            else {
                                if (i1 === COL_inboundA || i1 === COL_inboundB) {
                                    divide = tblRow.inbound;
                                }
                                else if (i1 === COL_outboundA || i1 === COL_outboundB) {
                                    divide = tblRow.outbound;
                                }
                                else if (i1 === COL_internalA || i1 === COL_internalB) {
                                    divide = tblRow.internal;
                                }
                                else {
                                    var divide = tblRow.total;
                                }
                                perc = divide ? Math.round(100 * tblRow[j0] / divide) : '';
                            }

                            if (csv) {
                                row.splice(j1 + 1, 0, perc);
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


            if (TABLE) {
                if (options.totalrow && (sortingOrder === -1 || sortingCol > 0)) {
                    var totalRow = table.pop();
                }

                if (sortingCol > 0) {
                    table.sort(byCol(colPos[sortingCol], sortingOrder));
                }
                else if (sortingOrder === -1) {
                    table.reverse();
                }

                if (totalRow) {
                    table.push(totalRow);
                }
            }
        }


        this.downloadCSV = function (callsInfoTable, fileName, headlineRow) {
            var data = callsInfoTable || (table && getTableWithPercentage(true));
            if (!data) {
                return;
            }
            // todo optimize

            var str, row,
                dataLength = data.length;

            if (headlineRow) {
                str = headlineRow;
            }
            else {
                str = '';
                row = [options.period ? 'Time' : 'Destination'];

                for (var i = 1; i < colPosLength; i++) {
                    var newI = colOrig[i];
                    row.push(columnTitles[newI]);
                    if (visibleCols[newI] === 2) {
                        row.push(columnTitles[newI] + ' %');
                    }
                }
                str += row.join(',') + '\r\n';
            }

            for (i = 0; i < dataLength; i++) {
                row = data[i];
                for (var j = 0, m = row.length; j < m; j++) {
                    var cell = row[j];
                    if (j === 0) {
                        if (typeof cell === 'string') {
                            cell.replace(/"/g, '""');
                            if (cell.search(/("|,|\n)/g) >= 0) {
                                cell = '"' + cell + '"';
                            }
                        }
                    }
                    str += j > 0 ? (',' + cell) : cell;
                }
                if (i !== dataLength - 1) {
                    str += '\r\n';
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


        function phoneTitleDisplay(call) {
            switch (options.phonetitle) {
                case 'name':
                    return call.name;
                case 'description':
                    return call.description || call.name;
                case 'internal':
                    return call.callerid_internal;
                case 'name_description':
                    return call.name + ' ' + (call.description || call.name);
                case 'internal_description':
                    return call.callerid_internal + ' ' + (call.description || call.name);
                case 'description_name':
                    return (call.description || call.name) + ' ' + call.name;
                case 'description_internal':
                    return (call.description || call.name) + ' ' + call.callerid_internal;
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
                if (!isTimePos(i)) {   // TODO bottleneck here
                    row.info[i] = [];
                }
            }

            if (timeColVisible && cPos1EqualsM1) {
                row.calls = [];
            }
            row.total = 0;
            row.inbound = 0;
            row.outbound = 0;
            row.internal = 0;
            row.hasLIT = false;

            return row;
        }


        function newShallowRow(call) {
            var row = new Array(colPosLength);
            row.call = call;
            row.inbound = 0;
            row.outbound = 0;
            row.internal = 0;
            return row;
        }


        function addInfo(row, call, i, repeatCount) {
            var pos = colPos[i];
            if (pos !== -1) {
                if (row.call) {     // shallow
                    row[pos] = repeatCount;     // it should always be 1, btw
                }
                else {

                    if (repeatCount === 1) {
                        row[pos]++;
                        row.info[pos].push(call);
                    }
                    else {
                        row[pos] += repeatCount;

                        var ri_i = row.info[pos],
                            j = ri_i.length,
                            end = j + repeatCount;

                        while (j < end) {
                            ri_i[j++] = call;
                        }
                    }

                }
            }
        }

                // }
                // else {
                //     var ri = row.info;
                //     debugger;   // this seems never callsed!!!!!!!! todo  !!!!!!!
                //
                //     for (i = 1; i < colPosLength; i++) {
                //         multiRow[i] += row[i];
                //         var ri_i = ri[i];
                //         if (ri_i) {   // otherwiese I'm not sure if agents don't get duplicated here
                //             appendArrays1(mri[i], ri_i);
                //         }
                //     }
                // }


        function addToTableVisibleRow(row, index) {
            if (visibleRows[index]) {
                var rowToAdd = table[rowOrig[index]],
                    mri = rowToAdd.info;

                // shallow only
                rowToAdd.total++;
                if (row.inbound) {
                    rowToAdd.inbound++;
                }
                if (row.outbound) {
                    rowToAdd.outbound++;
                }
                if (row.internal) {
                    rowToAdd.internal++;
                }
                for (var i = 1; i < colPosLength; i++) {
                    if (row[i]) {
                        rowToAdd[i]++;                  // shallow only
                        mri[i].push(row.call);
                    }
                }

                if (timeColVisible && cPos1EqualsM1) {
                    rowToAdd.calls.push(row.call);
                }
            }
        }

        // call                  - xml call
        // multiRow              - either appended one time or multiple times to multiRow or created as new row
        // dontAddToMultipleRows - see line above
        //
        // check for usages to understand better

        function putCallToTable(call, multiRow, addToThisRowOnly, cameFromPhoneFilter) {
            var stype = call[KEY_stype],
                dtype = call[KEY_dtype],
                answered = call[KEY_answered],
                external = 'external',
                local = 'local',
                isInbound,
                isInternal,
                isOutbound,
                row,
                repeatCount = 1;


            if (!addToThisRowOnly) {
                if (!visibleRows[0]) {
                    repeatCount = 0;
                }
                if (visibleRows[1] && (stype === external || stype === local)) {
                    repeatCount++;
                }
                // internal callers
                if (visibleRows[2] && (stype !== external && stype !== local && dtype !== external && dtype !== local)) {
                    repeatCount++;
                }
                // external destinations
                if (visibleRows[3] && (dtype === external || dtype === local)) {
                    repeatCount++;
                }
            }


            if (multiRow) {
                row = multiRow;
                row.total += repeatCount;

                if (timeColVisible && cPos1EqualsM1) {
                    var j = row.calls.length,
                        end = j + repeatCount;

                    while (j < end) {
                        row.calls[j++] = call;
                    }
                }
            }
            else {
                row = newShallowRow(call);
            }

            // total calls
            addInfo(row, call, 1, repeatCount);
            // sla time
            if (answered && (+call[KEY_holdtime] <= options.slatime)) {
                addInfo(row, call, 2, repeatCount);
            }
            // answered
            if (answered) {
                addInfo(row, call, 3, repeatCount);
            }
            // not answered
            if (!answered) {
                addInfo(row, call, 4, repeatCount);
            }
            // inbound calls
            isInbound = stype === external || stype === local;
            if (isInbound) {
                addInfo(row, call, 5, repeatCount);
                row.inbound += repeatCount;
            }
            // inbound answered
            if (isInbound && answered) {
                addInfo(row, call, 6, repeatCount);
            }
            // inbound no answer
            if (isInbound && !answered) {
                addInfo(row, call, 7, repeatCount);
            }
            // internal calls
            isInternal = stype !== external && stype !== local && dtype !== external && dtype !== local;
            if (isInternal) {
                addInfo(row, call, 8, repeatCount);
                row.internal += repeatCount;
            }
            // internal answered
            if (isInternal && answered) {
                addInfo(row, call, 9, repeatCount);
            }
            // internal no answer
            if (isInternal && !answered) {
                addInfo(row, call, 10, repeatCount);
            }
            // outbound
            isOutbound = dtype === external || dtype === local;
            if (isOutbound) {
                addInfo(row, call, 11, repeatCount);
                row.outbound += repeatCount;
            }
            // outbound answered
            if (isOutbound && answered) {
                addInfo(row, call, 12, repeatCount);
            }
            // outbound no answer
            if (isOutbound && !answered) {
                addInfo(row, call, 13, repeatCount);
            }


            // rather weird requirement not to count queuestatus for calls that came from "Telephone lines" filter
            if (!cameFromPhoneFilter && queueStatusColVisible) {
                calcQueueuStatusCols(row, call, repeatCount);
            }


            if (!multiRow && !addToThisRowOnly) {  // this is 100% the case from byDestType
                //total
                addToTableVisibleRow(row, 0);
                // external callers
                if (stype === external || stype === local) {
                    addToTableVisibleRow(row, 1);
                }
                // internal callers
                if (stype !== external && stype !== local && dtype !== external && dtype !== local) {
                    addToTableVisibleRow(row, 2);
                }
                // external destinations
                if (dtype === external || dtype === local) {
                    addToTableVisibleRow(row, 3);
                }
            }
        }


        function calcQueueuStatusCols(row, call, repeatCount) {
            var dtypeQueue = call[KEY_dtype] === 'queue',
                stypeQueue = call[KEY_stype] === 'queue';

            if (dtypeQueue || stypeQueue) {
                var q = call[KEY_queuestatus];

                if (q === 'abandon') {
                    addInfo(row, call, 26, repeatCount);
                } else if (q === 'exitwithtimeout') {
                    addInfo(row, call, 28, repeatCount);
                } else if (q === 'completeagent') {
                    addInfo(row, call, 30, repeatCount);
                } else if (q === 'completecaller') {
                    addInfo(row, call, 31, repeatCount);
                } else if (q === 'transfer') {
                    addInfo(row, call, 32, repeatCount);
                } else if (dtypeQueue) {
                    if (q === 'exitempty') {
                        addInfo(row, call, 27, repeatCount);
                    } else if (q === 'exitwithkey') {
                        addInfo(row, call, 29, repeatCount);
                    }
                }
            }
        }


        function reduceTable() {

            function calcTimeCols(row, calls) {
                var pos,
                    callsCount = calls.length,
                    minhold = Infinity,
                    avghold = 0,
                    maxhold = 0,
                    sumhold = 0,
                    mintalk = Infinity,
                    avgtalk = 0,
                    maxtalk = 0,
                    sumtalk = 0,
                    mintotal = Infinity,
                    avgtotal = 0,
                    maxtotal = 0,
                    sumtotal = 0,
                    talkCount = 0;
                if (callsCount !== row.total) {
                    debugger;
                }

                for (var i = 0; i < callsCount; i++) {
                    var call = calls[i],
                        hold = +call[KEY_holdtime],
                        talk = +call[KEY_talktime],
                        total = +call[KEY_totaltime];

                    minhold = Math.min(minhold, hold);
                    sumhold += hold;
                    maxhold = Math.max(maxhold, hold);
                    if (call[KEY_answered]) {
                        mintalk = Math.min(mintalk, talk);
                        sumtalk += talk;
                        maxtalk = Math.max(maxtalk, talk);
                        talkCount++;
                        if (showTotal) {
                            minTalk = Math.min(minTalk, mintalk);
                            maxTalk = Math.max(maxTalk, maxtalk);
                        }
                    }
                    mintotal = Math.min(mintotal, total);
                    sumtotal += total;
                    maxtotal = Math.max(maxtotal, total);

                    if (showTotal) {
                        minHold = Math.min(minHold, minhold);
                        maxHold = Math.max(maxHold, maxhold);
                        minTotal = Math.min(minTotal, mintotal);
                        maxTotal = Math.max(maxTotal, maxtotal);
                    }
                }

                if (minhold === Infinity) {
                    minhold = 0;
                }
                if (mintalk === Infinity) {
                    mintalk = 0;
                }
                if (mintotal === Infinity) {
                    mintotal = 0;
                }
                if (callsCount) {
                    avghold = sumhold / callsCount;
                    avgtotal = sumtotal / callsCount;
                }
                if (talkCount) {
                    avgtalk = sumtalk / talkCount;
                }

                pos = colPos[14];
                if (pos !== -1) {
                    row[pos] = minhold;
                }
                pos = colPos[15];
                if (pos !== -1) {
                    row[pos] = avghold;
                }
                pos = colPos[16];
                if (pos !== -1) {
                    row[pos] = maxhold;
                }
                pos = colPos[17];
                if (pos !== -1) {
                    row[pos] = sumhold;
                }

                pos = colPos[18];
                if (pos !== -1) {
                    row[pos] = mintalk;
                }
                pos = colPos[19];
                if (pos !== -1) {
                    row[pos] = avgtalk;
                }
                pos = colPos[20];
                if (pos !== -1) {
                    row[pos] = maxtalk;
                }
                pos = colPos[21];
                if (pos !== -1) {
                    row[pos] = sumtalk;
                }

                pos = colPos[22];
                if (pos !== -1) {
                    row[pos] = mintotal;
                }
                pos = colPos[23];
                if (pos !== -1) {
                    row[pos] = avgtotal;
                }
                pos = colPos[24];
                if (pos !== -1) {
                    row[pos] = maxtotal;
                }
                pos = colPos[25];
                if (pos !== -1) {
                    row[pos] = sumtotal;
                }

                if (showTotal) {
                    minHold = Math.min(minHold, minhold);
                    maxHold = Math.max(maxHold, maxhold);
                    minTalk = Math.min(minTalk, mintalk);
                    maxTalk = Math.max(maxTalk, maxtalk);
                    minTotal = Math.min(minTotal, mintotal);
                    maxTotal = Math.max(maxTotal, maxtotal);

                    sumHold += sumhold;
                    sumTalk += sumtalk;
                    sumTotal += sumtotal;
                    totalAnswered += talkCount;
                }
            }


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
                            pos = colPos[i];
                            totalRow[pos] = map[i];
                        }
                    }
                }

                totalRow.total = totalCallsCount;
                totalRow.inbound = totalInboundCount;
                totalRow.outbound = totalOutboundCount;
                totalRow.internal = totalInternalCount;
                totalRow.totalTime = reportDuration;
                table.push(totalRow);
            }


            var reportDuration = now_END - START,
                minHold = Infinity,
                minTalk = Infinity,
                minTotal = Infinity,
                maxHold = 0,
                maxTalk = 0,
                maxTotal = 0,
                sumHold = 0,
                sumTalk = 0,
                sumTotal = 0,
                totalAnswered = 0,
                totalCallsCount = 0,
                totalInboundCount = 0,
                totalOutboundCount = 0,
                totalInternalCount = 0,
                showTotal = options.totalrow,
                period0 = options.period === 0;

            if (showTotal) {
                var totalRow = new Array(colPosLength);
                totalRow.info = [];
                totalRow.intervals = [[START, now_END]];

                for (var j = 1; j < colPosLength; j++) {
                    totalRow[j] = 0;
                }
                totalRow[0] = 'Total';
            }

            for (var i = 0, tblLength = table.length; i < tblLength; i++) {
                var row = table[i];
                if (timeColVisible) {
                    var info = cPos1EqualsM1 ? row.calls : row.info[colPos1];
                    calcTimeCols(row, info);
                }

                if (showTotal) {
                    for (j = 1; j < colPosLength; j++) {
                        totalRow[j] += row[j];
                    }

                    totalRow.hasLIT |= row.hasLIT;
                    totalCallsCount += row.total;
                    totalInboundCount += row.inbound;
                    totalOutboundCount += row.outbound;
                    totalInternalCount += row.internal;
                }

                if (period0) {
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

            if (destRowsVisible) {
                for (var i = 0, n = destinations.length; i < n; i++) {
                    if (visibleRows[i]) {
                        var row = newRow();
                        row[0] = destinations[i];
                        table.push(row);
                    }
                }

                for (i = 0, n = filteredCalls.length; i < n; i++) {
                    putCallToTable(filteredCalls[i]);
                }
            }
        }


        function byTimePeriods() {

            function checkForOverflow() {
                if (EMBEDDED) {
                    if (options.time) {
                        switch (byId(options.time).value) {
                            case '0_hour':
                                options.period = 5 * 60;
                                break;

                            case '0_day':
                            case '1_day':
                                options.period = 3600;
                                break;

                            case '7_days':
                            case '0_month':
                            case '1_month':
                                options.period = 24 * 3600;
                                break;
                        }
                    }
                }
                else {
                    var splitsCount = (now_END - START) / options.period;
                    switch (options.type) {
                        case 'table':
                        case 'reasons':
                        case 'piechart':
                            if (splitsCount > 2000) {
                                alert('This report will contain ' + Math.floor(splitsCount) + ' rows, which is too much. \nPlease select longer period in "Report type" drop-down.');
                                options.period = oldOptionsPeriod;
                                byId('period').value = oldOptionsPeriod;
                                return true;
                            }
                            break;

                        case 'barchart':
                            if (splitsCount > (containerClientWidth - 70) / (colPosLength + 1) / 2) {
                                alert('Bar chart cannot display so many items. \nPlease select longer period in "Report type" drop-down.');
                                options.period = oldOptionsPeriod;
                                byId('period').value = oldOptionsPeriod;
                                return true;
                            }
                            break;

                        case 'linechart':
                        case 'stacked':
                            if (splitsCount > (containerClientWidth - 70) / 2) {
                                alert('The chart cannot display so many items. \nPlease select longer period in "Report type" drop-down.');
                                options.period = oldOptionsPeriod;
                                byId('period').value = oldOptionsPeriod;
                                return true;
                            }
                    }
                }
            }


            var startTime = START,
                endTime = START,
                calls,
                row,
                formatStr = CONFIG.dateformat;

            if (checkForOverflow()) {
                return;
            }

            if (options.period < DAY) {
                formatStr += ' ' + (CONFIG.timeformat === 12 ? 'hh:mma' : 'HH:mm');
            }

            while (startTime < now_END) {
                row = newRow();

                var start = moment.unix(startTime);
                row[0] = start.format(formatStr);

                if (options.period < DAY) {
                    endTime += options.period;
                }
                else {
                    endTime = start.add(options.period / DAY, 'days').unix();
                }
                endTime = Math.min(endTime, now_END);
                row.intervals = [[startTime, endTime]];

                calls = getCallsFromTimePeriod(startTime, endTime);

                if (destRowsVisible) {
                    for (var i = 0, n = calls.length; i < n; i++) {
                        putCallToTable(calls[i], row);
                    }
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
                if (CONFIG.timeformat === 12) {
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

            while (startTime < now_END) {
                endTime += period;
                endTime = Math.min(endTime, now_END);

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

                if (destRowsVisible) {
                    var callsCount = calls.length;
                    for (i = 0; i < callsCount; i++) {
                        putCallToTable(calls[i], row);
                    }
                }
                byQueueAgentPhone(calls, row, startTime, endTime);
                row.totalTime += endTime - startTime;

                startTime = endTime;
            }
        }


        function byDaysOfWeek() {
            var startTime = START,
                end = moment.unix(START).endOf('day'),
                endTime,
                calls,
                row,
                reportIndex,
                dayOfWeek,
                startDayOfWeek = end.day(),
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

            while (startTime < now_END) {
                endTime = end.unix() + 1;
                endTime = Math.min(endTime, now_END);

                dayOfWeek = end.day();
                reportIndex = dayOfWeek - startDayOfWeek;  // start from startDayOfWeek
                if (reportIndex < 0) {
                    reportIndex += 7;
                }

                row = table[reportIndex];
                calls = getCallsFromTimePeriod(startTime, endTime);
                row.intervals.push([startTime, endTime]);

                if (destRowsVisible) {
                    var callsCount = calls.length;
                    for (i = 0; i < callsCount; i++) {
                        putCallToTable(calls[i], row);
                    }
                }
                byQueueAgentPhone(calls, row, startTime, endTime);
                row.totalTime += endTime - startTime;

                end.add(1, 'days');
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
                            appendArrays(ids, queues[visibleQueues[o]].agents);
                        }
                        ids = UTILS.unique(ids);
                        ids.sort();
                        break;
                    case 'queues_available':
                        ids = [];
                        for (o = 0; o < visibleQueuesLength; o++) {
                            appendArrays(ids, queues[visibleQueues[o]].availableAgents);
                        }
                        ids = UTILS.unique(ids);
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
                else if (dest === 'agents') {
                    usedAgents = ids;
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
                                    match = call[KEY_dtype] === 'queue' && call[KEY_dnumber] === id;
                                    break;

                                case 'agents':
                                    match = call[KEY_stype] === 'queue' && call[KEY_dnumber] === el.dnumber && call[KEY_dtype] === el.dtype && visibleQueues.indexOf(call[KEY_snumber]) !== -1;
                                    break;

                                case 'phones':
                                    match = (call[KEY_stype] === 'phone' && call[KEY_snumber] === id) || (call[KEY_dtype] === 'phone' && call[KEY_dnumber] === id);
                                    break;
                            }

                            if (match) {
                                putCallToTable(call, row, true, dest === 'phones');
                            }
                        }

                        if (dest === 'agents' && agentStatusColVisible) {
                            var reasons = el.E.reasons(periodStart || START, periodEnd || now_END),
                                availTime = 0,
                                breakTime = 0,
                                lunchTime = 0,
                                unavailTime = 0;

                            for (var y = 0, yyy = reasons.length; y < yyy; y++) {
                                var reason = reasons[y];
                                switch (reason.status) {
                                    case STATUS_break:
                                        breakTime += reason.end - reason.start;
                                        break;
                                    case STATUS_lunch:
                                        lunchTime += reason.end - reason.start;
                                        break;
                                    case STATUS_unavail:
                                        unavailTime += reason.end - reason.start;
                                        break;
                                }
                            }
                            availTime = (periodEnd || now_END) - (periodStart || START) - breakTime - lunchTime - unavailTime;
                            if (availTime < 0) {
                                break;
                            }

                            if (visibleCols[COL_availTime]) {
                                row[availPos] += availTime;
                                row.info[availPos].push(el);
                                maxStateTime = Math.max(maxStateTime, availTime);
                            }
                            if (visibleCols[COL_breakTime]) {
                                row[breakPos] += breakTime;
                                row.info[breakPos].push(el);
                                maxStateTime = Math.max(maxStateTime, breakTime);
                            }
                            if (visibleCols[COL_lunchTime]) {
                                row[lunchPos] += lunchTime;
                                row.info[lunchPos].push(el);
                                maxStateTime = Math.max(maxStateTime, lunchTime);
                            }
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
                rightMenuHeight = 280 + 40,
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
                var showMoveLeftRight = (options.period <= 0 || nextType === 'table' || nextType === 'reasons' || nextType === 'piechart') ? 'none' : '';
                byId('left-overlay').style.display = showMoveLeftRight;
                byId('right-overlay').style.display = showMoveLeftRight;
            };


            menuButtons = document.getElementById('right-menu').children;
            containerClientWidth = container.clientWidth;
            var img = new Image();
            img.src = '/local/qstatistics/include/img/ajax.gif';
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
                else if (options.type === 'reasons') {
                    //REASONS.render();
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
            table = [];
            maxStateTime = 0;
            now_END = Math.min(Date.now() / 1000 + 1, END);

            startSearchFromIndex = 0;

            if (options.period === 0) {
                var slicedCalls = getCallsFromTimePeriod(START, END);
                byDestType(slicedCalls);
                byQueueAgentPhone(slicedCalls);
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
                else if (options.type === 'reasons') {
                    REASONS.render(container);
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
                        var disabled = (options.type === 'table' || options.type === 'reasons');  // don't show PNG if type === 'table'
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

                submitButtons = formEl.querySelectorAll('input[type="submit"]'),
                originalTitle = formEl.name.value,
                loadButton = submitButtons[0],
                saveButton = submitButtons[1],
                copyButton = submitButtons[2],
                copyButtonClicked,
                dirty = !options.id,
                typeChanged;


            this.preventScroll = function () {
                window.scrollTo(savedScrollX, savedScrollY);
            };


            this.showNewTime = function (startDay, endDay) {
                if (startDay === undefined) {
                    startDay = 1;
                }
                if (endDay === undefined) {
                    endDay = 1;
                }

                var start = moment.unix(START),
                    end = moment.unix(END - 1),
                    y1, m1, d1, y2, m2, d2;

                options.startday = startDay;
                options.endday = endDay;
                if (!EMBEDDED) {
                    byId('startdate').style.display = startDay === 1 ? '' : 'none';
                    byId('enddate').style.display = endDay === 1 ? '' : 'none';
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

                var formLength = formEl.length;
                for (i = 0; i < formLength; i++) {
                    // react on buttons below, not selects
                    if (formEl[i].getAttribute('multiple') === null) {
                        formEl[i].addEventListener('change', function () {
                            if (isNaN(this.value)) {
                                options[this.name] = this.value;
                            }
                            else {
                                options[this.name] = +this.value;
                            }

                            isQstatistics = getQstatistics();
                            if (updatesHaveNoEvents && isQstatistics) {
                                clearAllCalls();
                                if (!loadButton) {
                                    SERVER.startNewPolling();
                                }
                            }

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
                    oldOptionsPeriod = options.period;
                    byId('heading_rows').innerHTML = options.period ? 'Sum of destinations:' : 'Display destinations:';
                    if (!loadButton) {
                        toggleLROverlay(options.type);
                        createReport();
                    }
                    that.preventScroll();
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
                            SERVER.startNewPolling();
                        }
                    });
                }

                for (i = 1; i < colsCount; i++) {
                    var control = byId(columnNames[i]);
                    if (control) {
                        control.addEventListener('change', function () {
                            var pos = columnNames.indexOf(this.id);
                            if (!loadButton) {
                                setVisibleColumn(pos, +this.value);
                            }
                            that.preventScroll();
                        });
                    }
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
                            memorizedIncludeIds = {};
                            createReport();
                        }
                        that.preventScroll();
                    });
                }


                window.qsPolling = {
                    update: function () {
                        that.preventScroll();
                        if (!loadButton) {
                            SERVER.startNewPolling();
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
                options.enddate = END - 1;
                options.starttime = START - moment.unix(START).startOf('day').unix();
                options.endtime = (END - 1) - moment.unix(END - 1).startOf('day').unix();

                CHART.resetZoom();

                if (copyButtonClicked) {
                    options.id = 0;
                    if (options.name === originalTitle) {
                        options.name += ' (copy)';
                        formEl.name.value = options.name;
                    }
                }
                originalTitle = options.name;

                var oldId = options.id;
                UTILS.post(formEl.getAttribute('action'), UTILS.serialize(options, true), function (response) {
                    var id = response.getElementsByTagName('return')[0].getAttribute('id');
                    options.id = id;
                    if (id !== oldId) {
                        window.history.pushState('', options.name, '//' + location.host + location.pathname + '?id=' + id);
                    }

                    document.title = 'Call statistics :: ' + UTILS.escapeHtml(options.name);
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
                    SERVER.startNewPolling();
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
                document.title = 'Call statistics :: ' + UTILS.escapeHtml(options.name);
            }
            else {
                document.title = 'Call statistics :: New report';
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
                    return "You have not saved report options. If you navigate away, your changes will be lost";
                }
            };

            if (!loadButton) {
                SERVER.startNewPolling();
            }
        }


        function openCallDetails (i, j) {
            var orig = colOrig[j],
                row = table[i];


            function infoForTotalRow() {
                var result = [],
                    x = 0, tblLen = table.length - 1;

                if (isTimeCol(orig)) {
                    for (; x < tblLen; x++) {
                        var info = cPos1EqualsM1 ? table[x].calls : table[x].info[colPos1];
                        appendArrays(result, info);
                    }
                    if (cPos1EqualsM1) {
                        table[tblLen].calls = result;
                    }
                    else {
                        table[tblLen].info[colPos1] = result;
                    }
                }
                else if (isAgentStatusCol(orig)) {
                    if (options.period !== 0) {
                        if (table.length) {
                            result = table[0].info[j];
                        }
                        table[tblLen].info[j] = result;
                    }
                    else {
                        for (; x < tblLen; x++) {
                            appendArrays(result, table[x].info[j]);
                        }
                        UTILS.uniqueObj(result);
                        table[tblLen].info[j] = result;
                    }
                }
                else {
                    for (; x < tblLen; x++) {
                        appendArrays(result, table[x].info[j]);
                    }
                    table[tblLen].info[j] = result;
                }
            }


            if (options.totalrow && (i === table.length - 1)) {
                if (!row.info[j]) {
                    infoForTotalRow();
                }
            }

            if (isTimeCol(orig)) {
                if (!row.info[j]) {
                    var info = cPos1EqualsM1 ? row.calls : row.info[colPos1];

                    if (orig >= COL_talkMin && orig < COL_totalMin) { // just talk time
                        var newInfo = [];
                        for (var x = 0, xx = info.length; x < xx; x++) {
                            if (info[x][KEY_answered]) {
                                newInfo.push(info[x]);
                            }
                        }
                        info = newInfo;
                    }
                    row.info[j] = info;
                }
                new Popup(row, j);
            }
            else {
                new Popup(row, j, isAgentStatusCol(orig));
            }
        }


        function Popup(tblRow, col, isLoggedInTime, isAvailabilityReport) {
            var overlay,
                modal,
                theadTh,
                footTd,
                row,
                statusMap = {
                    0: 'Available',
                    1: 'Break',
                    2: 'Lunch',
                    3: 'Unavailable'
                },
                callsTbl = [],
                theadHtml = '<th>Status<br>Direction</th><th>Calling number<br>Called number</th><th>Start<br>End</th><th>Total time<br>Billable time</th>',
                tbodyHtml = '',
                filenameCsv,
                headlineCsv,
                isIE = navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0,
                isFF = navigator.userAgent.toLowerCase().indexOf('firefox') > -1,
                formatStr = CONFIG.dateformat,
                info = tblRow.info[col];


            function escListen (evt) {
                if (evt.keyCode === 27) {
                    closeModal();
                }
            }


            function closeModal() {
                overlay.className = '';
                document.removeEventListener('keyup', escListen);
                window.removeEventListener('resize', scroll);
                setTimeout(function () {
                    document.body.removeChild(overlay);
                }, 190);
            }


            function capitalise(str) {
                return str.charAt(0).toUpperCase() + str.slice(1);
            }


            formatStr += ' ' + (CONFIG.timeformat === 12 ? 'hh:mm:ssa' : 'HH:mm:ss');

            if (!isLoggedInTime) {
                if (info.length) {
                    filenameCsv = columnTitles[colOrig[col]] + '.csv';
                    headlineCsv = 'Status,Direction,Calling type,Calling number,Called type,Called number,Start,End,Total time,Billable time,Call ID\r\n';

                    var secondTable = [], row1;

                    for (var i = 0, n = info.length; i < n; i++) {
                        var call = info[i],
                            destination,
                            ctype = call[KEY_ctype],
                            stype = call[KEY_stype],
                            callingNumber,
                            calledNumber;

                        if (call[KEY_dtype] === 'external') {
                            destination = 'Outbound';
                        }
                        else if (stype === 'external') {
                            destination = 'Inbound';
                        }
                        else {
                            destination = 'Internal';
                        }

                        if (stype === "phone" || stype === "local" || stype === "external") {
                            callingNumber = call[KEY_snumber];
                        }
                        else {
                            callingNumber = capitalise(stype);
                        }

                        calledNumber = call[KEY_cnumber];
                        if (calledNumber === '') {
                            calledNumber = capitalise(ctype);
                        }

                        var v1 = moment.unix(call[KEY_start]).format(formatStr),
                            v2 = moment.unix(call[KEY_end]).format(formatStr),
                            v3 = UTILS.timeFormat(+call[KEY_totaltime], 2),
                            v4 = UTILS.timeFormat(+call[KEY_talktime], 2);

                        row = [
                            call[KEY_answered] ? 'Answered' : 'Not answered',
                            destination,
                            callingNumber,
                            calledNumber,
                            v1,
                            v2,
                            v3,
                            v4,
                            call[KEY_callid]
                        ];
                        row1 = [
                            call[KEY_answered] ? 'Answered' : 'Not answered',
                            destination,
                            stype,
                            call[KEY_snumber],
                            ctype,
                            call[KEY_cnumber],
                            v1,
                            v2,
                            v3,
                            v4,
                            call[KEY_callid]
                        ];
                        tbodyHtml += '<tr><td>' +
                            row[0] + '<br>' + row[1] + '</td><td>' +
                            row[2] + '<br>' + row[3] + '</td><td>' +
                            row[4] + '<br>' + row[5] + '</td><td>' +
                            row[6] + '<br>' + row[7] + '</td></tr>';
                        callsTbl.push(row);
                        secondTable.push(row1);
                    }
                }
                else {
                    tbodyHtml = '<tr><td colspan="4" class="empty-row">No calls</td></tr>';
                }
            }
            else {
                filenameCsv = 'Available time.csv';
                headlineCsv = 'Agent,Time,Event\r\n';
                theadHtml = '<th>Agent</th><th>Time</th><th>Event</th>';

                if (isAvailabilityReport) {
                    for (var ii = 0, nn = info.length; ii < nn; ii++) {
                        var ev = info[ii],
                            time = ev.time;
                        if (time >= START && time < END) {
                            row = [ev.name, time, statusMap[ev.status]];
                            callsTbl.push(row);
                        }
                    }
                }

                else {
                    var intervals = tblRow.intervals || [[START, now_END]];
                    for (var j = 0, m = intervals.length; j < m; j++) {
                        var interval = intervals[j];

                        for (i = 0, n = info.length; i < n; i++) {
                            var call = info[i],
                                name = phoneTitleDisplay(call),
                                events = call.E.events;

                            for (var ii = 0, nn = events.length; ii < nn; ii++) {
                                var ev = events[ii];
                                    time = ev.time;
                                if (time >= interval[0] && time < interval[1]) {
                                    if (col === COL_breakTime && ev.status !== STATUS_break) {
                                        continue;
                                    }
                                    if (col === COL_lunchTime && ev.status !== STATUS_lunch) {
                                        continue;
                                    }
                                    row = [name, time, statusMap[ev.status]];
                                    callsTbl.push(row);
                                }
                            }
                        }
                    }
                }

                callsTbl.sort(function (a, b) {
                    return a[1] - b[1];
                });

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


            var html = '<overlay><modal class="results"><table cellpadding="0" cellspacing="0"><thead><tr class="head">' + theadHtml + '</tr></thead><tbody>' + tbodyHtml + '<tr class="foot"><td class="button" colspan="4"><input type="button" style="float:left" id="modal-close" class="universal" value="Close window">';
            if (callsTbl.length) {
                html += '<input type="button" id="modal-csv" class="universal secondary" value="Export as .csv">';
            }
            html += '</td></tr></tbody></table></modal></overlay>';
            document.body.insertAdjacentHTML('beforeend', html);

            overlay = document.querySelector('overlay');
            modal = document.querySelector('modal');
            theadTh = modal.children[0].children[0].children[0].children;
            footTd = modal.querySelector('.foot').children;

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

            if (!isIE && !isFF) {
                modal.addEventListener('scroll', scroll);
                window.addEventListener('resize', scroll);
            }


            function scroll() {
                var scroll = modal.scrollTop;
                for (var i = 0; i < theadTh.length; i++) {
                    theadTh[i].style.top = scroll + 'px';
                }

                var diff = modal.scrollHeight - modal.clientHeight - scroll;
                for (i = 0; i < footTd.length; i++) {
                    if (diff > 2) {
                        footTd[i].style.top = -diff + 'px';
                    }
                    else {
                        footTd[i].style.top = '';
                    }
                }
            }

            setTimeout(function () {
                overlay.className = 'active';
                if (!isIE && !isFF) {
                    scroll();
                }
            });
        }


        function Server() {
            var that = this,
                encodedUsername = encodeURIComponent(CONFIG.username),
                encodedPassword = encodeURIComponent(CONFIG.password),
                xhr,
                preloader,
                lastToday,
                requestStart,
                requestEnd,
                stopPolling = false,
                timeoutHandle,
                isFirstRequest,
                errorsShown = 0,
                startNewPollingOnEveryRequest = false;


            this.getRangeFromOptions = function () {
                var start,
                    end;

                function setStart() {
                    var startDay = options.startday;
                    if (startDay === 1) {
                        if (options.start_year) {
                            start = moment({
                                year: options.start_year,
                                month: options.start_month - 1,
                                day: options.start_day
                            });
                        }
                        else {
                            start = options.startdate;
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
                    if (endDay === 1) {
                        if (options.end_year) {
                            end = moment({
                                year: options.end_year,
                                month: options.end_month - 1,
                                day: options.end_day
                            });
                        }
                        else {
                            end = options.enddate;
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
                END++;                        // because in all calculations we use "end is not included" approach, e.g: start <= ... < end

                if (START * 1000 > Date.now()) {
                    alert('The start time cannot be in the future.');
                    // todo, this case should be made more friendly
                    stopPolling = true;
                    hidePreloader();
                    throw 'start > now';
                }

                if (CHART) {
                    CHART.savedZoom = null;
                }
            };


            function getRangeFromDropdown() {
                startNewPollingOnEveryRequest = false;

                switch (byId(options.time).value) {
                    case '0_hour':
                        startNewPollingOnEveryRequest = true;
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
                END = END.unix() + 1;   // because in all calculations we use "end is not included" approach, e.g: start <= ... < end
            }


            this.tryNewRequest = function (success, error) {
                clearTimeout(timeoutHandle);  // stop polling isn't harmful?

                if (!EMBEDDED) {
                    var polling = function() {
                        timeoutHandle = setTimeout(function () {
                            that.tryNewRequest();
                        }, CONFIG.refresh);
                    }
                }

                if (!xhr && !stopPolling && !document.hidden && requestEnd >= requestStart/* && requestStart < Date.now() / 1000*/) {
                    var request =
                        '?_username=' + encodedUsername +
                        ';_password=' + encodedPassword +
                        ';start=' + requestStart +
                        ';end=' + requestEnd + (isFirstRequest ? ';first=1' : '') +
                        ';recursive=' + options.recursive +
                        ';id=' + (options.id || 0) +
                        ';refresh=' + CONFIG.refresh +
                        ';queueevents=' + (isQstatistics ? 1 : 0);

                    xhr = UTILS.get(request,
                        function (r) {
                            xhr = null;
                            hidePreloader();
                            if (response(r)) {
                                success && success();
                                polling && polling();
                            }
                        }, function () {    // on error, poll again
                            xhr = null;
                            hidePreloader();
                            error && error();
                            polling && polling();
                        });
                }
                else {
                    hidePreloader();
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


            this.startNewPolling = function () {
                lastToday = moment().startOf('day');

                if (EMBEDDED && options.time) {
                    getRangeFromDropdown();
                } else {
                    this.getRangeFromOptions();
                }

                errorsShown = false;
                stopPolling = false;
                isFirstRequest = true;
                this.addToBeginning = false;

                var now = Date.now() / 1000;

                // if all required data is in the cache, don't query server
                if (START >= minRecordedTime && END <= maxRecordedTime) {
                    createReport();
                    stopPolling = true;
                    return;
                }
                // query only what is missing (but only from the beginning)
                else if (START < minRecordedTime && END >= minRecordedTime && (END <= maxRecordedTime || (now - maxRecordedTime < 3 * CONFIG.refresh) && now <= END)) {
                    requestStart = START;
                    requestEnd = minRecordedTime + 1;
                    this.addToBeginning = true;
                }
                // query only what is missing (but only from the end)
                else if (START <= maxRecordedTime && START >= minRecordedTime && END > maxRecordedTime) {
                    requestStart = maxRecordedTime;
                    requestEnd = END;
                }
                // if missing data is on both sides, just query everything
                else {
                    requestStart = START;
                    requestEnd = END;
                    clearAllCalls();
                }

                if (!preloader) {
                    showPreloader();
                }

                this.stopRequest();
                this.tryNewRequest();
            };


            function response(response) {
                var json = JSON.parse(response);

                // break polling loop on error
                if (json.errors) {
                    if (!errorsShown) {
                        errorsShown = '';
                        for (var j in json.errors) {
                            errorsShown += '\n' + json.errors[j].message + '\n';
                        }
                        alert(errorsShown);
                    }
                }
                else {
                    var updateEnd = +json.updated,          // if updated does not go beyond END, polling will never stop
                        anythingChanged = addRecordsToDatabase(json);

                    if (updateEnd > now_END) {
                        now_END = updateEnd;
                    }

                    if (!isQstatistics) {
                        updatesHaveNoEvents = true;
                    }

                    minRecordedTime = Math.min(minRecordedTime, requestStart);
                    maxRecordedTime = Math.max(maxRecordedTime, Math.min(requestEnd, updateEnd));

                    if (startNewPollingOnEveryRequest) {
                        getRangeFromDropdown();
                    }

                    // unlikely all other places where we work with time periods!
                    requestStart = maxRecordedTime;
                    requestEnd = END;

                    if (isFirstRequest || anythingChanged) {
                        createReport(isFirstRequest);
                    }

                    if (isFirstRequest) {
                        setTimeout(function () {
                            console.log('DONE');
                        }, 80);
                    }
                    isFirstRequest = false;
                    toggleButtons();

                    SERVER.addToBeginning = false;
                }

                // Handle the change of day at midnight. If the start or end day is not a specific date then the report
                // period should change every day.
                if ((EMBEDDED || options.startday !== 1 || options.endday !== 1) && moment().startOf('day').unix() !== lastToday.unix()) {
                    that.startNewPolling();
                    return false;
                }
                else if (END <= maxRecordedTime) {
                    stopPolling = true;
                }

                return true;
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


            function hidePreloader() {
                if (preloader) {
                    container.removeChild(preloader);
                    preloader = false;
                }
            }


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
                    var newI = colOrig[i];
                    str += '<th style="position: relative" id="' + newI + 'col" draggable="true" ondragover="return false"' + getSorting(newI) + '>' + columnTitles[newI] + '</th>';
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

                this.onScroll = function () {
                    if (theadChildren) {
                        if (bannerHeight < 40) {
                            bannerHeight = banner.clientHeight;
                        }
                        if (bannerHeight) {
                            var scroll = window.pageYOffset - 56 - bannerHeight;

                            if (scroll > 0) {
                                panelOpenBtn.style.top = scroll + 'px';
                                rightMenu.style.top = scroll + 40 + 'px';
                                if (options.type === 'table') {
                                    for (var i = 0, n = theadChildren.length; i < n; i++) {
                                        theadChildren[i].style.top = scroll + 'px';
                                    }
                                }
                            }
                            else {
                                panelOpenBtn.style.top = '';
                                rightMenu.style.top = '40px';
                                if (options.type === 'table') {
                                    for (i = 0, n = theadChildren.length; i < n; i++) {
                                        theadChildren[i].style.top = '';
                                    }
                                }
                            }
                        }
                    }
                };

                window.addEventListener('scroll', this.onScroll);
            }
        }



        function SorTable() {
            var that = this,
                sortCol = 0,
                sortOrder = 1;

            this.render = function (container, data, drawChart) {

                function assignBodyEvents() {
                    var tbody = container.children[1].children[1],
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
                            var row = target.parentNode,
                                bc = tbody.children;
                            for (var i = 0, n = bc.length; i < n; i++) {
                                if (row === bc[i]) {
                                    var rc = row.children;
                                    for (var j = 0, m = rc.length; j < m; j++) {
                                        if (target === rc[j]) {
                                            break;
                                        }
                                    }
                                    break;
                                }
                            }

                            if (j !== m) {
                                Popup(data[i], j, true, true); // todo ststus as index
                            }
                        }
                    });
                }


                if (options.totalrow) {
                    var totalRow = data.pop();
                }
                data.sort(function (a, b) {
                    if (a[sortingCol] < b[sortingCol]) {
                        return -sortOrder;
                    }
                    if (a[sortingCol] > b[sortingCol]) {
                        return sortOrder;
                    }
                    return 0;
                });
                if (options.totalrow) {
                    data.push(totalRow);
                }


                var columns = (CONFIG.extraevents === 1) ? ['Name', 'Available', 'Break', 'Lunch', 'Unavailable'] : ['Name', 'Available', 'Unavailable'],
                    cl = columns.length,
                    str = '<timeline></timeline><table cellpadding="0" cellspacing="0" style="cursor: pointer"><thead><tr class="head"><th>' + columns.join('</th><th>') + '</th></tr></thead><tbody>';

                for (var i = 0, n = data.length; i < n; i++) {
                    var row = data[i];
                    str += '<tr><td>' + row[0] + '</td>';
                    for (var j = 1; j < cl; j++) {
                        str += '<td>' + UTILS.timeFormat(row[j], 4) + '</td>';
                    }
                    str += '</tr>';
                }
                str += '</tbody></table>';

                container.innerHTML = str;

                var headerChildren = container.getElementsByClassName('head')[0].children;
                headerChildren[Math.abs(sortCol)].className = (sortOrder > 0) ? 'asc' : 'desc';

                google.charts.setOnLoadCallback(drawChart);

                assignBodyEvents();

                for (i = 0, n = headerChildren.length; i < n; i++) {
                    headerChildren[i].onclick = (function (i) {
                        return function () {
                            if (i === Math.abs(sortCol)) {
                                sortOrder = -sortOrder;
                            }
                            else {
                                sortCol = i;
                                sortOrder = 1;
                            }

                            that.render(container, data, drawChart);
                        }
                    })(i);
                }
            }
        }


        function Tabs() {
            var types = ['table', 'linechart', 'barchart', 'stacked', 'piechart', 'reasons'],
                oldType = options.type,
                upToDate = [],
                zIndex = 1,
                oldSlideIndex = types.indexOf(oldType),
                str = '';

            for (var i in types) {
                str += '<slide style="z-index: ' + (+i === oldSlideIndex ? 1 : 0) + '"></slide>';
            }

            container.innerHTML = str +
                '<div id="piechart-chooser"></div><button id="zoom-out" onclick="vs.chart.resetZoom()" class="universal">Reset chart</button>' +
                '<div id="zooming-overlay" ondragstart="return false"></div><div id="left-overlay">&#10096;</div><div id="right-overlay">&#10097;</div>';
            byId('main-content').insertAdjacentHTML('afterend', '<section id="right-menu"><button id="go-table" onclick="vs.tabs.goTo(\'table\')" disabled></button><button id="go-linechart" onclick="vs.tabs.goTo(\'linechart\')" disabled></button><button id="go-barchart" onclick="vs.tabs.goTo(\'barchart\')" disabled></button><button id="go-stacked" onclick="vs.tabs.goTo(\'stacked\')" disabled></button><button id="go-piechart" onclick="vs.tabs.goTo(\'piechart\')" disabled><button id="go-reasons" onclick="vs.tabs.goTo(\'reasons\')" disabled></button><button id="go-csv" onclick="vs.report.downloadCSV()" disabled></button><button id="go-png" onclick="vs.chart.downloadPNG()" disabled></button></section>');
            // todo put this in thml

            var children = container.children,
                goPng = byId('go-png'),
                pieSourceChooser = byId('piechart-chooser');

            this.tabs = {};


            this.goTo = function (nextType) {
                var oldSlide = children[oldSlideIndex],
                    nextSlideIndex = types.indexOf(nextType),
                    nextSlide = children[nextSlideIndex];

                if (nextSlideIndex !== oldSlideIndex) {
                    oldSlide.style.opacity = 0;
                    nextSlide.style.zIndex = ++zIndex;
                    nextSlide.style.opacity = 1;
                    byId('go-' + oldType).className = '';
                    FORM.enableSaveButton();
                }
                byId('go-' + nextType).className = 'active';

                options.type = nextType;
                this.tabs[nextType] = nextSlide;

                isQstatistics = getQstatistics();
                if (updatesHaveNoEvents && nextType === 'reasons') {
                    clearAllCalls();
                    SERVER.startNewPolling();
                    return;
                }

                // if chart has bee zoomed and we are moving to other tab, then cancel zoom and recreate report
                if (oldSlideIndex !== nextSlideIndex && CHART.zoomHasChanged()) {
                    oldSlideIndex = nextSlideIndex;
                    oldType = nextType;
                    CHART.resetZoom();
                    return;  // TODO TRICKY  //  CHART.resetZoom() will call goTo in the end
                }

                if (!upToDate[nextSlideIndex]) {
                    if (nextType === 'table') {
                        TABLE.render(nextSlide, true);
                    }
                    else if (nextType === 'reasons') {
                        REASONS.render(nextSlide);
                    }
                    else {
                        CHART.render(nextSlide, nextType);
                    }
                }
                upToDate[nextSlideIndex] = true;

                goPng.disabled = (nextType === 'table' || nextType === 'reasons');
                pieSourceChooser.style.display = nextType === 'piechart' ? '' : 'none';
                toggleLROverlay(nextType);

                oldSlideIndex = nextSlideIndex;
                oldType = nextType;

                equalHeight();
                TABLE.onScroll();
            };


            this.update = function () {
                upToDate = [];
                this.goTo(options.type);
            };
        }


        var SERVER = this.server = new Server();

        if (!EMBEDDED) {
            var TABS = new Tabs(),
                REASONS = new Reasons(),
                SORTABLE = new SorTable(),
                TABLE = new Table(),
                FORM = new Form(formEl);

            htmlConstructor();
        }


        for (var i = 1; i < colsCount; i++) {
            reorder[i] = i;
        }

        getVisibleColumnsAndRows();


        if (EMBEDDED) {
            container = container.children[1] || container;
            if (options.type === 'table') {
                var TABLE = new Table();
                container.classList.add('results');
            }
            else if (options.type === 'reasons') {
                var REASONS = new Reasons(),
                    SORTABLE = new SorTable();
            }
            else {
                var CHART = new Chart();
            }
            // todo do I recalculate everything if sorting of first column changes?

            if (options.time) {
                byId(options.time).addEventListener('change', function () {
                    SERVER.startNewPolling();
                });
            }
            if (options.queuesSelect) {
                // initially override queue filter
                options.queues = 'use_include';

                // listen for changes
                byId(options.queuesSelect).addEventListener('change', function () {
                    options.queues = 'use_include';
                    delete memorizedIncludeIds[options.queuesSelect];
                    createReport();
                });
            }

            SERVER.startNewPolling();
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


        this.unique = function (unordered) {
            var object = {};
            for (var i = 0, n = unordered.length; i < n; i++) {
                object[unordered[i]] = null;
            }
            return Object.keys(object);
        };


        this.uniqueObj = function (arr) {
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
            if (length === 4) {
                return [Math.floor(period / DAY), Math.floor((period % DAY) / 3600), Math.floor((period % 3600) / 60), Math.floor(period % 60)];
            }
            else {
                return [Math.floor((period % DAY) / 3600), Math.floor((period % 3600) / 60), Math.floor(period % 60)];
            }
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
                    var val = el.value;
                    if (!isNaN(val)) {
                        val = +val;
                    }
                    result[el.name] = val;
                }
            }

            if (CONFIG) {
                if (CONFIG.extraevents === 0) {
                    result.breaktime = 0;
                    result.lunchtime = 0;
                }
                else {
                    if (result.breaktime === undefined) {
                        result.breaktime = 0;
                    }
                    if (result.lunchtime === undefined) {
                        result.lunchtime = 0;
                    }
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
        CONFIG.timeformat = 24;
    }
    moment.tz.setDefault(CONFIG.timezone);
    var TIMEZONE_DIFF = (new Date()).getTimezoneOffset() + moment().utcOffset();      // same timezone

    var reportServers = [];

    if (EMBEDDED) {
        for (var i = 0; i < EMBEDDED.length; i++) {
            var em = EMBEDDED[i];
            em.report.time = em.time;
            em.report.include = em.include;
            em.report.queuesSelect = em.queues;

            var opts = em.report;
            for (var j in opts) {
                if (!isNaN(opts[j])) {
                    opts[j] = +opts[j];
                }
            }

            var report = new Report(opts, byId(em.container));
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
                    timeoutHandle = setTimeout(poll, CONFIG.refresh);
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
            var timeoutHandle = setTimeout(poll, CONFIG.refresh);
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
                timeoutHandle = setTimeout(poll, CONFIG.refresh);
            }
        });

        //window.addEventListener('beforeunload', poll);
    }
}