function CSChart (container) {
    var that = this,
        resizeDebounce,
        table,
        dataTable,
        pieDataTable,
        charts = {},
        lastChart,
        overlay = byId('zooming-overlay'),
        resetZoom = byId('reset-zoom'),
        svg_g, rectCon, rectSVG,
        options = {
            line: {},
            bar: {
                orientation: 'horizontal'
            },
            barstacked: {
                isStacked: true,
                orientation: 'horizontal'
            },
            pie: {
                is3D: true
            }
        },
        pieFilterSaved = byId('piesource');

    if (pieFilterSaved) {
        pieFilterSaved = pieFilterSaved.value.split('_');
        this.pieFilter = {
            by: pieFilterSaved[0],
            id: pieFilterSaved[1]
        };
    }
    else {
        this.pieFilter = {
            by: 'column',
            id: '0'
        };
    }


    this.pieSourceChooser = function () {
        var str = 'Display:<label> column <select id="pie-by-column"><option>Choose column</option>';
        for (var i in COLUMNS) {
            if (csBase.colSum) {
                str += '<option value="' + i + '">' + COLUMNS[i] + '</option>';
            }
        }
        str += '</select></label><label>, or row <select id="pie-by-row"><option>Choose row</option>';
        for (i in table) {
            if (table[i].total) {
                str += '<option value="' + i + '">' + table[i][0] + '</option>';
            }
        }
        str += '</select></label>';
        byId('pie-chooser').innerHTML = str;

        var byCol = byId('pie-by-column'),
            byRow = byId('pie-by-row');

        byCol.onchange = function () {
            that.pieFilter = {
                by: 'column',
                id: this.value
            };
            if (that.pieFilter.id) {
                pieDataTable = getPieDataTable();
                charts.pie.draw(pieDataTable, options[csUI.type]);
                byRow.selectedIndex = 0;
            }
        };
        byRow.onchange = function () {
            that.pieFilter = {
                by: 'row',
                id: this.value
            };
            if (that.pieFilter.id) {
                pieDataTable = getPieDataTable();
                charts.pie.draw(pieDataTable, options[csUI.type]);
                byCol.selectedIndex = 0;
            }
        };
        byCol.selectedIndex = 1;
    };


    function getPieDataTable () {
        table = table || csBase.getTable();
        var id = +that.pieFilter.id,
            data = [];

        if (that.pieFilter.by === 'column') {
            data.push([PERIOD ? 'Time' : 'Destination', COLUMNS[id]]);
            for (var i in table) {
                data.push([table[i][0], table[i][id + 1]]);
            }
        }
        else {
            var tableHeading = getTableHeading();
            for (i in tableHeading) {
                data.push([tableHeading[i], table[id][i]]);
            }
        }

        return google.visualization.arrayToDataTable(data);
    }


    function getDataTable () {
        table = table || csBase.getTable();
        var data = [getTableHeading()].concat(table);
        return google.visualization.arrayToDataTable(data);
    }


    function mousemove (evt) {
        endX = evt.pageX;
        if (endX >= startX) {
           endX += 15;
        }
        overlay.style.top = rectSVG.top + 'px';
        overlay.style.bottom = window.innerHeight - rectSVG.bottom + 'px';
        overlay.style.left = Math.min(startX, endX) - window.scrollX + 'px';
        overlay.style.right = window.innerWidth + window.scrollX - Math.max(startX, endX) + 'px';
    }

    function mousedown (evt) {
        if (!svg_g.contains(evt.target)) {
            skip = true;
            return;
        }
        var tagName = evt.target.tagName.toUpperCase();
        if (tagName === 'TEXT') {
            skip = true;
            return;
        }
        rectCon = container.getBoundingClientRect();
        rectSVG = svg_g.getBoundingClientRect();
        startX = evt.pageX + 1;
        overlay.style.top = rectSVG.top + 'px';
        overlay.style.bottom = window.innerHeight - rectSVG.bottom + 'px';
        overlay.style.left = startX - window.scrollX + 'px';
        overlay.style.right = window.innerWidth + window.scrollX - startX + 'px';
        overlay.style.display = 'block';
        container.onmousemove = mousemove;
    }

    function mouseup () {
        if (skip) {
            skip = false;
            return;
        }
        overlay.style.display = 'none';
        var max = Math.max(startX, endX),
            min = Math.min(startX, endX);

        START += (END - START) * (min - window.scrollX - rectSVG.left) / rectSVG.width * 0.7;
        END -= (END - START) * (rectSVG.right + window.scrollX - max) / rectSVG.width * 1.6;

        resetZoom.style.display = 'block';
        csBase.filter();
        csOptions.setTime();

        container.onmousemove = null;
    }

    var startX,
        endX,
        skip;


    this.assignZoom = function () {
        container.addEventListener('mousedown', mousedown, true);
        container.addEventListener('mouseup', mouseup, true);
    };


    this.unAsignZoom = function () {
        overlay.style.display = 'none';
        container.onmousemove = null;
        container.removeEventListener('mousedown', mousedown, true);
        container.removeEventListener('mouseup', mouseup, true);
    };
    

    this.render = function (type, slide) {
        if (!window.google || !google.visualization) {
            setTimeout(function () {
                that.render();
            }, 200);
        }
        else {
            google.charts.setOnLoadCallback(function () {
                if (!charts[type]) {
                    switch (type) {
                        case 'line':
                            charts[type] = new google.visualization.LineChart(slide);
                            break;
                        case 'bar':
                            charts[type] = new google.visualization.BarChart(slide);
                            break;
                        case 'barstacked':
                            charts[type] = new google.visualization.BarChart(slide);
                            break;
                        case 'pie':
                            charts[type] = new google.visualization.PieChart(slide);
                            break;
                    }
                }

                if (type !== 'pie') {
                    dataTable = dataTable || getDataTable();
                    charts[type].draw(dataTable, options[type]);
                }
                else if (that.pieFilter.id) {
                    pieDataTable = pieDataTable || getPieDataTable();
                    charts[type].draw(pieDataTable, options[type]);
                    that.pieSourceChooser();
                }

                if (PERIOD && type !== 'pie') {
                    svg_g = slide.getElementsByTagName('svg')[0].children[3];
                    svg_g.style.cursor = 'col-resize';
                }
                lastChart = charts[type];
            });
        }
    };


    this.invalidate = function () {
        table = dataTable = pieDataTable = undefined;
    };


    this.resize = function () {
        clearTimeout(resizeDebounce);

        resizeDebounce = setTimeout(function () {
            var type = csUI.type;
            if (charts[type]) {
                charts[type].draw(type === 'pie' ? pieDataTable : dataTable, options[type]);
            }
        }, 100);
    };


    this.downloadPNG = function () {
        if (lastChart) {
            var fileName = (csOptions.get('name') || 'noname') + '.png';
            downloadUrl(lastChart.getImageURI(), fileName);
        }
    };


    this.resetZoom = function () {
        byId('zooming-overlay').style.display = 'none';
        START = qsPolling.originalZoom.start;
        END = qsPolling.originalZoom.end;
        resetZoom.style.display = 'none';
        csBase.filter();
    }

}

