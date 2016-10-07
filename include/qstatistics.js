function QChart (container) {
    var that = this,
        table,
        nonPieDataTable,
        pieDataTable,
        charts = {},
        overlay = byId('zooming-overlay'),
        resetZoom = byId('zoom-out'),
        rectSVG,
        startX,
        endX,
        goodEvt,
        options = {
            line: {
                sliceVisibilityThreshold: 0
            },
            bar: {
                sliceVisibilityThreshold: 0,
                bar: {groupWidth: "90%"}
            },
            barstacked: {
                isStacked: true,
                sliceVisibilityThreshold: 0,
                bar: {groupWidth: "90%"}
            },
            pie: {
                is3D: true,
                pieSliceText: 'label',
                sliceVisibilityThreshold: 0
            }
        };


    function centerPieSource () {
        var g = SLIDES.pie.querySelectorAll('svg > g'),
            left = Infinity,
            right = 0;

        for (var i = (options.pie.legend === null ? 1 : 0); i < g.length - 1; i++) {
            var rect = g[i].getBoundingClientRect();
            left = Math.min(left, rect.left);
            right = Math.max(right, rect.right);
        }

        rect = byId('left-content').getBoundingClientRect();
        byId('pie-chooser').style.right = rect.right - right - left + rect.left + 1 + 'px';
    }


    container.addEventListener('mousedown', mousedown, true);
    container.addEventListener('mouseup', mouseup, true);
    container.addEventListener('wheel', mousewheel);


    function pieSourceChooser () {
        if (!that.pieFilter) {
            var pieFilterSaved = document.getElementsByName('piesource')[0];
            if (pieFilterSaved && pieFilterSaved.value) {
                pieFilterSaved = pieFilterSaved.value.split('_');
                that.pieFilter = {
                    by: pieFilterSaved[0],
                    id: pieFilterSaved[1]
                };
            }
            else {
                that.pieFilter = {
                    by: 'column',
                    id: '0'
                };
            }
        }
        
        var str = 'Display:<label> column <select id="pie-by-column"><option value="">Choose column</option>',
            visibleCols = qOptions.getColumns(),
            value;
        
        for (var i in COLUMNS) {
            if (visibleCols[i]) {
                str += '<option value="' + i + '">' + COLUMNS[i] + '</option>';
            }
        }
        str += '</select></label><label>&#8198;, or row <select id="pie-by-row"><option value="">Choose row</option>';
        for (i in table) {
            var row = table[i],
                totalVisible = 0;

            if (row.total) {
                var tableHeading = getTableHeading(),
                    totalCallsPos = qBase.colPos.indexOf(0) + 1;

                for (var j = 1; j < tableHeading.length; j++) {
                    if (j !== totalCallsPos) {
                        totalVisible += row[j];
                    }
                }

                if (totalVisible) {
                    str += '<option value="' + i + '">' + table[i][0] + '</option>';
                }
            }
        }
        str += '</select></label>';
        byId('pie-chooser').innerHTML = str;

        var byCol = byId('pie-by-column'),
            byRow = byId('pie-by-row');

        byCol.onchange = function () {
            if (this.value) {
                that.pieFilter = {
                    by: 'column',
                    id: this.value
                };
                byRow.value = '';
                pieDataTable = getPieDataTable();
                charts.pie.draw(pieDataTable, options.pie);
                centerPieSource();
            }
        };
        byRow.onchange = function () {
            if (this.value) {
                that.pieFilter = {
                    by: 'row',
                    id: this.value
                };
                byCol.value = '';
                pieDataTable = getPieDataTable();
                charts.pie.draw(pieDataTable, options.pie);
                centerPieSource();
            }
        };

        if (that.pieFilter.by === 'column') {
            byCol.value = that.pieFilter.id;
            if (byCol.selectedIndex === -1) {
                byCol.selectedIndex = 1;
            }
        }
        else {
            byRow.value = that.pieFilter.id;
            if (byRow.selectedIndex === -1) {
                byRow.selectedIndex = 1;
            }
        }
    }


    function getPieDataTable () {
        that.pieFilter.id = qOptions.get('pie-by-column');
        that.pieFilter.by = 'column';
        if (!that.pieFilter.id) {
            that.pieFilter.id = qOptions.get('pie-by-row');
            that.pieFilter.by = 'row';
        }
        var row,
            id = +that.pieFilter.id,
            data = [['', '']];

        if (isNaN(id)) {
            return;
        }
        options.pie.legend = null;
        options.pie.enableInteractivity = true;

        if (that.pieFilter.by === 'column') {
            var pos = qBase.colPos.indexOf(id);
            if (!PERIOD || qBase.colSum[pos]) {
                var i = (!PERIOD && qOptions.getNumber('allcalls')) ? 1 : 0,                   // in Destination mode, don't show "All calls" in chart
                    n = table.length - (PERIOD && qOptions.getNumber('totalrow') ? 1 : 0),     // in Time mode, don't show "Total" row
                    totalVisible = 0;

                    for (; i < n; i++) {
                    row = table[i];
                    if (row.total) {
                        totalVisible += row[pos + 1];
                        data.push([row[0], row[pos + 1]]);
                    }
                }
            }
            if (!totalVisible) {
                data.splice(1, 9999, ['No calls', 1]);
                options.pie.legend = 'none';
                options.pie.enableInteractivity = false;
            }
        }
        else {
            row = table[id];
            if (row.total) {
                var tableHeading = getTableHeading(),
                    totalCallsPos = qBase.colPos.indexOf(0) + 1;
                
                for (i = 1, n = tableHeading.length; i < n; i++) {
                    if (i !== totalCallsPos) {
                        data.push([tableHeading[i], row[i]]);
                    }
                }
            }
        }

        return google.visualization.arrayToDataTable(data);
    }


    function getDataTable () {
        var data = [getTableHeading()].concat(table);
        return google.visualization.arrayToDataTable(data);
    }


    function mousedown (evt) {
        var svgr = charts[qMenu.type] && charts[qMenu.type].svgr;
        goodEvt = svgr && (svgr === evt.target || svgr.contains(evt.target));
        
        if (goodEvt) {
            rectSVG = svgr.getBoundingClientRect();
            startX = evt.pageX;
            overlay.style.top = rectSVG.top + 'px';
            overlay.style.bottom = document.body.clientHeight - rectSVG.bottom + 'px';
            overlay.style.left = startX - window.scrollX + 'px';
            overlay.style.right = document.body.clientWidth + window.scrollX - startX + 'px';
            overlay.style.display = 'block';
            container.onmousemove = mousemove;
        }
    }


    function mousemove (evt) {
        endX = evt.pageX;
        overlay.style.top = rectSVG.top + 'px';
        overlay.style.bottom = document.body.clientHeight - rectSVG.bottom + 'px';
        overlay.style.left = Math.min(startX, endX) - window.scrollX + 'px';
        overlay.style.right = document.body.clientWidth + window.scrollX - Math.max(startX, endX) + 'px';
    }

    
    function mouseup () {
        if (endX === undefined) {
            overlay.style.display = 'none';
        }
        else if (goodEvt) {
            overlay.style.display = 'none';
            var maxX = Math.max(startX, endX),
                minX = Math.min(startX, endX);

            if (maxX - minX < 6) {
                return;
            }

            if (!that.originalZoom) {
                that.originalZoom = {
                    start: START,
                    end: END,
                    startOpt: qOptions.get('startday'), 
                    endOpt: qOptions.get('endday'),
                    period: PERIOD
                };
                resetZoom.style.display = 'block';
            }

            var leftTime = START,
                rightTime = Math.min(Date.now() / 1000, END);

            START += (rightTime - leftTime) * (minX - window.scrollX - rectSVG.left) / rectSVG.width;
            END = rightTime - (rightTime - leftTime) * (rectSVG.right + window.scrollX - maxX) / rectSVG.width;
            PERIOD *= (END - START) / (rightTime - leftTime);

            qOptions.showNewTime();
            qBase.filter();

            container.onmousemove = null;
        }
        
        goodEvt = false;
        endX = undefined;
    }

    
    function mousewheel (evt) {
        var svgr = charts[qMenu.type] && charts[qMenu.type].svgr;
        if (svgr && (svgr === evt.target || svgr.contains(evt.target))) {
            if (!that.originalZoom) {
                that.originalZoom = {
                    start: START,
                    end: END,
                    startOpt: qOptions.get('startday'),
                    endOpt: qOptions.get('endday'),
                    period: PERIOD
                };
                resetZoom.style.display = 'block';
            }
            
            var leftTime = START,
                rightTime = Math.min(Date.now() / 1000, END),
                rectSVG = svgr.getBoundingClientRect(),
                center = evt.pageX + window.scrollX,
                left = center - rectSVG.left,
                right = rectSVG.right - center,
                zoom = 0.2 * evt.deltaY / 100;

            START += (rightTime - leftTime) * left / rectSVG.width * zoom;
            END = rightTime - (rightTime - leftTime) * right / rectSVG.width * zoom;
            PERIOD *= (END - START) / (rightTime - leftTime) * (zoom > 0 ? 1.05 : 0.95);
            
            qOptions.showNewTime();
            qBase.filter();
        }
    }

    
    function assignZoom (type, slide) {
        if (PERIOD > 0) {
            var svgr = slide.getElementsByTagName('svg')[0].children[3].children[0];
            svgr.style.cursor = 'col-resize';
            charts[type].svgr = svgr;
        }
    }
    

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
                        case 'barstacked':
                            charts[type] = new google.visualization.ColumnChart(slide);
                            break;
                        case 'pie':
                            charts[type] = new google.visualization.PieChart(slide);
                            break;
                    }
                } 
                table = table || qBase.getTable(type);

                if (type !== 'pie') {
                    nonPieDataTable = nonPieDataTable || getDataTable();
                    charts[type].draw(nonPieDataTable, options[type]);
                    assignZoom(type, slide);
                }
                else {
                    pieSourceChooser();
                    pieDataTable = getPieDataTable();
                    charts.pie.draw(pieDataTable, options.pie);
                    centerPieSource();
                }
            });
        }
    };


    this.invalidate = function () {
        table = nonPieDataTable = undefined;
    };


    this.resize = function () {
        var type = qMenu.type;
        if (charts[type]) {
            charts[type].draw(type === 'pie' ? pieDataTable : nonPieDataTable, options[type]);
            if (type === 'pie') {
                centerPieSource();
            }
            else {
                assignZoom(type, SLIDES[type]);
            }
        }
    };


    this.downloadPNG = function () {
        var fileName = (qOptions.get('name') || 'noname') + '.png';
        downloadUrl(charts[qMenu.type].getImageURI(), fileName);
    };


    this.resetZoom = function () {
        byId('zooming-overlay').style.display = 'none';
        var orig = this.originalZoom;
        START = orig.start;
        END = orig.end;
        PERIOD = orig.period;
        qOptions.showNewTime();
        byId('startday').value = orig.startOpt;
        byId('endday').value = orig.endOpt;
        this.originalZoom = null;
        resetZoom.style.display = 'none';
        qBase.filter();
    }
}

