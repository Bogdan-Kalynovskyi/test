function CSBase (visibleCols, visibleRows) {
    var that = this,
        calls,
        queues,
        agents,
        phones,
        rowPos,
        totals,
        columnSum,
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
                    var perc = Math.round(table[i][j1] * 100 / (totals[i] || Infinity));
                    if (csv) {
                        response[i].push(table[i][j1]);
                        response[i].push(perc);
                    }
                    else {
                        response[i][j1] += ' <small>(' + perc + '&#8198;%)</small>';
                    }
                }
            }
            else if (csv) {
                for (i in table) {
                    response[i].push(table[i][j1]);
                }
            }
        }

        columnSum.unshift('Total');
        response.push(columnSum);
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
        }
    }


    function byTimePeriods (period, today) {
        var time = today ? getToday() : START,
            timeObj,
            calls,
            row,
            now = Date.now() / 1000,
            dateChanged = (END - START > 2 * DAY) || (new Date(END * 1000).getDate() - new Date(START * 1000).getDate()),
            dateFormat = csOptions.config('settings', 'dateformat'),
            timeFormat = csOptions.config('settings', 'timeformat');

        if ((END - START) / period > 10000) {
            alert('Too many data to display. Please set smaller period');
            throw 'too many rows to display';
        }

        columnSum = new Array(that.colPos.length).fill(0);

        while (time < END && time < now) {
            calls = that.filterByTime(time, time + period);
            row = new Array(COLUMNS.length + 1).fill(0);

            timeObj = new Date(time * 1000);
            if (dateChanged) {
                row[0] = formatDate(timeObj, dateFormat);
                if (period < DAY) {
                    row[0] += ' ' + formatTime(timeObj, timeFormat);
                }
            }
            else {
                row[0] = formatTime(timeObj, timeFormat);
            }

            for (var j in calls) {
                decode(calls[j], row);
            }
            table.push(filterRow(row));
            totals.push(calls.length);
            for (var i in row) {
                columnSum[i] += row[i];
            }

            time += period;
        }
    }


    function byDaysOfWeek () {
        var now = Date.now() / 1000,
            day = START,
            calls,
            row;

        columnSum = new Array(that.colPos.length).fill(0);

        while (day < END && day < now) {
            row = new Array(COLUMNS.length + 1).fill(0);
            row[0] = daysOfWeek[new Date(day * 1000).getDay()];
            calls = that.filterByTime(day, day + DAY);

            for (var j in calls) {
                decode(calls[j], row);
            }
            table.push(filterRow(row));
            totals.push(calls.length);
            for (var i in row) {
                columnSum[i] += row[i];
            }

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
                match,
                totalsCount = 0,
                row = new Array(COLUMNS.length + 1).fill(0);

            switch (subject) {
                case 'queues':
                    row[0] = 'Queue: ' + name;
                    break;
                case 'agents':
                    row[0] = 'Queue agent: ' + name;
                    var dnumber = el.getAttribute('dnumber'),
                        dtype = el.getAttribute('dtype');
                    break;
                case 'phones':
                    row[0] = 'Ext: ' + name;
                    break;
            }

            for (i in filteredCalls) {
                call = filteredCalls[i];

                switch (subject) {
                    case 'queues':
                        match = call.getAttribute('dtype') === 'queue' && call.getAttribute('dnumber') === ids[j];
                        break;

                    case 'agents':
                        match = call.getAttribute('stype') === 'queue' && call.getAttribute('dnumber') === dnumber && call.getAttribute('dtype') === dtype;
                        break;

                    case 'phones':
                        match = (call.getAttribute('stype') === 'phone' && call.getAttribute('snumber') === name) || (call.getAttribute('dtype') === 'phone' && call.getAttribute('dnumber') === name);
                        break;
                }

                if (match) {
                    decode(call, row);
                    totalsCount++;
                }
            }

            table.push(filterRow(row));
            totals.push(totalsCount);
        }
    }


    this.filter = function () {
        table = [];
        totals = [];

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