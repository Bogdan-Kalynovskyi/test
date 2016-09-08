function CSChart (container) {
    var that = this,
        gData,
        updateThrottle,
        chart,
        options = {};


    this.create = function (table) {
        if (!window.google || !google.charts.LineChart || !google.visualization) {
            setTimeout(function () {
                that.create(table);
            }, 200);
        }
        else {
            google.charts.setOnLoadCallback(function () {
                var data = [],
                    row = [];

                row.push((PERIOD === 0) ? 'Destination' : 'Time');

                for (var i in csBase.colPos) {
                    row.push(COLUMNS[csBase.colPos[i]]);
                }
                data.push(row);
                data = data.concat(table);

                gData = google.visualization.arrayToDataTable(data);

                if (!chart) {
                    chart = new google.charts.LineChart(container);
                }

                chart.draw(gData, options);
            });
        }
    };


    this.resize = function () {
        clearTimeout(updateThrottle);

        updateThrottle = setTimeout(function () {
            if (chart) {
                chart.draw(gData, options);
            }
        }, 100);
    }
}

var START,
    END,
    PERIOD,
    DAY = 86400,
    
    REARRANGE = [
        0,1,2,3,4,5,6,7,8,9,10,11
    ],

    
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
        'answer',
        'noanswer',
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
        'queues_selected',
        'agents_selected',
        'phones_selected'
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
        totals,
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


    function filterRow (row) {
        var result = [row[0]];
        for (var i in that.colPos) {
            result.push(row[that.colPos[i] + 1]);
        }

        return result;
    }


    this.percTable = function (csv) { 
        var response = new Array(table.length);

        for (i in table) {
            if (csv) {
                response[i] = [table[i][0]];
            }
            else {
                response[i] = table[i].slice();
            }
        }
        
        for (var j in this.colPos) {
            var i1 = this.colPos[j],
                j1 = +j + 1;
            if (visibleCols[i1] === 2) {
                for (var i in table) {
                    var perc;
                    if (PERIOD) {
                        perc = totals[i1] || Infinity;
                    }
                    else {
                        perc = totals[i] || Infinity;
                    }
                    perc = Math.round(table[i][j1] * 100 / perc);
                    if (csv) {
                        response[i].push(table[i][j1]);
                        response[i].push(perc);
                    }
                    else {
                        response[i][j1] += ' <small>(' + perc + '%)</small>';
                    }
                }
            }
            else if (csv) {
                for (i in table) {
                    response[i].push(table[i][j1]);
                }
            }
        }
        return response;
    };


    function addDestinationRow (display, row) {
        if (visibleRows[display]) {
            row = filterRow(row);
            var pos = rowPos[display];
            totals[pos]++;

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
            var phone = _phones[i];
            if (!phones[phone.id]) {
                phones[phone.id] = phone;
                notEmpty = true;
            }
        }
        return notEmpty;
    };


    function totalsCount (row) {
        if (PERIOD) {
            for (var i = 1, n = COLUMNS.length + 1; i < n; i++) {
                totals[i - 1] += row[i];
            }
        }
    }


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
            return calls.slice(+startIndex, +endIndex + 1);
        }
        else {
            return [];
        }
    };
    
    
    function byDestType (filteredCalls) {
        for (var i in DESTINATIONS) {
            if (visibleRows[i]) {
                var row = filterRow(new Array(COLUMNS.length + 1).fill(0));
                row[0] = DESTINATIONS[i];
                table.push(row);
                totals.push(0);
            }
        }
        for (var j in filteredCalls) {
            row = new Array(COLUMNS.length + 1).fill(0);
            decode(filteredCalls[j], row, true);
            totalsCount(row);
        }
    }


    function byTimePeriods (period, today) {
        var time = today ? getToday() : START,
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
            calls = that.filterByTime(time, time + period);
            row = new Array(COLUMNS.length + 1).fill(0);

            timeObj = new Date(time * 1000);
            row[0] = formatDate(timeObj, dateFormat);
            if (period < DAY) {
                row[0] += ' ' + formatTime(timeObj, timeFormat);
            }

            for (var j in calls) {
                decode(calls[j], row);
            }
            table.push(filterRow(row));
            totalsCount(row);

            time += period;
        }
    }


    function byDaysOfWeek () {
        // function getMonday (end) {
        //     end = new Date(end * 1000);
        //     var day = end.getDay(),
        //         diff = end.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        //     return new Date(end.setDate(diff));
        // }

        var now = Date.now() / 1000,
            day = START,
            calls,
            row;

        while (day < END && day < now) {
            row = new Array(COLUMNS.length + 1).fill(0);
            row[0] = daysOfWeek[new Date(day * 1000).getDay()];
            calls = that.filterByTime(day, day + DAY);
            for (var j in calls) {
                decode(calls[j], row);
            }
            table.push(filterRow(row));
            totalsCount(row);

            day += DAY;
        }
    }


    function byDestination (filteredCalls, subject) {
        var ids = [],
            arr,
            settings = csOptions.get(subject),
            i, j, n;

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
            var options = byId(subject + '_selected').options;
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
                tblLength = table.length,
                row = new Array(COLUMNS.length + 1).fill(0);

            switch (subject) {
                case 'queues':
                    row[0] = 'Queue: ' + name;
                    break;
                case 'agents':
                    row[0] = 'Queue agent: ' + name;
                    var dnumber = el.getAttribute('dnumber');
                    break;
                case 'phones':
                    row[0] = 'Ext: ' + name;
                    break;
            }

            totals.push(0);

            switch (subject) {
                case 'queues':
                    for (i in filteredCalls) {
                        call = filteredCalls[i];
                        if (call.getAttribute('dtype') === 'queue' || call.getAttribute('dnumber') === ids[j]) {
                            decode(call, row);
                            totals[tblLength]++;
                        }
                    }
                    break;

                case 'agents':
                    for (i in filteredCalls) {
                        call = filteredCalls[i];
                        if (call.getAttribute('stype') === 'queue' && call.getAttribute('dnumber') === dnumber) {
                            decode(call, row);
                            totals[tblLength]++;
                        }
                    }
                    break;

                case 'phones':
                    for (i in filteredCalls) {
                        call = filteredCalls[i];
                        if ((call.getAttribute('stype') === 'phone' && call.getAttribute('snumber') === name) || (call.getAttribute('dtype') === 'phone' && call.getAttribute('dnumber') === name)) {
                            decode(filteredCalls[i], row);
                            totals[tblLength]++;
                        }
                    }
                    break;
            }

            table.push(filterRow(row));
        }
    }


    this.filter = function () {
        table = [];
        totals = PERIOD ? new Array(COLUMNS.length).fill(0) : [];

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
                byTimePeriods(-PERIOD, true);
            }
            else {
                byDaysOfWeek()
            }
        }

        this.sort(); 
        csTable.update(this.percTable());
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

    this.visibleCols = visibleCols;
}

