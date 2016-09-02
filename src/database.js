function CSBase (visibleCols, visibleRows) {
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


    this.setVisibleCols = function (pos, value) {
        visibleCols[pos] = value;
        this.calculateColPos();
        this.filter();
    };


    this.setVisibleRows = function (pos, value) {
        visibleRows[pos] = value;
        this.filter();
    };


    this.calculateColPos = function () {
        this.colPos = [];
        for (var i = 0, n = COLUMNS.length; i < n; i++) {
            if (visibleCols[i]) {
                this.colPos.push(REARRANGE[i]);
            }
        }
    };


    function filterRow (row) {
        var result = [row[0]];
        for (var i in that.colPos) {
            result.push(row[that.colPos[i] + 1]);
        }

        return result;
    }


    function percTable () {
        var total = that.total || Infinity;
        for (var j in that.colPos) {
            var newI = that.colPos[j];
            if (visibleCols[newI] === 2) {
                for (var i in table) {
                    table[i][+j + 1] = table[i][+j + 1] + ' <small>(' + Math.round(table[i][+j + 1] / total * 100) + '%)</small>';
                }
            }
        }
    }


    function addDestinationRow (display, row) {
        row = filterRow(row);
        if (visibleRows[display]) {
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
            if (visibleRows[i]) {
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
    };


    // constructor
    this.calculateColPos();
    this.drop();
}