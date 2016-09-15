function CSBase (visibleCols, visibleRows) {
    var that = this,
        calls,
        queues,
        agents,
        phones,
        rowPos,
        columnSum,
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
            columnSum1 = ['Total'],
            i, j, perc;

        for (i in table) {
            if (csv) {
                response[i] = [table[i][0]];
            }
            else {
                response[i] = table[i].slice();
            }
        }

        if (!csv) {
            columnSum1 = columnSum1.concat(columnSum);
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
                perc = total ? Math.round(columnSum[j] * 100 / total) : '';
                if (showTotal) {
                    if (csv) {
                        columnSum1.push(columnSum[j]);
                        columnSum1.push(perc);
                    }
                    else {
                        columnSum1[j1] += ' <small>(' + perc + (total ? '&#8198;%' : '') + ')</small>';
                    }
                }
            }
            else if (csv) {
                for (i in table) {
                    response[i].push(table[i][j1]);
                }
                if (showTotal) {
                    columnSum1.push(columnSum[j]);
                }
            }
        }

        if (showTotal) {
            response.push(columnSum1);
        }
        return response;
    };


    this.getTable = function () {
        return table;
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


    function reduceTable () {
        var n = that.colPos.length + 1;
        for (var i in table) {
            var row = reduceRow(table[i]);
            table[i] = row;
            for (var j = 1; j < n; j++) {
                columnSum[j - 1] += row[j];
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
                row = newRow();

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

            row.total = totalsCount;
            table.push(reduceRow(row));
        }
    }


    this.filter = function () {
        table = [];
        columnSum = new Array(that.colPos.length).fill(0);
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