var START,
    END,
    PERIOD,
    DAY = 86400,
    
    REARRANGE = [
        0,1,2,3,4,5,6,7,8,9,10,11
    ],

    SLIDES = ['table', 'line', 'bar', 'barstacked', 'pie'],

    DESTINATIONS = [
        'All calls',
        'External callers',
        'Internal callers',
        'External destinations'
    ],
    
    COLUMNS = [
        'Total calls',
        'Answered',
        'Not answered',
        'Inbound calls',
        'Inbound answered',
        'Inbound not answered',
        'Internal calls',
        'Internal answered',
        'Internal not answered',
        'Outbound calls',
        'Outbound answered',
        'Outbound not answered'
    ],
    
    timeControls = [
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
    
    columnControls = [
        'totalcalls',
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
        'outnoanswer'
    ],

    destControls = [
        'allcalls',
        'inbound',
        'internal',
        'outbound'
    ],

    queueControls = [
        'queues',
        'agents',
        'phones'
    ],
    
    filterByList = [
        'queuesinclude',
        'agentsinclude',
        'phonesinclude'
    ];

    daysOfWeek = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday'
    ];


function CSBase (visibleCols, visibleRows) {
    var that = this,
        calls,
        queues,
        agents,
        phones,
        rowPos,
        total,
        table;


    function byEnd (a, b) {
        if (a.end > b.end) {
            return 1;
        }
        else if (a.end < b.end) {
            return -1;
        }
        else {
            return 0;
        }
    }


    function byCol (col, order) {
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

    
    this.sort = function () {
        if (csTable.sortingCol > 0) {
            table.sort(byCol(this.colPos.indexOf(csTable.sortingCol - 1) + 1, csTable.sortingOrder));
        }
        else if (csTable.sortingOrder === -1) {
            table.reverse();
        }
    };


    this.setVisibleCols = function (pos, value) {
        visibleCols[pos] = value;
        this.calculateColPos();
        this.filter();
    };


    this.setVisibleRows = function (pos, value) {
        visibleRows[pos] = value;
        calculateRowPos();
        this.filter();
    };


    this.calculateColPos = function () {
        this.colPos = [];
        for (var i = 0, n = COLUMNS.length; i < n; i++) {
            var j = REARRANGE[i];
            if (visibleCols[j]) {
                this.colPos.push(j);
            }
        }
    };


    function calculateRowPos () {
        rowPos = [];
        var row = 0;
        for (var i in visibleRows) {
            if (visibleRows[i]) {
                rowPos[i] = row++;
            }
        }
    }


    function reduceRow (row) {
        var result = [row[0]];
        for (var i in that.colPos) {
            result.push(row[that.colPos[i] + 1]);
        }

        result.total = row.total;
        total += row.total;

        return result;
    }


    this.percTable = function (csv) {
        var showTotal = PERIOD && +csOptions.get('totalrow'),
            response = new Array(table.length),
            totalRow = ['Total'],
            i, j, perc;

        for (i in table) {
            if (csv) {
                response[i] = [table[i][0]];
            }
            else {
                response[i] = table[i].slice();
            }
        }

        if (showTotal && !csv) {
            totalRow = totalRow.concat(this.colSum);
        }
        
        for (j in this.colPos) {
            var i1 = this.colPos[j],
                j1 = +j + 1;
            if (visibleCols[i1] === 2) {
                for (i in table) {
                    var row = table[i];
                    perc = row.total ? Math.round(row[j1] * 100 / row.total) : '';
                    if (csv) {
                        response[i].push(row[j1]);
                        response[i].push(perc);
                    }
                    else {
                        response[i][j1] += ' <small>(' + perc + (row.total ? '&#8198;%' : '') + ')</small>';
                    }
                }

                // column Sum
                perc = total ? Math.round(this.colSum[j] * 100 / total) : '';
                if (showTotal) {
                    if (csv) {
                        totalRow.push(this.colSum[j]);
                        totalRow.push(perc);
                    }
                    else {
                        totalRow[j1] += ' <small>(' + perc + (total ? '&#8198;%' : '') + ')</small>';
                    }
                }
            }
            else if (csv) {
                for (i in table) {
                    response[i].push(table[i][j1]);
                }
                if (showTotal) {
                    totalRow.push(this.colSum[j]);
                }
            }
        }

        if (showTotal) {
            response.push(totalRow);
        }
        return response;
    };


    this.getTable = function () {
        return table;
    };


    this.downloadCSV = function () {
        if (!table) {
            return;
        }

        var str = '',
            row = [PERIOD ? 'Time' : 'Destination'];

        for (var i in this.colPos) {
            var newI = this.colPos[i];
            row.push(COLUMNS[newI]);
            if (visibleCols[newI] === 2) {
                row.push(COLUMNS[newI] + ' %');
            }
        }
        str += row.join(',') + '\n';

        var data = csBase.percTable(true);
        for (i in data) {
            str += data[i].join(',') + '\n';
        }

        var fileName = (csOptions.get('name') || 'noname') + '.csv',
            csvBlob = new Blob([str], {type: 'text/csv;charset=utf-8;'});

        downloadBlob(fileName, csvBlob);
    };




    function newRow () {
        var row = new Array(COLUMNS.length + 1).fill(0);
        row.total = 0;
        return row;
    }


    function addDestinationRow (display, row) {
        if (visibleRows[display]) {
            var pos = rowPos[display];
            table[pos].total++;

            for (var i = 1, n = row.length; i < n; i++) {
                table[pos][i] += row[i];
            }
        }
    }


    function decode (call, row, destination) {
        var stype = call.getAttribute('stype'),
            dtype = call.getAttribute('dtype'),
            snumber = call.getAttribute('snumber'),
            dnumber = call.getAttribute('dnumber'),
            answered = +call.getAttribute('answered'),
            external = 'external',
            local = 'local',
            isInbound,
            isInternal,
            isOutbound;

        // total calls
        row[1]++;
        // answered
        if (answered) {
            row[2]++;
        }
        // not answered
        if (!answered) {
            row[3]++;
        }
        // inbound calls
        isInbound = stype === external || stype === local;
        if (isInbound) {
            row[4]++;
        }
        // inbound answered
        if (isInbound && answered) {
            row[5]++;
        }
        // inbound no answer
        if (isInbound && !answered) {
            row[6]++;
        }
        // internal calls
        isInternal = stype !== external && stype !== local && dtype != external && dtype !== local;
        if (isInternal) {
            row[7]++;
        }
        // internal answered
        if (isInternal && answered) {
            row[8]++;
        }
        // internal no answer
        if (isInternal && !answered) {
            row[9]++;
        }
        // outbound
        isOutbound = dtype === external || dtype === local;
        if (isOutbound) {
            row[10]++;
        }
        // outbound answered
        if (isOutbound && answered) {
            row[11]++;
        }
        // outbound no answer
        if (isOutbound && !answered) {
            row[12]++;
        }

        if (destination) {
            //total
            addDestinationRow(0, row);
            // external callers
            if (stype === external || stype === local) {
                addDestinationRow(1, row);
            }
            // internal callers
            if (stype !== external && stype !== local && dtype != external && dtype !== local) {
                addDestinationRow(2, row);
            }
            // external destinations
            if (dtype === external || dtype === local) {
                addDestinationRow(3, row);
            }
        }
    }


    this.add = function (update, start, end) {
        var _calls = update.getElementsByTagName('call');
        var _queues = update.getElementsByTagName('queue');
        var _agents = update.getElementsByTagName('agent');
        var _phones = update.getElementsByTagName('phone');
        var notEmpty = false;

        this.minTime = Math.min(this.minTime, start);
        this.maxTime = Math.max(this.maxTime, end);
        
        for (var i = 0, n = _calls.length; i < n; i++) {
            var call = _calls[i];
            call.end = call.getAttribute('end');
            calls.push(call);
            notEmpty = true;
        }

        //todo this change detection scheme is wrong
        for (i = 0, n = _queues.length; i < n; i++) {
            var queue = _queues[i];
            if (!queues[queue.id]) {
                queues[queue.id] = queue;
                notEmpty = true;
            }
        }

        for (i = 0, n = _agents.length; i < n; i++) {
            var agent = _agents[i];
            if (!agents[agent.id]) {
                agents[agent.id] = agent;
                notEmpty = true;
            }
        }

        for (i = 0, n = _phones.length; i < n; i++) {
            var phone = _phones[i],
                name = phone.getAttribute('name');
            if (!phones[name]) {
                phones[name] = phone;
                notEmpty = true;
            }
        }
        return notEmpty;
    };


    this.filterByTime = function (start, end) {
        calls.sort(byEnd);
        var startIndex,
            endIndex,
            callEnd;

        for (var i in calls) {
            callEnd = +calls[i].end;
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

        if (startIndex && endIndex) {
            var slice = calls.slice(+startIndex, +endIndex + 1);
            //if (PERIOD) {
                var arr = ['queues', 'agents', 'phones'];
                for (i = 0; i < arr.length; i++) {
                    if (csOptions.get(arr[i]) !== 'all') {
                        slice = byDestination(slice, arr[i], true);
                    }
                }
            //}
            return slice;
        }
        else {
            return [];
        }
    };


    function reduceTable () {
        var n = that.colPos.length + 1;
        for (var i in table) {
            var row = reduceRow(table[i]);
            table[i] = row;
            for (var j = 1; j < n; j++) {
                that.colSum[j - 1] += row[j];
            }
        }
    }
    
    
    function byDestType (filteredCalls) {
        for (var i in DESTINATIONS) {
            if (visibleRows[i]) {
                var row = newRow();
                row[0] = DESTINATIONS[i];
                table.push(row);
            }
        }
        for (var j in filteredCalls) {
            row = newRow();
            decode(filteredCalls[j], row, true);
        }
        reduceTable();
    }


    function byTimePeriods (period) {
        var time = START,
            endTime = START,
            timeObj,
            calls,
            row,
            now = Date.now() / 1000,
            dateFormat = csOptions.config('settings', 'dateformat'),
            timeFormat = csOptions.config('settings', 'timeformat');

        if ((END - START) / period > 10000) {
            alert('Too many data to display. Please set smaller period');
            throw 'too many rows to display';
        }

        while (time < END && time < now) {
            endTime += period;
            endTime = Math.min(endTime, END);

            calls = that.filterByTime(time, endTime);
            row = newRow();

            timeObj = new Date(time * 1000);
            if (period < DAY) {
                row[0] = formatDate(timeObj, dateFormat) + ' ' + formatTime(timeObj, timeFormat);
            }
            else {
                row[0] = formatDate(timeObj, dateFormat);
            }

            for (var i in calls) {
                decode(calls[i], row);
            }
            row.total = calls.length;
            table.push(row);

            time = endTime;
        }

        reduceTable();
    }


    function byHours (period) {
        var now = Date.now() / 1000,
            time = START,
            endTime = START - START % period,
            calls,
            row,
            reportIndex,
            date,
            totalHours = DAY / period,
            timeFormat = csOptions.config('settings', 'timeformat');

        for (var i = 0; i < totalHours; i++) {
            row = newRow();
            date = new Date((i * period + endTime) * 1000);
            row[0] = formatTime(date, timeFormat);
            table[i] = row;
        }

        while (time < END && time < now) {
            endTime += period;
            endTime = Math.min(endTime, END);

            reportIndex = Math.floor( ((time - START) % DAY) / period);
            row = table[reportIndex];
            calls = that.filterByTime(time, endTime);

            for (i in calls) {
                decode(calls[i], row);
            }
            row.total += calls.length;

            time = endTime;
        }

        reduceTable();
    }


    function byDaysOfWeek () {
        var now = Date.now() / 1000,
            time = START,
            endTime = getBeginningOfDay(START),
            calls,
            row,
            reportIndex,
            dayOfWeek,
            startDayOfWeek = new Date(START * 1000).getDay();

        for (var i = 0; i < 7; i++) {
            row = newRow();
            reportIndex = i + startDayOfWeek;  // start from startDayOfWeek
            if (reportIndex >= 7) {
                reportIndex -= 7;
            }
            row[0] = daysOfWeek[reportIndex];
            table[i] = row;
        }

        while (time < END && time < now) {
            endTime += DAY;
            endTime = Math.min(endTime, END);

            dayOfWeek = new Date(time * 1000).getDay();
            reportIndex = dayOfWeek - startDayOfWeek;  // start from startDayOfWeek
            if (reportIndex < 0) {
                reportIndex += 7;
            }
            row = table[reportIndex];
            calls = that.filterByTime(time, endTime);

            for (i in calls) {
                decode(calls[i], row);
            }
            row.total += calls.length;

            time = endTime;
        }

        reduceTable();
    }


    function byDestination (filteredCalls, subject, doFilter) {
        var ids = [],
            arr,
            settings = csOptions.get(subject),
            i, j, n;

        if (doFilter) {
            var result = [];
        }

        switch (subject) {
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

        if (settings === 'use_include') {
            var options = byId(subject + 'include_selected').options;
            for (i = 0, n = options.length; i < n; i++) {
                ids.push(options[i].value);
            }
        }
        else {
            for (i in arr) {
                if (settings !== 'use_control_panel' || arr[i].getAttribute('panel') === '1') {
                    ids.push(i);
                }
            }
        }

        for (j in ids) {
            var call,
                el = arr[ids[j]],
                name = el.getAttribute('name'),
                match,
                totalsCount = 0;

            if (!doFilter) {
                var row = newRow();

                switch (subject) {
                    case 'queues':
                        row[0] = 'Queue: ' + name;
                        break;
                    case 'agents':
                        row[0] = 'Queue agent: ' + name;
                        break;
                    case 'phones':
                        row[0] = 'Ext: ' + name;
                        break;
                }
            }

            for (i in filteredCalls) {
                call = filteredCalls[i];

                switch (subject) {
                    case 'queues':
                        match = call.getAttribute('dtype') === 'queue' && call.getAttribute('dnumber') === ids[j];
                        break;

                    case 'agents':
                        match = call.getAttribute('stype') === 'queue' && call.getAttribute('dnumber') === el.getAttribute('dnumber') && call.getAttribute('dtype') === el.getAttribute('dtype');
                        break;

                    case 'phones':
                        match = (call.getAttribute('stype') === 'phone' && call.getAttribute('snumber') === name) || (call.getAttribute('dtype') === 'phone' && call.getAttribute('dnumber') === name);
                        break;
                }

                if (match) {
                    if (doFilter) {
                        if (result.indexOf(call) === -1) {
                            result.push(call);
                        }
                    }
                    else {
                        decode(call, row);
                        totalsCount++;
                    }
                }
            }

            if (!doFilter) {
                row.total = totalsCount;
                table.push(reduceRow(row));
            }
        }
        if (doFilter) {
            return result;
        }
    }


    this.filter = function () {
        table = [];
        this.colSum = new Array(that.colPos.length).fill(0);
        total = 0;

        if (PERIOD === 0) {
            var filteredCalls = that.filterByTime(START, END);
            byDestType(filteredCalls);

            byDestination(filteredCalls, 'queues');
            byDestination(filteredCalls, 'agents');
            byDestination(filteredCalls, 'phones');
        }
        else if (PERIOD > 0) {
            byTimePeriods(PERIOD)
        }
        else {
            if (PERIOD > -604800) {
                byHours(-PERIOD);
            }
            else {
                byDaysOfWeek()
            }
        }

        this.sort();
        csUI.update();
    };


    // constructor
    this.calculateColPos();
    calculateRowPos();

    calls = [];
    queues = {};
    agents = {};
    phones = {};
    this.minTime = Infinity;
    this.maxTime = 0;
}

function CSOptions () {
    var savedScrollX,
        savedScrollY;

    window.addEventListener('scroll', function () {
        savedScrollX = window.scrollX;
        savedScrollY = window.scrollY;
    });


    function preventScroll () {
        window.scrollTo(savedScrollX, savedScrollY);
    }


    function setWatchers() {
        var i;

        for (i in timeControls) {
            byId(timeControls[i]).addEventListener('change', function () {
                qsPolling.update();
                preventScroll();
            });
        }
        for (i in columnControls) {
            byId(columnControls[i]).addEventListener('change', function () {
                var pos = columnControls.indexOf(this.id);
                csBase.setVisibleCols(pos, +this.value);
                preventScroll();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                csBase.setVisibleRows(pos, +this.value);
                preventScroll();
            });
        }
        for (i in queueControls) {
            byId(queueControls[i]).addEventListener('change', function () {
                csBase.filter();
                preventScroll();
            });
        }
        for (i in filterByList) {
            byId(filterByList[i]).addEventListener('change', function () {
                csBase.filter();
                preventScroll();
            });
        }

        byId('period').addEventListener('change', function () {
            PERIOD = +this.value;
            csTable.createHeader();
            csBase.filter();
            preventScroll();
        });

        byId('totalrow').addEventListener('change', function () {
            csUI.update();
            preventScroll();
        });

        reportForm.find('input[type="button"]').on('click', function () {
            csBase.filter();
            preventScroll();
        });
    }


    this.getColumns = function () {
        var result = [];
        for (var i in columnControls) {
            result[i] = +byId(columnControls[i]).value;
        }
        return result;
    };


    this.getRows = function () {
        var result = [];
        for (var i in destControls) {
            result[i] = +byId(destControls[i]).value;
        }
        return result;
    };

    
    this.config = function (form, field) {
        if (document[form][field]) {
            return document[form][field].value;
        }
    };


    this.get = function (id) {
        return byId(id).value;
    };
    this.getNumber = function (id) {
        return +byId(id).value;
    };


    PERIOD = +byId('period').value;

    var reportForm = $('form').last(),
//        settingsForm = document.getElementsByName('settings')[0],
        inputs = reportForm.find('select, input'),
        dirty = false;

    setWatchers();

    inputs.on('change', function () {
        dirty = true;
    });

    var appended;

    reportForm.on('submit', function () {

        function markAllOptions (mark) {
            var arr = ['queues', 'agents', 'phones'];
            for (var i = 0; i < arr.length; i++) {
                if (csOptions.get(arr[i]) === 'use_include') {
                    var options = byId(arr[i] + 'include_selected').options;
                    for (var j = options.length - 1; j >= 0; j--) {
                        options[j].selected = mark;
                    }
                }
            }
        }


        if (!csOptions.get('name')) {
            window.scrollTo(0, 0);
            byId('name').focus();
            alert('Please enter the report name.');
            return false;
        }

        dirty = false;

        markAllOptions(true);
        setTimeout(function () {
            markAllOptions(false);
        }, 100);

        if (appended) {
            for (var i = 0; i < 4; i++) {
                reportForm.find('input').last().remove();
            }
        }
        appended = true;

        reportForm.append('<input type="hidden" name="startdate" value="' + START + '"/>' +
                    '<input type="hidden" name="enddate" value="' + END + '"/>' +
                    '<input type="hidden" name="starttime" value="' + (START - getBeginningOfDay(START)) + '"/>' +
                    '<input type="hidden" name="endtime" value="' + (END - getBeginningOfDay(END)) + '"/>');

        document.getElementsByName('piesource')[0].value = csChart.pieFilter.by + '_' + csChart.pieFilter.id;
        document.getElementsByName('type')[0].value = csUI.type;

        $.post(reportForm.attr('action'), reportForm.serialize(), function (response) {
            document.getElementsByName('id').value = response.getElementsByTagName('return')[0].id;
        });
        return false;
    });


    this.setTime = function () {
        byId('startday').value = 1;
        byId('endday').value = 1;
        var start = new Date(START * 1000),
            end = new Date(END * 1000),
            y1,m1,d1,y2,m2,d2;
        byId('startdate').style.display = '';
        byId('enddate').style.display = '';
        byId('start_year').value = y1 = 1900 + start.getYear();
        byId('end_year').value = y2 = 1900 + end.getYear();
        byId('start_month').value = m1 = start.getMonth() + 1;
        byId('end_month').value = m2 = end.getMonth() + 1;
        byId('start_day').value = d1 = start.getDate();
        byId('end_day').value = d2 = end.getDate();
        byId('start_hour').value = start.getHours();
        byId('end_hour').value = end.getHours();
        byId('start_minute').value = start.getMinutes();
        byId('end_minute').value = end.getMinutes();
        byId('start_second').value = start.getSeconds();
        byId('end_second').value = end.getSeconds();
        byId('start_buffer').value = y1 + '-' + m1 + '-' + d1;
        byId('end_buffer').value = y2 + '-' + m2 + '-' + d2;
    };


    window.onbeforeunload = function () {
        if (dirty) {
            return "You have not saved your report options. If you navigate away, your changes will be lost";
        }
    };
}
function CSPolling (onResponse) {
    var that = this,
        username = csOptions.config('settings', 'username'),
        password = csOptions.config('settings', 'password'),
        xhr,
        preloaderShown,
        today,
        lastToday,
        requestStart,
        requestEnd,
        firstPoll,
        timeoutHandle,
        pollDelay = csOptions.getNumber('refresh');


    function ajaxGet (uri, success, failure) {
        xhr = new XMLHttpRequest();
        xhr.open('GET', '/local/qstatistics/update/' + uri);
        xhr.onload = function() {
            if (xhr.status === 200) {
                success(xhr.responseXML);
            }
            else {
                failure();
            }
        };
        xhr.onerror = failure;
        xhr.send();
    }


    function calcTimeFrame () {
        today = lastToday = getToday();

        var startday = csOptions.getNumber('startday');
        if (startday === 1) {
            START = new Date(csOptions.getNumber('start_year'), csOptions.getNumber('start_month') - 1, csOptions.getNumber('start_day')).getTime() / 1000;
        }
        else {
            START = today + startday * DAY;
        }
        START += csOptions.getNumber('start_hour') * 3600 + csOptions.getNumber('start_minute') * 60 + csOptions.getNumber('start_second');

        var endday = csOptions.getNumber('endday');
        if (endday == 1) {
            END = new Date(csOptions.getNumber('end_year'), csOptions.getNumber('end_month') - 1, csOptions.getNumber('end_day')).getTime() / 1000;
        }
        else {
            END = today + endday * DAY;
        }
        END += csOptions.getNumber('end_hour') * 3600 + csOptions.getNumber('end_minute') * 60 + csOptions.getNumber('end_second');

        if (START >= END) {
            alert('Start time should be before end time.');
            stopPolling();
            throw 'start >= end';
        }

        else if (START > Date.now() / 1000) {
            alert('Start time should be before current moment.');
            stopPolling();
            throw 'start > now';
        }

        that.originalZoom = {
            start: START,
            end: END
        };
    }


    function requestIfAllowed () {
        if (!document.hidden) {
            var request = '?_username=' + username + ';_password=' + password + ';start=' + requestStart + ';end=' + requestEnd;
            ajaxGet(request, response, function () {    // on error, poll again
                timeoutHandle = setTimeout(requestIfAllowed, pollDelay);
            });
        }
    }


    this.update = function (start, end) {
        byId('reset-zoom').style.display = 'none';
        if (start && end) {
            START = start;
            END = end;
        }
        else {
            calcTimeFrame();
        }

        firstPoll = true;

        if (START >= csBase.minTime && END <= csBase.maxTime) {
            onResponse();
            return;    
        }
        //query what is missing
        else if (START < csBase.minTime && END >= csBase.minTime) {
            onResponse();
            requestStart = START;
            requestEnd = csBase.minTime;
        }
        //query what is missing
        else if (START <= csBase.maxTime && END > csBase.maxTime) {
            onResponse();
            requestStart = csBase.maxTime;
            requestEnd = END;
        }

        else {
            requestStart = START;
            requestEnd = END;
        }

        stopPolling();
        if (!preloaderShown && requestEnd - requestStart > DAY / 2) {
            showPreloader();
        }
      
        requestIfAllowed();
    };


    function response(response) {
        var update = response.getElementsByTagName('update')[0];

        // break polling loop on error
        if (!update) {
            var error = response.getElementsByTagName('errors')[0];
            if (error) {
                alert(error.getElementsByTagName('error')[0].getAttribute('message'));
            }
        }
        else {
            var updateEnd = +update.getAttribute('timestamp'),
                updateNotEmpty = csBase.add(update, requestStart, Math.min(requestEnd, updateEnd));

            if (firstPoll || updateNotEmpty) {
                onResponse();
            }

            firstPoll = false;
            hidePreloader();

            // Handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.
            today = getToday();
            if (today !== lastToday) {
                if (byId('startday').value === '0') {
                    START += DAY;
                }
                if (byId('endday').value === '0') {
                    END += DAY;
                }
            }
            lastToday = today;

            if (START >= END) {
                alert('Because start time was set for "Today", it became greater than end time after midnight. Stopping.');
                return;
            }

            if (END <= csBase.maxTime) {
                return;
            }

            requestStart = csBase.maxTime;
            requestEnd = END;

            timeoutHandle = setTimeout(requestIfAllowed, pollDelay);
        }
    }


    function stopPolling () {
        clearTimeout(timeoutHandle);
        if (xhr) {
            xhr.abort();
        }
    }


    function visibilityChange () {
        stopPolling();
        requestIfAllowed();
    }


    function showPreloader () {
        preloaderShown = true;
        var img = document.createElement('IMG');
        img.setAttribute('style',
            'position: fixed;' +
            'z-index: 90000;' +
            'top: 50%;' +
            'left: 50%;' +
            'width: 64px' +
            'height: 64px' +
            'margin-top: -32px' +
            'margin-left: -32px'
        );
        img.src = '/local/bohdan/include/img/ajax.gif';
        img.alt = '';
        img.id = '_preloader';
        document.body.appendChild(img);
    }


    function hidePreloader () {
        if (preloaderShown) {
            var el = byId('_preloader');
            if (el) {
                el.parentNode.removeChild(el);
            }
            preloaderShown = false;
        }
    }


    document.addEventListener('visibilitychange', visibilityChange);
    this.update();
}
function CSTable () {
    var that = this,
        container,
        table,
        theadTr,
        ths,
        tbody;

    this.sortingCol = 0;
    this.sortingOrder = 1;


    this.render = function (slide) {
        var i,
            str = '',
            data = csBase.percTable();

        container = slide;
        if (data) {
            for (i in data) {
                str += '<tr><td>' + data[i].join('</td><td>') + '</td></tr>';
            }
        }
        slide.innerHTML = '<table cellpadding="0" cellspacing="0"><thead><tr class="head">' + createHeader() + '</tr></thead><tbody>' + str + '</tbody></table>';

        table = slide.children[0];
        theadTr = table.children[0].children[0];
        ths = theadTr.children;
        tbody = table.children[1];

        this.resizeHeader();
        assignHeaderEvents();
    };


    function createHeader () {
        function getSorting (i) {
            if (that.sortingCol === i) {
                return that.sortingOrder === 1 ? ' class="asc"' : ' class="desc"';
            }
            else {
                return '';
            }
        }
        

        var str = '<th id="0col" align="left"' + getSorting(0) + '>' + (PERIOD ? 'Time' : 'Destination') + '</th>';
        
        for (var i in that.colPos) {
            var newI = that.colPos[i];
            str += '<th id="' + (newI + 1) + 'col" draggable="true" ondragover="return false" align="left"' + getSorting(newI + 1) + '>' + COLUMNS[newI] + '</th>';
        }

        return str;
    }


    this.resizeHeader = function () {
        theadTr.style.fontSize = '13px';
        var containerWidth = container.clientWidth,
            tableWidth = table.clientWidth,
            fontSize = 13;

        if (containerWidth >= tableWidth) {
            return;
        }

        do {
            theadTr.style.fontSize = --fontSize + 'px';
        } while (containerWidth < table.clientWidth);
    };


    function assignHeaderEvents() {
        var tr = table.children[0].children[0],
            startTh,
            startId;

        tr.addEventListener('click', function (evt) {
            startTh = evt.target;
            startId = parseInt(startTh.id);

            if (that.sortingCol === startId) {
                that.sortingOrder *= -1;
            }
            else {
                that.sortingOrder = -1;
            }
            that.sortingCol = startId;
            if (startId) {
                csBase.sort();
                csUI.update();
            }
            else {
                csBase.filter();
            }
            that.createHeader();
        });
        
        tr.addEventListener('dragstart', function (evt) {
            startTh = evt.target;
            startId = parseInt(startTh.id);
            startTh.style.opacity = 0.6;
            evt.dataTransfer.effectAllowed = 'move';
            evt.dataTransfer.dropEffect = 'move';
        });

        tr.addEventListener('dragover', function (evt) {
            var target = evt.target;

            for (var i = 0, n = ths.length; i < n; i++) {
                if (ths[i] !== startTh && ths[i] !== target) {
                    ths[i].style.opacity = '';
                }
            }

            var currId = parseInt(target.id);
            if (!currId) {
                return false;
            }

            if (startTh !== target) {
                target.style.opacity = 0.8;
            }
            else {
                return false;
            }
        });

        tr.addEventListener('dragend', function () {
            for (var i = 0, n = ths.length; i < n; i++) {
                ths[i].style.opacity = '';
            }
        });

        tr.addEventListener('drop', function (evt) {
            var target = evt.target,
                currId = parseInt(target.id);

            startTh.style.opacity = 1;
            if (startTh !== target) {
                var id1 = REARRANGE.indexOf(currId - 1),
                    id2 = REARRANGE.indexOf(startId - 1);
                var temp = REARRANGE[id1];
                REARRANGE[id1] = REARRANGE[id2];
                REARRANGE[id2] = temp;
                csBase.calculateColPos();
                that.createHeader();
                csBase.filter();
            }
        });
    }

}
function CSUI (container) {
    this.type = (byId('type') && csOptions.get('type')) || 'table';

    var that = this,
        upToDate = [],
        zIndex = 1,
        slideIndex = SLIDES.indexOf(this.type);


    var str = '';
    for (var i in SLIDES) {
        str += '<slide ondragstart="return false"></slide>';
    }

    container.innerHTML = str +
        '<div id="pie-chooser"></div>' +
        '<div id="zooming-overlay" ondragstart="return false"></div>';
    container.insertAdjacentHTML('afterend', '<section id="right-menu"><button id="go-table" onclick="csUI.goTo(\'table\')"></button><button id="go-line" onclick="csUI.goTo(\'line\')"></button><button id="go-bar" onclick="csUI.goTo(\'bar\')"></button><button id="go-barstacked" onclick="csUI.goTo(\'barstacked\')"></button><button id="go-pie" onclick="csUI.goTo(\'pie\')"></button><button id="go-csv" onclick="csBase.downloadCSV()"></button><button id="go-png" onclick="csChart.downloadPNG()"></button><button id="reset-zoom" onclick="csChart.resetZoom()"></button></section>');

    var slides = container.children;


    this.goTo = function (nextType) {
        var slide = slides[slideIndex],
            nextSlideIndex = SLIDES.indexOf(nextType),
            nextSlide = slides[nextSlideIndex];

        if (!upToDate[nextSlideIndex]) {
            if (nextType === 'table') {
                csTable.render(nextSlide);
            }
            else {
                csChart.render(nextType, nextSlide);
            }
        }
        upToDate[nextSlideIndex] = true;

        if (PERIOD && nextType !== 'pie' && nextType !== 'table') {
            csChart.assignZoom();
        }
        else {
            csChart.unAsignZoom();
        }

        var gpng = byId('go-png');
        if (nextType === 'table') {
            gpng.style.opacity = 0.4;
            gpng.disabled = true;
        }
        else {
            gpng.style.opacity = 1;
            gpng.disabled = false;
        }

        if (nextType === 'pie') {
            byId('pie-chooser').style.display = 'block';
        }
        else {
            byId('pie-chooser').style.display = 'none';
        }

        if (nextSlideIndex !== slideIndex) {
            slide.style.opacity = 0;
            var width = slide.offsetWidth;
            slide.className = '';

            if (nextSlideIndex > slideIndex) {
                nextSlide.style.left = width + 'px';
            }
            else {
                nextSlide.style.left = -width + 'px';
            }

            nextSlide.className = 'transition-slide';
            nextSlide.style.zIndex = zIndex++;
            nextSlide.clientHeight;
            nextSlide.getBoundingClientRect();

            nextSlide.style.opacity = 1;
            nextSlide.style.left = '0';
            byId('go-' + this.type).className = '';

            slideIndex = nextSlideIndex;
            this.type = nextType;
        }

        byId('go-' + nextType).className = 'active';

        rightPanelEqHeight();
    };


    this.update = function () {
        upToDate = [];
        csChart.invalidate();
        this.goTo(this.type);
    };

    
    window.addEventListener('resize', function () {
        if (that.type === 'table') {
            csTable.resizeHeader();
        }
        else {
            csChart.resize();
        }
    });
}
function byId (id) {
    return document.getElementById(id);
}


function getToday () {
    return Math.floor(new Date().setHours(0,0,0,0) / 1000);
}


function getBeginningOfDay (date) {
    return Math.floor(new Date(date * 1000).setHours(0,0,0,0) / 1000);
}


// function getSSinceMidnight (unix) {
//     var e = new Date(unix * 1000);
//     return unix - Math.floor(e.setHours(0,0,0,0) / 1000);
// }

function pad (s) {
    if (s < 10) {
        s = '0' + s;
    }
    return s;
}


function formatDate (date, format) {
    var yyyy = date.getFullYear();
    var MM = date.getMonth() + 1;
    var dd  = date.getDate();

    switch (format) {
        case 'YYYY-MM-DD':
            return yyyy + '-' + pad(MM) + '-' + pad(dd);
        case 'DD/MM/YYYY':
            return pad(dd) + '/' + pad(MM) + '/' + yyyy;
        case 'MM/DD/YYYY':
            return pad(MM) + '/' + pad(dd) + '/' + yyyy;
    }
}


function formatTime (time, format) {
    var hh = time.getHours();
    var mm = time.getMinutes();

    if (format === '12') {
        var ampm = hh >= 12 ? 'pm' : 'am';
        hh %= 12;
        hh = hh ? hh : 12;
        return pad(hh) + ':' + pad(mm) + ampm;
    }
    else {
        return pad(hh) + ':' + pad(mm);
    }
}


function downloadBlob (fileName, blob) {
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, fileName);
    }
    else {
        downloadUrl(URL.createObjectURL(blob), fileName);
    }
}


function downloadUrl (url, fileName) {
    var link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
        document.body.removeChild(link);
    }, 10000);
}


function getTableHeading () {
    var result = [PERIOD ? 'Time' : 'Destination'],
        pos = csBase.colPos;
    for (var i in pos) {
        result.push(COLUMNS[pos[i]]);
    }
    return result;
}

document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();
    window.csUI = new CSUI(byId('left-content'));

    window.csBase = new CSBase(csOptions.getColumns(), csOptions.getRows());

    window.csTable = new CSTable();
    window.csChart = new CSChart(byId('left-content'));

    window.qsPolling = new CSPolling(function () {
        csBase.filter();
    });

    byId('panel-open-button').innerHTML = '';

    // patch move_selected
    var savedMoveselect = move_selects;
    window.move_selects = function () {
        savedMoveselect.apply(window, arguments);
        csBase.filter();
    };
});


(function () {
    var s = document.createElement('script');
    s.onload = function () {
        google.charts.load('current', {packages: ['corechart']});
    };
    s.src = '//www.gstatic.com/charts/loader.js';
    document.head.appendChild(s);
})();


function qstatistics_begin () {

}