var START,
    END,
    PERIOD,
    DAY = 86400,
    
    REARRANGE = [
        0,1,2,3,4,5,6,7,8,9,10,11
    ],

    TYPES = ['table', 'line', 'bar', 'barstacked', 'pie'],
    SLIDES = {},

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


function QBase (visibleCols, visibleRows) {
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
        if (qTable.sortingCol > 0) {
            table.sort(byCol(this.colPos.indexOf(qTable.sortingCol - 1) + 1, qTable.sortingOrder));
        }
        else if (qTable.sortingOrder === -1) {
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
        var showTotal = PERIOD && qOptions.getNumber('totalrow'),
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

                if (showTotal) {
                    perc = total ? Math.round(this.colSum[j] * 100 / total) : '';
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


    this.getTable = function (type) {
        var result;
        if (!table.length) {
            result = new Array(this.colPos.length).fill(0).unshift('');
        }
        else if (PERIOD && type === 'pie' && qOptions.getNumber('totalrow')) {
            var rowsum = ['Total'].concat(this.colSum);
            rowsum.total = total;
            result = table.concat([rowsum]);
        }
        else {
            result = table;
        }
        
        return result;
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

        var data = qBase.percTable(true);
        for (i in data) {
            str += data[i].join(',') + '\n';
        }

        var fileName = (qOptions.get('name') || 'noname') + '.csv',
            csvBlob = new Blob([str], {type: 'text/csv;charset=utf-8;'});

        downloadBlob(fileName, csvBlob);
    };




    function newRow () {
        var row = new Array(COLUMNS.length + 1).fill(0);
        row.total = 0;
        return row;
    }


    function add2MultiRow (row, multiRow) {
        for (var i = 1, n = row.length; i < n; i++) {
            multiRow[i] += row[i];
        }
        multiRow.total += row.total;
    }


    function add2TableOrMultiRow (display, row, multiRow) {
        if (visibleRows[display]) {
            if (multiRow) {
                add2MultiRow(row, multiRow);
            }
            else {
                var tblRow = table[rowPos[display]];
                
                tblRow.total++;
                for (var i = 1, n = row.length; i < n; i++) {
                    tblRow[i] += row[i];
                }
            }
        }
    }


    function decode (call, multiRow, justAppend) {
        var stype = call.getAttribute('stype'),
            dtype = call.getAttribute('dtype'),
            snumber = call.getAttribute('snumber'),
            dnumber = call.getAttribute('dnumber'),
            answered = +call.getAttribute('answered'),
            external = 'external',
            local = 'local',
            isInbound,
            isInternal,
            isOutbound,
            row;

        if (justAppend) {
            row = multiRow;
        }
        else {
            row = newRow();
        }
        row.total++;

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
        
        if (!justAppend) {
            //total
            add2TableOrMultiRow(0, row, multiRow);
            // external callers
            if (stype === external || stype === local) {
                add2TableOrMultiRow(1, row, multiRow);
            }
            // internal callers
            if (stype !== external && stype !== local && dtype != external && dtype !== local) {
                add2TableOrMultiRow(2, row, multiRow);
            }
            // external destinations
            if (dtype === external || dtype === local) {
                add2TableOrMultiRow(3, row, multiRow);
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
        if (notEmpty) {
            calls.sort(byEnd);
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
            if (PERIOD) {
                for (var j = 1; j < n; j++) {
                    that.colSum[j - 1] += row[j];
                }
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
            decode(filteredCalls[j]);
        }
        reduceTable();
    }


    function byTimePeriods () {
        var startTime = START,
            endTime = START,
            timeObj,
            calls,
            row,
            now = Date.now() / 1000,
            dateFormat = qOptions.config('dateformat'),
            timeFormat = qOptions.config('timeformat');
 
        if ((END - START) / PERIOD > 2600) {
            alert('Too many rows to display. Please set bigger time period');
            byId('period').value = '0';
            throw 'too many rows to display';
        }

        while (startTime < END && startTime < now) {
            endTime += PERIOD;
            endTime = Math.min(endTime, END);

            calls = that.filterByTime(startTime, endTime);
            row = newRow();

            timeObj = new Date(startTime * 1000);
            if (PERIOD < DAY) {
                row[0] = formatDate(timeObj, dateFormat) + ' ' + formatTime(timeObj, timeFormat);
            }
            else {
                row[0] = formatDate(timeObj, dateFormat);
            }

            if (calls.length) {
                for (var i in calls) {
                    decode(calls[i], row);
                }
                byQueueAgentPhone(calls, row);
            }
            
            table.push(row);

            startTime = endTime;
        }

        reduceTable();
    }


    function byHours (period) {
        var normalizedStart = START - START % period,
            calls,
            call,
            row,
            reportIndex,
            date = new Date(START * 1000),
            totalHours = DAY / period,
            isHalfHours = period === 1800,
            timeFormat = qOptions.config('timeformat'),
        
            startShift = date.getHours();
        if (isHalfHours) {
            startShift = startShift * 2 + Math.round(date.getMinutes() / 30);
        }
        

        for (var i = 0; i < totalHours; i++) {
            row = newRow();
            date = new Date((i * period + normalizedStart) * 1000);
            row[0] = formatTime(date, timeFormat);
            table[i] = row;
        }

        calls = that.filterByTime(START, END);

        for (i in calls) {
            call = calls[i]; 
            date = new Date(call.end * 1000);
            reportIndex = date.getHours();
            if (isHalfHours) {
                reportIndex = reportIndex * 2 + Math.round(date.getMinutes() / 30);
            }
            reportIndex -= startShift;
            if (reportIndex < 0) {
                reportIndex = totalHours + reportIndex;
            }
            
            row = table[reportIndex];
            decode(call, row);
            byQueueAgentPhone([call], row);
        }

        reduceTable();
    }


    function byDaysOfWeek () {
        var now = Date.now() / 1000,
            startTime = START,
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

        while (startTime < END && startTime < now) {
            endTime = getDaysAhead(endTime, 1);
            endTime = Math.min(endTime, END);

            dayOfWeek = new Date(startTime * 1000).getDay();
            reportIndex = dayOfWeek - startDayOfWeek;  // start from startDayOfWeek
            if (reportIndex < 0) {
                reportIndex += 7;
            }
            row = table[reportIndex];
            calls = that.filterByTime(startTime, endTime);

            for (i in calls) {
                decode(calls[i], row);
            } 
            byQueueAgentPhone(calls, row);

            startTime = endTime;
        }

        reduceTable();
    }


    function byQueueAgentPhone (filteredCalls, multiRow) {
        var destinations = ['queues', 'agents', 'phones'];
        for (var dest in destinations) {
            
            var subject = destinations[dest],
                ids = [],
                arr,
                settings = qOptions.get(subject),
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
                    row = newRow();

                if (!multiRow) {
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
                        decode(call, row, true);
                    }
                }

                if (multiRow) {
                    add2MultiRow(row, multiRow);
                }
                else {
                    table.push(reduceRow(row));
                }
            }
        }
    }


    this.filter = function () {
        table = [];
        if (PERIOD) {
            this.colSum = new Array(that.colPos.length).fill(0);
        }
        total = 0;

        if (PERIOD === 0) {
            var filteredCalls = that.filterByTime(START, END);
            byDestType(filteredCalls);
            byQueueAgentPhone(filteredCalls);
        }
        else if (PERIOD > 0) {
            byTimePeriods()
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
        qMenu.update();
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

function QOptions () {
    var that = this,
        savedScrollX,
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
        
        byId('name').addEventListener('change', function () {
            that.onFormDirty();
        });

        for (i in timeControls) {
            byId(timeControls[i]).addEventListener('change', function () {
                qPolling.update();
                preventScroll();
            });
        }
        for (i in columnControls) {
            byId(columnControls[i]).addEventListener('change', function () {
                var pos = columnControls.indexOf(this.id);
                qBase.setVisibleCols(pos, +this.value);
                preventScroll();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                qBase.setVisibleRows(pos, +this.value);
                preventScroll();
            });
        }
        for (i in queueControls) {
            byId(queueControls[i]).addEventListener('change', function () {
                qBase.filter();
                preventScroll();
            });
        }
        for (i in filterByList) {
            byId(filterByList[i]).addEventListener('change', function () {
                qBase.filter();
                preventScroll();
            });
        }

        byId('period').addEventListener('change', function () {
            PERIOD = +this.value;
            byId('heading_rows').innerHTML = PERIOD ? 'Sum of destinations:' : 'Display destinations:';
            qBase.filter();
            preventScroll();
        });

        byId('totalrow').addEventListener('change', function () {
            qBase.filter();
            preventScroll();
        });

        form.find('input[type="button"]').on('click', function () {
            qBase.filter();
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

    
    this.config = function (field) {
        return document['settings'][field].value;
    };


    this.get = function (id) {
        return byId(id).value;
    };
    this.getNumber = function (id) {
        return +byId(id).value;
    };


    PERIOD = this.getNumber('period');
    this.recursive = +document.getElementsByName('recursive')[0].value;

    
    var form = $('form').last(),
        inputs = form.find('select, input'),
        submitBtn = form.find('input[type="submit"]').css('margin-top', '10px')[0],
        dirty,
        appended;

    setWatchers();
////////////////////////

    this.onFormDirty = function () {
        dirty = true;
        submitBtn.disabled = false;
        submitBtn.value = 'Save';
    };
    
    
    function onFormClean () {
        submitBtn.disabled = true;
        submitBtn.value = 'Saved';
        dirty = false;
    }
    onFormClean();
    

    inputs.on('change', this.onFormDirty);

    form.on('submit', function () {

        function markAllOptions (mark) {
            var arr = ['queues', 'agents', 'phones'];
            for (var i in arr) {
                if (qOptions.get(arr[i]) === 'use_include') {
                    var options = byId(arr[i] + 'include_selected').options;
                    for (var j = options.length - 1; j >= 0; j--) {
                        options[j].selected = mark;
                    }
                }
            }
        }


        if (!qOptions.get('name')) {
            window.scrollTo(0, 0);
            byId('name').focus();
            alert('Please enter the report name.');
            return false;
        }

        dirty = false;

        markAllOptions(true);

        if (appended) {
            for (var i = 0; i < 4; i++) {
                form.find('input').last().remove();
            }
        }
        appended = true;

        form.append('<input type="hidden" name="startdate" value="' + START + '"/>' +
                    '<input type="hidden" name="enddate" value="' + END + '"/>' +
                    '<input type="hidden" name="starttime" value="' + (START - getBeginningOfDay(START)) + '"/>' +
                    '<input type="hidden" name="endtime" value="' + (END - getBeginningOfDay(END)) + '"/>');

        if (qChart.pieFilter && qChart.pieFilter.id) {
            form[0]['piesource'].value = qChart.pieFilter.by + '_' + qChart.pieFilter.id;
        }
        form[0]['type'].value = qMenu.type;

        $.post(form.attr('action'), form.serialize(), function (response) {
            form[0]['id'].value = response.getElementsByTagName('return')[0].id;
            onFormClean();
        });
        markAllOptions(false);
        return false;
    });


    this.showNewTime = function () {
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
function QPolling (onResponse) {
    var that = this,
        username = qOptions.config('username'),
        password = qOptions.config('password'),
        xhr,
        preloaderShown,
        today,
        lastToday,
        requestStart,
        requestEnd,
        firstPoll,
        timeoutHandle,
        pollDelay = +qOptions.config('refresh');


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

        var startday = qOptions.getNumber('startday');
        if (startday === 1) {
            START = new Date(qOptions.getNumber('start_year'), qOptions.getNumber('start_month') - 1, qOptions.getNumber('start_day')).getTime() / 1000;
        }
        else {
            START = getDaysAhead(today, startday);
        }
        START += qOptions.getNumber('start_hour') * 3600 + qOptions.getNumber('start_minute') * 60 + qOptions.getNumber('start_second');

        var endday = qOptions.getNumber('endday');
        if (endday == 1) {
            END = new Date(qOptions.getNumber('end_year'), qOptions.getNumber('end_month') - 1, qOptions.getNumber('end_day')).getTime() / 1000;
        }
        else {
            END = getDaysAhead(today, endday);
        }
        END += qOptions.getNumber('end_hour') * 3600 + qOptions.getNumber('end_minute') * 60 + qOptions.getNumber('end_second');

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

        qChart.originalZoom = null;
    }


    function requestIfAllowed () {
        if (!document.hidden) {
            var request = '?_username=' + username + ';_password=' + password + ';start=' + requestStart + ';end=' + requestEnd + ';recursive=' + qOptions.recursive;
            ajaxGet(request, response, function () {    // on error, poll again
                timeoutHandle = setTimeout(requestIfAllowed, pollDelay);
            });
        }
    }


    this.update = function () {
        byId('zoom-out').style.display = 'none';

        calcTimeFrame();

        firstPoll = true;

        if (START >= qBase.minTime && END <= qBase.maxTime) {
            onResponse();
            return;    
        }
        //query what is missing
        else if (START < qBase.minTime && END >= qBase.minTime) {
            onResponse();
            requestStart = START;
            requestEnd = qBase.minTime;
        }
        //query what is missing
        else if (START <= qBase.maxTime && END > qBase.maxTime) {
            onResponse();
            requestStart = qBase.maxTime;
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
                hidePreloader();
            }
        }
        else {
            var updateEnd = +update.getAttribute('timestamp'),
                updateNotEmpty = qBase.add(update, requestStart, Math.min(requestEnd, updateEnd));

            if (firstPoll || updateNotEmpty) {
                onResponse();
            }

            firstPoll = false;
            hidePreloader();

            // Handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.
            today = getToday();
            if (today !== lastToday) {
                if (byId('startday').value === '0') {
                    START = getDaysAhead(START, 1);
                }
                if (byId('endday').value === '0') {
                    END = getDaysAhead(END, 1);
                }
            }
            lastToday = today;

            if (START >= END) {
                alert('Because start time was set for "Today", it became greater than end time after midnight. Stopping.');
                return;
            }

            if (END <= qBase.maxTime) {
                return;
            }

            requestStart = qBase.maxTime;
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
function QTable () {
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
            data = qBase.percTable();

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
        
        for (var i in qBase.colPos) {
            var newI = qBase.colPos[i];
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
                qBase.sort();
                qMenu.update();
            }
            else {
                qBase.filter();
            }
        });
        
        tr.addEventListener('dragstart', function (evt) {
            startTh = evt.target;
            startId = parseInt(startTh.id);
            startTh.style.opacity = 0.53;
            startTh.style.outline = '1px dashed white';
            evt.dataTransfer.effectAllowed = 'move';
            evt.dataTransfer.dropEffect = 'move';
        });

        tr.addEventListener('dragover', function (evt) {
            var target = evt.target;

            for (var i = 0, n = ths.length; i < n; i++) {
                var el = ths[i];
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
            for (var i = 0, n = ths.length; i < n; i++) {
                ths[i].style.opacity = '';
                startTh.style.outline = '';
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
                qBase.calculateColPos();
                qBase.filter();
            }
        });
    }

}
function QMenu (container) {
    this.type = (byId('type') && qOptions.get('type')) || 'table';

    var that = this,
        upToDate = [],
        zIndex = 2,
        slideIndex = TYPES.indexOf(this.type);


    var str = '';
    for (var i in TYPES) {
        str += '<slide' + (i !== '0' ? ' ondragstart="return false"' : ' style="z-index: 1"') + '></slide>';
    }

    container.innerHTML = str +
        '<div id="pie-chooser"></div><button id="zoom-out" onclick="qChart.resetZoom()" class="universal">Reset zoom</button>' +
        '<div id="zooming-overlay" ondragstart="return false"></div>';
    container.insertAdjacentHTML('afterend', '<section id="right-menu"><button id="go-table" onclick="qMenu.goTo(\'table\')"></button><button id="go-line" onclick="qMenu.goTo(\'line\')"></button><button id="go-bar" onclick="qMenu.goTo(\'bar\')"></button><button id="go-barstacked" onclick="qMenu.goTo(\'barstacked\')"></button><button id="go-pie" onclick="qMenu.goTo(\'pie\')"></button><button id="go-csv" onclick="qBase.downloadCSV()"></button><button id="go-png" onclick="qChart.downloadPNG()"></button></section>');

    var slides = container.children;


    this.goTo = function (nextType) {
        var slide = slides[slideIndex],
            nextSlideIndex = TYPES.indexOf(nextType),
            nextSlide = slides[nextSlideIndex];

        SLIDES[nextType] = nextSlide;
        
        if (nextSlideIndex !== slideIndex) {
            slide.style.opacity = 0;
            nextSlide.style.zIndex = zIndex++;
            nextSlide.style.opacity = 1;
            byId('go-' + this.type).className = '';

            qOptions.onFormDirty();
        }

        if (qChart.originalZoom && slideIndex !== nextSlideIndex) {
            slideIndex = nextSlideIndex;
            this.type = nextType;
       
            qChart.resetZoom();
            qBase.filter();
            return; // because filter will call goTo again
        }

        if (!upToDate[nextSlideIndex]) {
            if (nextType === 'table') {
                qTable.render(nextSlide);
            }
            else {
                qChart.render(nextType, nextSlide);
            }
        }
        upToDate[nextSlideIndex] = true;

        byId('go-png').disabled = (nextType === 'table');
        byId('pie-chooser').style.display = nextType === 'pie' ? 'block' : 'none';
        byId('go-' + nextType).className = 'active';

        slideIndex = nextSlideIndex;
        this.type = nextType;
        
        rightPanelEqHeight();
    };


    this.update = function () {
        upToDate = [];
        qChart.invalidate();
        this.goTo(this.type);
    };
}


var onWindowResize = {
    hndlr: 0,
    list: [],
    throttle: function (callback) {
        this.list.push(callback);
    }
};

window.addEventListener('resize', function () {
    var o = onWindowResize;
    if (!o.hndlr) {
        o.hndlr = setTimeout(function () {
            for (var i in o.list) {
                o.list[i]();
            }
            o.hndlr = 0;
        }, 100);
    }
});

onWindowResize.throttle(function () {
    if (qMenu.type === 'table') {
        qTable.resizeHeader();
    }
    else {
        qChart.resize();
    }
});

function byId (id) {
    return document.getElementById(id);
}


function getToday () {
    return Math.floor(new Date().setHours(0,0,0,0) / 1000);
}


function getDaysAhead (timestamp, days) {
    var date = new Date(timestamp * 1000);
    date.setDate(date.getDate() + days);
    return Math.floor(date / 1000);
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
        pos = qBase.colPos;
    for (var i in pos) {
        result.push(COLUMNS[pos[i]]);
    }
    return result;
}

document.addEventListener("DOMContentLoaded", function() {

    window.qOptions = new QOptions();
    window.qMenu = new QMenu(byId('left-content'));

    window.qBase = new QBase(qOptions.getColumns(), qOptions.getRows());

    window.qTable = new QTable();
    window.qChart = new QChart(byId('left-content'));

    window.qPolling = window.qsPolling = new QPolling(function () {
        qBase.filter();
    });

    byId('panel-open-button').innerHTML = '';

    // patch move_selected
    var savedMoveselect = move_selects;
    window.move_selects = function () {
        savedMoveselect.apply(window, arguments);
        qBase.filter();
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