function dirty() {
    dirty.state = true;
}


$('[name="submit"]').closest('form').on('submit', function () {
    dirty.state = false; 
});


window.onbeforeunload = function () {
    if (dirty.state) {
        //return "You have not saved your settings. If you navigate away, your changes will be lost";
    }
};
function CSOptions () {

    function setWatchers() {
        var i;

        for (i in timeControls) {
            byId(timeControls[i]).addEventListener('change', function () {
                csPoll.rePoll();
                dirty();
            });
        }
        for (i in columnControls) {
            byId(columnControls[i]).addEventListener('change', function () {
                var pos = columnControls.indexOf(this.id);
                csBase.setVisibleCols(pos, +this.value);
                csTable.createHeader();
                dirty();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                csBase.setVisibleRows(pos, +this.value);
                dirty();
            });
        }
        for (i in queueControls) {
            byId(queueControls[i]).addEventListener('change', function () {
                csBase.filter();
                dirty();
            });
        }
        for (i in filterByList) {
            byId(filterByList[i]).addEventListener('change', function () {
                csBase.filter();
                dirty();
            });
        }

        byId('period').addEventListener('change', function () {
            PERIOD = +this.value;
            csTable.createHeader();
            csBase.filter();
            dirty();
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

    setWatchers();
}
function CSPoll (onResponse) {
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
        pollDelay = 6000;


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
            alert('Start time should be before end time. Please select another time.');
            stopPolling();
            throw 'start >= end';
        }
    }


    function requestIfAllowed () {
        if (!document.hidden) {
            var request = '?_username=' + username + ';_password=' + password + ';start=' + requestStart + ';end=' + requestEnd;
            ajaxGet(request, response, function () {    // on error, poll again
                timeoutHandle = setTimeout(requestIfAllowed, pollDelay);
            });
        }
    }


    this.rePoll = function (start, end) {
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

            requestStart = csBase.maxTime + 1;
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
    this.rePoll();
}
function CSTable (container) {
    var that = this,
        table,
        theadTr,
        ths,
        tbody;

    this.sortingCol = 0;
    this.sortingOrder = 1;


    function createTable () {
        var str = '<table width="100%" border="0" cellpadding="0" cellspacing="0"><thead><tr class="head">',
            timeZoneFormatted = new Date().toString().match(/([A-Z]+[\+-][0-9]+.*)/)[1];

        str += that.createHeader(true) + '</tr></thead><tbody></tbody></table>' +
        '<div class="foot"><span id="timezone">Your timezone: ' + timeZoneFormatted + '</span><button id="csv" class="universal secondary">Export as .csv</button></div>' +
        '<div id="line-chart" style="height: 500px"></div>';

        container.innerHTML = str;
        table = container.children[0],
        theadTr = table.children[0].children[0],
        ths = theadTr.children;
        tbody = table.children[1];

        that.resizeHeader();
    }


    this.createHeader = function (initial) {
        
        function getSorting (i) {
            if (that.sortingCol === i) {
                return that.sortingOrder === 1 ? ' ▼' : ' ▲';
            }
            else {
                return '';
            }
        }
        

        var str = '<th id="0col" align="left">' + (PERIOD === 0 ? 'Destination' : 'Time') + getSorting(0) + '</th>';
        
        for (var i in csBase.colPos) {
            var newI = csBase.colPos[i];
            str += '<th id="' + (newI + 1) + 'col" draggable="true" ondragover="return false" align="left">' + COLUMNS[newI] + getSorting(newI + 1) + '</th>';
        }
        if (initial) {
            return str;
        }
        
        theadTr.innerHTML = str;
        ths = theadTr.children;
        this.resizeHeader();
    };


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
                that.update(csBase.percTable());
            }
            else {
                csBase.filter();
                // sort and update are called by filter
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
                target.style.opacity = 0.7;
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
    
    
    function assignCSVButtonClick () {
        byId('csv').onclick = function () {

            function encodeRow (row) {
                for (var j = 0; j < row.length; j++) {
                    str += (j > 0) ? (',' + row[j]) : row[j];
                }
                str += '\n';
            }

            
            var str = '',
                row = [];
            
            row.push((PERIOD === 0) ? 'Destination' : 'Time');

            for (var i in csBase.colPos) {
                row.push(COLUMNS[csBase.colPos[i]]);
                if (csBase.visibleCols[i] === 2) {
                    row.push(COLUMNS[csBase.colPos[i]] + ' %');
                }
            }
            encodeRow(row);

            var table = csBase.percTable(true);
            for (var j in table) {
                encodeRow(table[j]);
            }
            // end encode


            //start download
            var fileName = (csOptions.get('name') || 'noname') + '.csv',
                csvBlob = new Blob([str], {type: 'text/csv;charset=utf-8;'});

            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(csvBlob, fileName);
            }
            else {
                var link = document.createElement("a"),
                    url = URL.createObjectURL(csvBlob);
                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                setTimeout(function () {
                    document.body.removeChild(link);
                }, 10000);
            }
            //end download
        }
    }


    this.update = function (data) {
        var str = '';

        for (var i in data) {
            str += '<tr><td>' + data[i].join('</td><td>') + '</td></tr>';
        }
        tbody.innerHTML = str;
        csChart.create(data);
    };


    createTable();
    assignHeaderEvents();
    assignCSVButtonClick();
}
function byId (id) {
    return document.getElementById(id);
}


function getToday () {
    return Math.floor(new Date().setHours(0,0,0,0) / 1000);
}


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
        var ampm = hh >= 12 ? ' p.m.' : ' a.m.';
        hh %= 12;
        hh = hh ? hh : 12;
        return pad(hh) + ':' + pad(mm) + ampm;
    }
    else {
        return pad(hh) + ':' + pad(mm);
    }
}
document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();

    window.csBase = new CSBase(csOptions.getColumns(), csOptions.getRows());

    window.csTable = new CSTable(byId('left-content'));
    window.csChart = new CSChart(byId('line-chart'));
    
    window.addEventListener('resize', function () {
        csTable.resizeHeader();
        csChart.resize();
    });

    window.csPoll = new CSPoll(
        function () {
            csBase.filter();
        }
    );
});


(function () {
    var s = document.createElement('script');
    s.onload = function () {
        google.charts.load('current', {'packages': ['corechart']});
    };
    s.src = '//www.gstatic.com/charts/loader.js';
    document.head.appendChild(s);


    // patch move_selected
    var savedMoveselect = move_selects;
    move_selects = function () {
        savedMoveselect.apply(window, arguments);
        csBase.filter();
    }

})();


function qstatistics_begin () {

}