function CSChart (container) {
    var that = this,
        gData,
        updateThrottle,
        chart,
        options = {};


    this.create = function (table) {
        if (!window.google || !google.charts.Line || !google.visualization) {
            setTimeout(function () {
                that.create(table);
            }, 200);
        }
        else {
            google.charts.setOnLoadCallback(function () {
                var data = [],
                    row = [];

                row.push((PERIOD === 0) ? 'Destination' : 'Time');

                for (var i in COLUMNS) {
                    if (csBase.visibleCols[i]) {
                        row[REARRANGE[i]] = COLUMNS[i];
                    }
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
    
    QUEUES = [
        'Queues',
        'Queue agents',
        'Telephone lines'
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
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
    ];


function CSBase () {
    var that = this,
        calls,
        queues,
        agents,
        phones,
        table;


    function byStart (a, b) {
        if (a.start > b.start) {
            return -1;
        }
        else if (a.start < b.start) {
            return 1;
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
            table.sort(byCol(csTable.sortingCol, csTable.sortingOrder));
        }
        else if (csTable.sortingOrder === -1) {
            table.reverse();
        }
    };


    function pad (s) {
        if (s < 10) {
            s = '0' + s;
        }
        return s;
    }


    this.drop = function () {
        calls = [];
        queues = {};
        agents = {};
        phones = {};
        this.minTime = Infinity;
        this.maxTime = 0;
    };
    this.drop();


    function filterRow (row) {
        var result = [row[0]];
        for (var i in COLUMNS) {
            if (that.visibleCols[i]) {
                result[REARRANGE[+i + 1]] = row[+i + 1];
            }
        } 
        return result;
    }


    function percTable () {
        for (var j in COLUMNS) {
            if (that.visibleCols[j] === 2) {
                for (var i in table) {
                    var newI = REARRANGE[+j + 1];
                    table[i][newI] = table[i][newI] + ' <small>(' + Math.round(table[i][newI] / that.total * 100) + '%)</small>';
                }
            }
        }
    }


    function addDestinationRow (display, row) {
        row = filterRow(row);
        if (that.visibleRows[display]) {
            for (var i = 1, n = row.length; i < n; i++) {
                table[display][i] += row[i];
            }
        }
    }


    function decode (call, output) {
        var
            id = call.getAttribute('id'),
            stype = call.getAttribute('stype'),
            dtype = call.getAttribute('dtype'),
            snumber = call.getAttribute('snumber'),
            dnumber = call.getAttribute('dnumber'),
            answered = +call.getAttribute('answered'),
            row = output || Array(COLUMNS.length + 1).fill(0),

            external = 'external',
            local = 'local',
            isInbound,
            isInternal,
            isOutbound;

        that.total++;
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

        if (!output) {
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
            //queues

            //queue agents

            // telephone lines
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
            calls.push(_calls[i]);
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


    this.filterByTime = function (start, end) {
        calls.sort(byStart);
        var startIndex,
            endIndex,
            callStart;

        for (var i in calls) {
            callStart = +calls[i].getAttribute('start');
            if (startIndex === undefined && callStart >= start) {
                startIndex = i;
            }
            if (callStart < end) {
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
    
    
    function byDestination (filteredCalls) {
        that.total = 0;
        table = [];
        for (var i in DESTINATIONS) {
            if (that.visibleRows[i]) {
                var row = filterRow(new Array(COLUMNS.length + 1).fill(0));
                row[0] = DESTINATIONS[i];
                table.push(row);
            }
        }
        for (var j in filteredCalls) {
            decode(filteredCalls[j]);
        }
    }


    function byTimePeriods (period, today) {
        var now = Date.now() / 1000,
            time = today ? (now - now % DAY) : START,
            timeObj,
            calls,
            row;

        if ((END - START) / period > 1000) {
            alert('Too many data to display. Please set smaller period');
            throw 'too many rows to display';
        }
        
        that.total = 0;
        table = [];

        while (time < END) {
            calls = that.filterByTime(time, time + period);
            row = new Array(COLUMNS.length + 1).fill(0);

            timeObj = new Date(time * 1000);
            if (period < DAY) {
                if (END - START < DAY) {
                    row[0] = pad(timeObj.getHours()) + ':' + pad(timeObj.getMinutes());
                }
                else {
                    row[0] = pad(timeObj.getMonth() + 1) + '/' + pad(timeObj.getDate()) + '/' + timeObj.getFullYear() + ' ' + pad(timeObj.getHours()) + ':' + pad(timeObj.getMinutes());
                }
            }
            else {
                row[0] = pad(timeObj.getMonth() + 1) + '/' + pad(timeObj.getDate()) + '/' + timeObj.getFullYear();
            }
            time += period;

            for (var j in calls) {
                decode(calls[j], row);
            }

            table.push(filterRow(row));
        }
    }


    function byDaysOfWeek () {
        // todo: start from closest monday from now?
        function getMonday (end) {
            end = new Date(end * 1000);
            var day = end.getDay(),
                diff = end.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
            return new Date(end.setDate(diff));
        }

        var i = 0,
            now = Date.now() / 1000,
            day = getMonday(END).getTime() / 1000,
            calls,
            row;

        that.total = 0;
        table = [];

        while (day < END && day < now) {
            row = new Array(COLUMNS.length + 1).fill(0);
            row[0] = daysOfWeek[i];
            calls = that.filterByTime(day, day + DAY);
            for (var j in calls) {
                decode(calls[j], row);
            }
            table.push(filterRow(row));
            day += DAY;
            i++;
        }
    }


    function byQueue (filteredCalls, settings) {
        var queueIds = [],
            i, j, n;

        if (settings === 'use_include') {
            var options = byId('queues_selected').options;
            for (i = 0, n = options.length; i < n; i++) {
                queueIds.push(options[i].value);
            }
        }
        else {
            //todo cache
            for (i in queues) {
                if (settings !== 'use_control_panel' || queues[i].getAttribute('panel') === '1') {
                    queueIds.push(i);
                }
            }
        }

        for (j in queueIds) {
            var queue = queues[queueIds[j]],
                name = queue.getAttribute('name');

            var row = new Array(COLUMNS.length + 1).fill(0);
            row[0] = 'Queue: ' + name;

            for (i in filteredCalls) {
                var call = filteredCalls[i];
                if (call.getAttribute('dtype') === 'queue' || call.getAttribute('dnumber') === queueIds[j]) {
                    decode(call, row);
                }
            }

            table.push(filterRow(row));
        }
    }


    function byAgent (filteredCalls, settings) {
        var agentIds = [],
            i, j, n;

        if (settings === 'use_include') {
            var options = byId('agents_selected').options;
            for (i = 0, n = options.length; i < n; i++) {
                agentIds.push(options[i].value);
            }
        }
        else {
            //todo cache
            for (i in agents) {
                if (settings !== 'use_control_panel' || agents[i].getAttribute('panel') === '1') {
                    agentIds.push(i);
                }
            }
        }

        for (j in agentIds) {
            var agent = agents[agentIds[j]],
                name = agent.getAttribute('name');

            var row = new Array(COLUMNS.length + 1).fill(0);
            row[0] = 'Queue agent: ' + name;

            for (i in filteredCalls) {
                var call = filteredCalls[i];
                if (call.getAttribute('stype') === 'queue' || call.getAttribute('dnumber') === agent.getAttribute('dnumber')) {
                    decode(call, row);
                }
            }

            table.push(filterRow(row));
        }
    }


    function byPhone (filteredCalls, settings) {
        var phoneIds = [],
            i, j, n;

        if (settings === 'use_include') {
            var options = byId('phones_selected').options;
            for (i = 0, n = options.length; i < n; i++) {
                phoneIds.push(i);
            }
        }
        else {
            //todo cache
            for (i in phones) {
                if (settings !== 'use_control_panel' || phones[i].getAttribute('panel') === '1') {
                    phoneIds.push(phones[i].id);
                }
            }
        }

        for (j in phoneIds) {
            var phone = phones[phoneIds[j]],
                name = phone.getAttribute('name'),
                dnumber = phone.getAttribute('dnumber');

            var row = new Array(COLUMNS.length + 1).fill(0);
            row[0] = 'Ext: ' + phone.getAttribute('name');

            for (i in filteredCalls) {
                var call = filteredCalls[i];
                if ((call.getAttribute('stype') === 'phone' && call.getAttribute('snumber') === name) || (call.getAttribute('dtype') === 'phone' && call.getAttribute('dnumber') === dnumber)) {
                    decode(filteredCalls[i], row);
                }
            }

            table.push(filterRow(row));
        }
    }


    this.filter = function () {
        if (PERIOD === 0) {
            var filteredCalls = that.filterByTime(START, END);
            byDestination(filteredCalls);
            // todo: merge three below into one
            byQueue(filteredCalls, csOptions.get('queues'));
            byAgent(filteredCalls, csOptions.get('agents'));
            byPhone(filteredCalls, csOptions.get('phones'));
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
        percTable(table);
        csTable.update(table);
    }
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
                csBase.visibleCols[pos] = +this.value;
                csBase.filter();
                csTable.createHeader();
                dirty();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                csBase.visibleRows[pos] = +this.value;
                csBase.filter();
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
        lastDate,
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
        var today = Math.floor(Date.now() / 1000);
        today -= today % DAY;

        var startday = csOptions.getNumber('startday');
        if (startday === 1) {
            START = new Date(csOptions.getNumber('start_year'), csOptions.getNumber('start_month'), csOptions.getNumber('start_day')).getTime() / 1000;
        }
        else {
            START = today + startday * DAY;
        }
        START += csOptions.getNumber('start_hour') * 3600 + csOptions.getNumber('start_minute') * 60 + csOptions.getNumber('start_second');

        var endday = csOptions.getNumber('endday');
        if (endday == 1) {
            END = new Date(csOptions.getNumber('end_year'), csOptions.getNumber('end_month'), csOptions.getNumber('end_day')).getTime() / 1000;
        }
        else {
            END = today + endday * DAY;
        }
        END += csOptions.getNumber('end_hour') * 3600 + csOptions.getNumber('end_minute') * 60 + csOptions.getNumber('end_second');

        if (START >= END) {
            alert('Start time should be before end time');
            throw 'start > end';
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
            onResponse(csBase.filterByTime(START, END));    //don't poll again
            return;
        }
        //query what is missing
        else if (START < csBase.minTime && END >= csBase.minTime) {
            onResponse(csBase.filterByTime(csBase.minTime, Math.min(csBase.maxTime, END)));  // return part from cache
            requestStart = START;
            requestEnd = csBase.minTime - 1;
        }
        //query what is missing
        else if (START <= csBase.maxTime/* && END > csBase.maxTime*/) {
            onResponse(csBase.filterByTime(START, csBase.maxTime/*Math.min(csBase.maxTime, END)*/));  // return part from cache
            requestStart = csBase.maxTime + 1;
            requestEnd = END;
        }

        else {
            requestStart = START;
            requestEnd = END;
        }

        clearTimeout(timeoutHandle);
        if (xhr) {
            xhr.abort();
        }
        if (!preloaderShown) {
            showPreloader();
        }
      
        requestIfAllowed();
    };


    function response(response) {
        var update = response.getElementsByTagName('update')[0];

        // break polling loop on error
        if (!update) {
            var error = response.getElementsByTagName('errors')[0];
            if (error && !alertShown) {
                alert(error.getElementsByTagName('error')[0].getAttribute('message'));
            }
        }
        else {
            var updateEnd = +update.getAttribute('timestamp') - 1,
                updateNotEmpty = csBase.add(update, requestStart, Math.min(requestEnd, updateEnd));

            if (firstPoll || updateNotEmpty) {
                onResponse();
            }

            firstPoll = false;
            hidePreloader();

            // Handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.
            if (lastDate && lastDate !== (new Date()).getDay()) {
                if (byId('startday').value === '0') {
                    START += DAY;
                }
                if (byId('endday').value === '0') {
                    END += DAY;
                }
            }
            lastDate = (new Date()).getDay();

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


    function visibilityChange () {
        clearTimeout(timeoutHandle);
        if (xhr) {
            xhr.abort();
        }
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
        cachedData,
        table,
        theadTr,
        ths,
        tbody;

    this.sortingCol = 0;
    this.sortingOrder = 1;


    function createTable () {
        var str = '<table width="100%" border="0" cellpadding="0" cellspacing="0">' +
                    '<thead><tr class="head">';

        str += that.createHeader(true) + '</tr></thead><tbody></tbody></table><br>' +
            '<div id="line-chart" style="height: 500px"></div><br>' +
            '<button id="csv">Download as CSV</button>';

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
        
        for (var i in COLUMNS) {
            var newI = REARRANGE[+i + 1];

            if (csBase.visibleCols[i]) {
                str += '<th id="' + newI + 'col" draggable="true" ondragover="return false" align="left">' + COLUMNS[newI] + getSorting(newI) + '</th>';
            }
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
                that.update();
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

            if (startTh !== target) {
                target.style.opacity = 0.77;
                var currId = parseInt(target.id);

                if (!currId) {
                    return false;
                }
            }
            else {
                return false;
            }
        });

        tr.addEventListener('dragend', function () {
            startTh.style.opacity = 1;
        });

        tr.addEventListener('drop', function (evt) {
            var target = evt.target,
                currId = parseInt(target.id);

            startTh.style.opacity = 1;
            if (startTh !== target) {
                var temp = REARRANGE[currId];
                REARRANGE[currId] = REARRANGE[startId];
                REARRANGE[startId] = temp;
                that.createHeader();
                that.update();
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
            
            for (var i in COLUMNS) {
                if (csBase.visibleCols[i]) {
                    row[REARRANGE[i]] = COLUMNS[i];
                }
            }
            encodeRow(row);

            for (var j in cachedData) {
                encodeRow(cachedData[j]);
            }
            // end encode


            //start download
            var fileName = (csOptions.get('name') || '') + '_voisonics_report.csv',
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
        if (!data) {
            data = cachedData;
        }
        var str = '';

        for (var i in data) {
            str += '<tr><td>' + data[i].join('</td><td>') + '</td></tr>';
        }
        tbody.innerHTML = str;
        csChart.create(data);
        
        cachedData = data;
    };


    createTable();
    assignHeaderEvents();
    assignCSVButtonClick();
}
function byId (id) {
    return document.getElementById(id);
}
document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();

    window.csBase = new CSBase();
    csBase.visibleCols = csOptions.getColumns();
    csBase.visibleRows = csOptions.getRows();

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