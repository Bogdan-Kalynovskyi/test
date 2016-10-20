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
        chartArea = {
            left: '8%',
            right: '17%'
        },
        options = {
            linechart: {
                sliceVisibilityThreshold: 0,
                chartArea: chartArea
            },
            barchart: {
                sliceVisibilityThreshold: 0,
                chartArea: chartArea,
                bar: {groupWidth: "90%"}
            },
            stacked: {
                isStacked: true,
                sliceVisibilityThreshold: 0,
                chartArea: chartArea,
                bar: {groupWidth: "90%"}
            },
            piechart: {
                is3D: true,
                pieSliceText: 'label',
                sliceVisibilityThreshold: 0,
                chartArea: chartArea
            }
        };


    function centerPieSource () {
        var g = SLIDES.piechart.querySelectorAll('svg > g'),
            left = Infinity,
            right = 0;

        for (var i = (options.piechart.legend === null ? 1 : 0); i < g.length - 1; i++) {
            var rect = g[i].getBoundingClientRect();
            left = Math.min(left, rect.left);
            right = Math.max(right, rect.right);
        }

        rect = byId('left-content').getBoundingClientRect();
        byId('piechart-chooser').style.right = rect.right - right - left + rect.left + 1 + 'px';
    }


    container.addEventListener('mousedown', mousedown, true);
    container.addEventListener('mouseup', mouseup, true);
    container.addEventListener('wheel', mousewheel);
    byId('left-overlay').addEventListener('click', function () {
        move(-1);
    });
    byId('right-overlay').addEventListener('click', function () {
        move(1);
    });


    function pieSourceChooser () {
        if (!that.pieFilter) {
            var pieFilterSaved = byName('piesource');
            if (pieFilterSaved) {
                pieFilterSaved = pieFilterSaved.split('_');
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
        
        var str = 'Display:<label> column <select id="piechart-by-column"><option value="">Choose column</option>',
            visibleCols = qOpts.getColumns(),
            colPosLen = qBase.colPos.length + 1;
        
        for (var i in COLUMNS) {
            if (visibleCols[i]) {
                str += '<option value="' + i + '">' + COLUMNS[i] + '</option>';
            }
        }
        str += '</select></label><label> or row <select id="piechart-by-row"><option value="">Choose row</option>';
        for (i in table) {
            var row = table[i],
                totalVisible = 0;

            if (row.total) {
                var totalCallsPos = qBase.colPos.indexOf(0) + 1;

                for (var j = 1; j < colPosLen; j++) {
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
        byId('piechart-chooser').innerHTML = str;

        var byCol = byId('piechart-by-column'),
            byRow = byId('piechart-by-row');

        byCol.onchange = function () {
            if (this.value) {
                that.pieFilter = {
                    by: 'column',
                    id: this.value
                };
                byRow.value = '';
                pieDataTable = getPieDataTable();
                charts.piechart.draw(pieDataTable, options.piechart);
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
                charts.piechart.draw(pieDataTable, options.piechart);
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
        function setEmptyChart () {
            data = [['', ''], ['No calls', 1]];
            options.piechart.legend = 'none';
            options.piechart.enableInteractivity = false;
        }
        
        that.pieFilter.id = qOpts.get('piechart-by-column');
        that.pieFilter.by = 'column';
        if (!that.pieFilter.id) {
            that.pieFilter.id = qOpts.get('piechart-by-row');
            that.pieFilter.by = 'row';
        }
        var row,
            id = +that.pieFilter.id,
            data = [['??', '???']];              // in pieChart, first row seems not to send any useful information

        if (isNaN(id)) {                         // case when both selects are unset, or anything weird
            return;
        }
            
        options.piechart.legend = null;
        options.piechart.enableInteractivity = true;

        if (that.pieFilter.by === 'column') {
            var pos = qBase.colPos.indexOf(id) + 1,
                i = (!PERIOD && qOpts.getNum('allcalls')) ? 1 : 0,                // in Destination mode, don't show "All calls" in chart
                n = table.length - (PERIOD && qOpts.totalRow ? 1 : 0),            // in Time mode, don't show "Total" row
                totalVisible = 0;

                for (; i < n; i++) {
                row = table[i];
                if (row.total) {
                    totalVisible += row[pos];
                    data.push([row[0], row[pos]]);
                }
            }
            if (!totalVisible) {                                            // all cols should be given as an option, but they don't always contain data
                setEmptyChart();
            }
        }
        else {
            row = table[id];
            if (row.total) {                                              // this can be false if you save report and then data changes
                var tableHeading = getTableHeading(),
                    totalCallsPos = qBase.colPos.indexOf(0) + 1;
                
                for (i = 1, n = tableHeading.length; i < n; i++) {
                    if (i !== totalCallsPos) {
                        var i1 = qBase.colPos[i];
                        if ((i1 >= COL_timeStart && i1 <= COL_timeEnd) || i1 === COL_loggedIn) {
                            tableHeading[i] += ', seconds';
                        }
                        data.push([tableHeading[i], row[i]]);
                    }
                }
            }
            else {
                setEmptyChart();
            }
        }

        return google.visualization.arrayToDataTable(data);
    }


    function getDataTable () {
        var colPos = qBase.colPos,
            data = [getTableHeading()],
            j = 0,
            n = table.length - (PERIOD && qOpts.totalRow ? 1 : 0);            // in Time mode, don't show "Total" row

        for (; j < n; j++) {
            var row = table[j].slice();
            for (var i in colPos) {
                var i1 = colPos[i],
                    isTime = i1 >= COL_timeStart && i1 <= COL_timeEnd;
                if (isTime) {
                    row[i] = arrayPeriod(row[i]);
                }
                else if (i1 === COL_loggedIn) {
                    row[i] = arrayPeriod(row[i], 4);
                }
            }
            data.push(row);
        }

        return google.visualization.arrayToDataTable(data);
    }
    
    
    function setZoomBackup () {
        if (!that.originalZoom) {
            that.originalZoom = {
                start: START,
                end: END,
                startOpt: qOpts.get('startday'),
                endOpt: qOpts.get('endday'),
                period: PERIOD
            };
            resetZoom.style.display = 'block';
        }
    }
    
    
    function move (direction) {
        var leftTime = START,
            rightTime = Math.min(Date.now() / 1000, END),
            delta = (rightTime - leftTime) * 0.2 * direction;
        setZoomBackup();

        START += delta;
        END = rightTime + delta;

        qOpts.showNewTime();
        qBase.filter();
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
            setZoomBackup();

            var leftTime = START,
                rightTime = Math.min(Date.now() / 1000, END);

            START += (rightTime - leftTime) * (minX - window.scrollX - rectSVG.left) / rectSVG.width;
            END = rightTime - (rightTime - leftTime) * (rectSVG.right + window.scrollX - maxX) / rectSVG.width;
            PERIOD *= (END - START) / (rightTime - leftTime);

            qOpts.showNewTime();
            qBase.filter();

            container.onmousemove = null;
        }
        
        goodEvt = false;
        endX = undefined;
    }

    
    function mousewheel (evt) {
        var svgr = charts[qMenu.type] && charts[qMenu.type].svgr;
        if (svgr && (svgr === evt.target || svgr.contains(evt.target))) {
            setZoomBackup();
            
            var leftTime = START,
                rightTime = Math.min(Date.now() / 1000, END),
                rectSVG = svgr.getBoundingClientRect(),
                center = evt.pageX + window.scrollX,
                left = center - rectSVG.left,
                right = rectSVG.right - center,
                zoom = -0.2 * evt.deltaY / 100;

            START += (rightTime - leftTime) * left / rectSVG.width * zoom;
            END = rightTime - (rightTime - leftTime) * right / rectSVG.width * zoom;
            PERIOD *= (END - START) / (rightTime - leftTime) * (zoom > 0 ? 1.05 : 0.95);
            
            qOpts.showNewTime();
            qBase.filter();
            
            return false;
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
                        case 'linechart':
                            charts[type] = new google.visualization.LineChart(slide);
                            break;
                        case 'barchart':
                        case 'stacked':
                            charts[type] = new google.visualization.ColumnChart(slide);
                            break;
                        case 'piechart':
                            charts[type] = new google.visualization.PieChart(slide);
                            break;
                    }
                } 
                table = qBase.getData();

                if (type !== 'piechart') {
                    nonPieDataTable = nonPieDataTable || getDataTable();
                    charts[type].draw(nonPieDataTable, options[type]);
                    assignZoom(type, slide);
                }
                else {
                    pieSourceChooser();
                    pieDataTable = getPieDataTable();
                    charts.piechart.draw(pieDataTable, options.piechart);
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
            charts[type].draw(type === 'piechart' ? pieDataTable : nonPieDataTable, options[type]);
            if (type === 'piechart') {
                centerPieSource();
            }
            else {
                assignZoom(type, SLIDES[type]);
            }
        }
    };


    this.downloadPNG = function () {
        var fileName = (qOpts.get('name') || 'noname') + '.png';
        downloadUrl(charts[qMenu.type].getImageURI(), fileName);
    };


    this.resetZoom = function () {
        byId('zooming-overlay').style.display = 'none';
        var orig = this.originalZoom;
        START = orig.start;
        END = orig.end;
        PERIOD = orig.period;
        qOpts.showNewTime();
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

    TYPES = ['table', 'linechart', 'barchart', 'stacked', 'piechart'],
    SLIDES = {},

    DESTINATIONS = [
        'All calls',
        'External callers',
        'Internal callers',
        'External destinations'
    ],
    
    COLUMNS = [
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
        'Talk time min',
        'Talk time avg',
        'Talk time max',
        'Total time min',
        'Total time avg',
        'Total time max',
        'Abandoned by caller',
        'No agents available',
        'Time-out in queue',
        'Key press by caller',
        'Agent completed',
        'Caller completed',
        'Transfer by agent',
        'Logged in time'
    ],

    COL_timeStart = 13,
    COL_timeEnd = 22,
    COL_loggedIn = 30,
    
    REARRANGE = [];

for (PERIOD = 0; PERIOD < COLUMNS.length; PERIOD++) {  // here PERIOD is just counter, and will be changed later
    REARRANGE[PERIOD] = PERIOD;
}


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


    this.setVisibleCol = function (pos, value) {
        visibleCols[pos] = value;
        this.calculateColPos();
        this.filter();
    };


    this.setVisibleRow = function (pos, value) {
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


    function calcSecondaryCols (row) {
        var call,
            rowTotal = row.total,
            minhold = Infinity,
            avghold = 0,
            maxhold = 0,
            mintalk = Infinity,
            avgtalk = 0,
            maxtalk = 0,
            mintotal = Infinity,
            avgtotal = 0,
            maxtotal = 0,
            abandon = 0,
            noagent = 0,
            timeout = 0,
            keypress = 0,
            agent = 0,
            caller = 0,
            transfer = 0,
            answeredCount = 0;

        for (var i in row.calls) {
            call = row.calls[i];
            minhold = Math.min(minhold, call.hold);
            avghold += call.hold;
            maxhold = Math.max(maxhold, call.hold);
            if (call.answer) {
                mintalk = Math.min(mintalk, call.talk);
                avgtalk += call.talk;
                maxtalk = Math.max(maxtalk, call.talk);
                answeredCount++;
            }
            mintotal = Math.min(mintotal, call.total);
            avgtotal += call.total;
            maxtotal = Math.max(maxtotal, call.total);
            var q = call.queuestatus;
            if (q === 'abandon') {
                abandon++;
            } else if (q === 'exitempty') {
                noagent++;
            } else if (q === 'exitwithintimeout') {
                timeout++;
            } else if (q === 'exitwithkey') {
                keypress++;
            } else if (q === 'completeagent') {
                agent++;
            } else if (q === 'completecaler') {
                caller++;
            } else if (q === 'transfer') {
                transfer++;
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
        if (rowTotal) {
            avghold /= rowTotal;
            avgtalk = answeredCount ? avgtalk / answeredCount : 0;
            avgtotal /= rowTotal;
        }

        row.push(minhold, avghold, maxhold, mintalk, avgtalk, maxtalk, mintotal, avgtotal, maxtotal, abandon, noagent, timeout, keypress, agent, caller, transfer, '');
    }


    function reduceRow (row) {
        var result = [row[0]];

        calcSecondaryCols(row);
        for (var i in that.colPos) {
            result.push(row[that.colPos[i] + 1]);
        }
        result.total = row.total;

        return result;
    }


    this.getTable = function (csv) {
        var result = new Array(table.length),
            inserts = 0,
            i, j;

        for (i in table) {
            result[i] = table[i].slice();
        }
        
        for (j in this.colPos) {
            var i1 = this.colPos[j],
                j1 = +j + 1 + inserts;

            if (visibleCols[i1] === 2 || (i1 >= COL_timeStart && i1 <= COL_timeEnd) || (i1 === COL_loggedIn)) { // todo cache
                for (i in result) {
                    var tblRow = table[i],
                        row = result[i],
                        perc;

                    if (i1 >= COL_timeStart && i1 <= COL_timeEnd) {
                        row[j1] = formatPeriod(row[j1], true);
                    }
                    else if (i1 === COL_loggedIn) {
                        if (row[j1]) {
                            row[j1] = formatPeriod(row[j1]);
                        }
                    }

                    if (visibleCols[i1] === 2) {
                        if (i1 === COL_loggedIn) {
                            perc = tblRow[+j + 1] ? Math.round(100 * tblRow[+j + 1] / (END - START)) : '';
                        }
                        else {
                            perc = tblRow.total ? Math.round(100 * tblRow[+j + 1] / tblRow.total) : '';
                        }

                        if (csv) {
                            row.splice(j1, 0, perc);
                            inserts++;
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
        }

        return result;
    };


    this.getData = function () {
        if (!table.length) {
            return new Array(this.colPos.length).fill(0).unshift('');
        }
        else {
            return table.slice();
        }
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

        var data = qBase.getTable(true);
        for (i in data) {
            str += data[i].join(',') + '\n';
        }

        var fileName = (qOpts.get('name') || 'noname') + '.csv',
            csvBlob = new Blob([str], {type: 'text/csv;charset=utf-8;'});

        downloadBlob(fileName, csvBlob);
    };




    function newRow () {
        var row = new Array(COL_timeStart + 1).fill(0);
        row.total = 0;
        row.calls = [];
        return row;
    }


    function add2MultiRow (row, multiRow) {
        for (var i = 1, n = row.length; i < n; i++) {
            multiRow[i] += row[i];
        }
        multiRow.total += row.total;
        multiRow.calls = multiRow.calls.concat(row.calls);
    }


    function add2TableOrMultiRow (display, row, multiRow) {
        if (visibleRows[display]) {
            if (multiRow) {
                add2MultiRow(row, multiRow);
            }
            else {
                var tblRow = table[rowPos[display]];
                
                tblRow.total++;
                tblRow.calls = tblRow.calls.concat(row.calls);
                for (var i = 1, n = row.length; i < n; i++) {
                    tblRow[i] += row[i];
                }
            }
        }
    }


    function decode (call, multiRow, justAppend) {
        var stype = call.stype,
            dtype = call.dtype,
            answered = call.answer,
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
        row.calls.push(call);

        // total calls
        row[1]++;
        // sla time
        if (answered && (answered - call.start <= qOpts.slaTime)) {
            row[2]++;
        }
        // answered
        if (answered) {
            row[3]++;
        }
        // not answered
        if (!answered) {
            row[4]++;
        }
        // inbound calls
        isInbound = stype === external || stype === local;
        if (isInbound) {
            row[5]++;
        }
        // inbound answered
        if (isInbound && answered) {
            row[6]++;
        }
        // inbound no answer
        if (isInbound && !answered) {
            row[7]++;
        }
        // internal calls
        isInternal = stype !== external && stype !== local && dtype != external && dtype !== local;
        if (isInternal) {
            row[8]++;
        }
        // internal answered
        if (isInternal && answered) {
            row[9]++;
        }
        // internal no answer
        if (isInternal && !answered) {
            row[10]++;
        }
        // outbound
        isOutbound = dtype === external || dtype === local;
        if (isOutbound) {
            row[11]++;
        }
        // outbound answered
        if (isOutbound && answered) {
            row[12]++;
        }
        // outbound no answer
        if (isOutbound && !answered) {
            row[13]++;
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
            call.start = +call.getAttribute('start');
            call.answer = +call.getAttribute('answered');
            call.end = +call.getAttribute('end');
            call.dtype = call.getAttribute('dtype');
            call.stype = call.getAttribute('stype');
            call.dnumber = call.getAttribute('dnumber');
            call.snumber = call.getAttribute('snumber');
            call.queuestatus = call.getAttribute('queuestatus');
            call.hold = call.answer ? call.answer - call.start : call.end - call.start;
            call.talk = call.answer ? call.end - call.answer : 0;
            call.total = call.end - call.start;
            calls.push(call);
            notEmpty = true;
        }
        if (notEmpty) {
            calls.sort(byEnd);
        }

        function cacheFields (call) {
            call.name = call.getAttribute('name');
            call.description = call.getAttribute('description');
            call.callerid = call.getAttribute('callerid_internal');
        }
        
        
        //todo this change detection scheme is wrong
        for (i = 0, n = _queues.length; i < n; i++) {
            var queue = _queues[i];
            if (!queues[queue.id]) {
                queue.name = queue.getAttribute('name');
                queues[queue.id] = queue;
                notEmpty = true;
            }
        }

        for (i = 0, n = _agents.length; i < n; i++) {
            var agent = _agents[i];
            if (!agents[agent.id]) {
                cacheFields(agent);
                agent.dtype = agent.getAttribute('dtype');
                agent.dnumber = agent.getAttribute('dnumber');
                agent.loggedtime = +agent.getAttribute('loggedtime');
                agents[agent.id] = agent;
                notEmpty = true;
            }
            else {
                agents[agent.id].loggedtime += +agent.getAttribute('loggedtime');
            }
        }

        for (i = 0, n = _phones.length; i < n; i++) {
            var phone = _phones[i],
                name = phone.getAttribute('name');
            if (!phones[name]) {
                cacheFields(phone);
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
        var n = that.colPos.length + 1,
            total = 0;

        if (PERIOD && qOpts.totalRow) {
            var colSum = new Array(that.colPos.length + 1).fill(0);
            colSum[0] = 'Total';
        }

        for (var i in table) {
            var row = reduceRow(table[i]);
            table[i] = row;
            if (PERIOD && qOpts.totalRow) {
                for (var j = 1; j < n; j++) {
                    colSum[j] += row[j];
                }
                total += row.total;
            }
        }
        if (PERIOD && qOpts.totalRow) {
            for (j = 1; j < n; j++) {
                var j1 = that.colPos[j];
                if (j1 >= COL_timeStart && j1 <= COL_timeEnd) {
                    colSum[j] /= table.length;
                }
            }
            colSum.total = total;
            table.push(colSum);
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
            dateFormat = qOpts.config('dateformat'),
            timeFormat = qOpts.config('timeformat');
 
        if ((END - START) / PERIOD > Math.max(900, window.innerWidth - 390)) {
            alert('Too many rows to display. Please set bigger time period.');
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
            timeFormat = qOpts.config('timeformat'),
        
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
            startDayOfWeek = new Date(START * 1000).getDay(),
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
        var destinations = ['queues', 'agents', 'phones'],
            phoneDisplay = qOpts.get('phonetitle');

        for (var d in destinations) {
            var dest = destinations[d],
                ids = [],
                arr,
                destDisplay = qOpts.get(dest),
                i, j, n;

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

            if (destDisplay === 'use_include') {
                var options = byId(dest + 'include_selected').options;
                for (i = 0, n = options.length; i < n; i++) {
                    ids.push(options[i].value);
                }
            }
            else {
                for (i in arr) {
                    if (destDisplay !== 'use_control_panel' || arr[i].getAttribute('panel') === '1') {
                        ids.push(i);
                    }
                }
            }

            for (j in ids) {
                var call,
                    id = ids[j],
                    el = arr[id],
                    name,
                    match,
                    row = newRow();

                if (!multiRow) {
                    switch (dest) {
                        case 'queues':
                            row[0] = 'Queue: ' + el.name;
                            break;
                        case 'agents':
                        case 'phones':
                            switch (phoneDisplay) {
                                case 'name':
                                    name = el.name;
                                    break;
                                case 'description':
                                    name = el.description || el.name;
                                    break;
                                case 'internal':
                                    name = el.callerid;
                                    break;
                                case 'name_description':
                                    name = el.name + ' ' + (el.description || el.name);
                                    break;
                                case 'internal_description':
                                    name = el.callerid + ' ' + (el.description || el.name);
                                    break;
                                case 'description_name':
                                    name = (el.description || el.name) + ' ' + el.name;
                                    break;
                                case 'description_internal':
                                    name = (el.description || el.name) + ' ' + el.callerid;
                                    break;
                            }
                            if (dest === 'agents') {
                                row[0] = 'Queue agent: ' + name;
                            }
                            else {
                                row[0] = 'Ext: ' + name;
                            }
                            break;
                    }
                }

                for (i in filteredCalls) {
                    call = filteredCalls[i];

                    switch (dest) {
                        case 'queues':
                            match = call.dtype === 'queue' && call.dnumber === id;
                            break;

                        case 'agents':
                            match = call.stype === 'queue' && call.dnumber === el.dnumber && call.dtype === el.dtype;
                            break;

                        case 'phones':
                            match = (call.stype === 'phone' && call.snumber === id) || (call.dtype === 'phone' && call.dnumber === id);
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

                if (PERIOD === 0 && dest === 'agents' && visibleCols[visibleCols.length - 1]) {
                    row = multiRow || table[table.length - 1];
                    row[that.colPos.indexOf(visibleCols.length - 1) + 1] = el.loggedtime;
                }
            }
        }
    }


    this.filter = function () {
        table = [];

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
            'talkmin',
            'talkavg',
            'talkmax',
            'totalmin',
            'totalavg',
            'totalmax',
            'abandon',
            'noagent',
            'timeout',
            'keypress',
            'agent',
            'caller',
            'transfer',
            'logintime'
        ],
        destControls = [
            'allcalls',
            'inbound',
            'internal',
            'outbound'
        ],
        filterControls = [
            'phonetitle',
            'slatime',
            'totalrow',
            'queues',
            'agents',
            'phones',
            'queuesinclude',
            'agentsinclude',
            'phonesinclude'
        ],
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

        byId('slatime').addEventListener('change', function () {
            that.slaTime = +this.value;
        });
        byId('totalrow').addEventListener('change', function () {
            that.totalRow = +this.value;
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
                qBase.setVisibleCol(pos, +this.value);
                preventScroll();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                qBase.setVisibleRow(pos, +this.value);
                preventScroll();
            });
        }
        for (i in filterControls) {
            byId(filterControls[i]).addEventListener('change', function () {
                qBase.filter();
                preventScroll();
            });
        }
        
        byId('period').addEventListener('change', function () {
            PERIOD = +this.value;
            byId('heading_rows').innerHTML = PERIOD ? 'Sum of destinations:' : 'Display destinations:';
            var showMoveLeftRight = (PERIOD <= 0 || qMenu.type === 'table' || qMenu.type === 'piechart') ? 'none' : 'block';
            byId('left-overlay').style.display = showMoveLeftRight;
            byId('right-overlay').style.display = showMoveLeftRight;
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
            result[i] = +this.get(columnControls[i]);
        }
        return result;
    };


    this.getRows = function () {
        var result = [];
        for (var i in destControls) {
            result[i] = +this.get(destControls[i]);
        }
        return result;
    };

    
    this.config = function (field) {
        return document['settings'][field].value;
    };


    this.get = function (id) {
        return byId(id).value;
    };
    this.getNum = function (id) {
        return +byId(id).value;
    };


    PERIOD = this.getNum('period');
    this.recursive = +byName('recursive');
    this.slaTime = +this.get('slatime');
    this.totalRow = +this.get('totalrow');


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
                if (qOpts.get(arr[i]) === 'use_include') {
                    var options = byId(arr[i] + 'include_selected').options;
                    for (var j = options.length - 1; j >= 0; j--) {
                        options[j].selected = mark;
                    }
                }
            }
        }


        if (!qOpts.get('name')) {
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
            form[0].piesource.value = qChart.pieFilter.by + '_' + qChart.pieFilter.id;
        }
        form[0].type.value = qMenu.type;

        $.post(form.attr('action'), form.serialize(), function (response) {
            var id = response.getElementsByTagName('return')[0].id;
            form[0].id.value = id;
            window.history.pushState('', form[0].name, '//' + location.host + location.pathname + '?id=' + id);
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
        username = qOpts.config('username'),
        password = qOpts.config('password'),
        xhr,
        preloaderShown,
        today,
        lastToday,
        requestStart,
        requestEnd,
        firstPoll,
        timeoutHandle,
        pollDelay = +qOpts.config('refresh');


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

        var startday = qOpts.getNum('startday');
        if (startday === 1) {
            START = new Date(qOpts.getNum('start_year'), qOpts.getNum('start_month') - 1, qOpts.getNum('start_day')).getTime() / 1000;
        }
        else {
            START = getDaysAhead(today, startday);
        }
        START += qOpts.getNum('start_hour') * 3600 + qOpts.getNum('start_minute') * 60 + qOpts.getNum('start_second');

        var endday = qOpts.getNum('endday');
        if (endday == 1) {
            END = new Date(qOpts.getNum('end_year'), qOpts.getNum('end_month') - 1, qOpts.getNum('end_day')).getTime() / 1000;
        }
        else {
            END = getDaysAhead(today, endday);
        }
        END += qOpts.getNum('end_hour') * 3600 + qOpts.getNum('end_minute') * 60 + qOpts.getNum('end_second');

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
            var request = '?_username=' + username + ';_password=' + password + ';start=' + requestStart + ';end=' + requestEnd + ';recursive=' + qOpts.recursive;
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
                if (qOpts.get('startday') === '0') {
                    START = getDaysAhead(START, 1);
                }
                if (qOpts.get('endday') === '0') {
                    END = getDaysAhead(END, 1);
                }
            }
            lastToday = today;

            if (START >= END) {
                alert('Because start_time was set for "Today", it became greater than end_time after midnight. Stopping.');
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
            data = qBase.getTable();

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
        } while (fontSize && containerWidth < table.clientWidth);
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
            startTh.style.opacity = 0.5;
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
    this.type = byName('type') || 'table';

    var that = this,
        upToDate = [],
        zIndex = 1,
        slideIndex = TYPES.indexOf(this.type);


    var str = '';
    for (var i in TYPES) {
        str += '<slide style="z-index: ' + (i === '0' ? 1 : 0) + '"></slide>';
    }

    container.innerHTML = str +
        '<div id="piechart-chooser"></div><button id="zoom-out" onclick="qChart.resetZoom()" class="universal">Reset chart</button>' +
        '<div id="zooming-overlay" ondragstart="return false"></div><div id="left-overlay">&#10096;</div><div id="right-overlay">&#10097;</div>';
    container.insertAdjacentHTML('afterend', '<section id="right-menu"><button id="go-table" onclick="qMenu.goTo(\'table\')"></button><button id="go-linechart" onclick="qMenu.goTo(\'linechart\')"></button><button id="go-barchart" onclick="qMenu.goTo(\'barchart\')"></button><button id="go-stacked" onclick="qMenu.goTo(\'stacked\')"></button><button id="go-piechart" onclick="qMenu.goTo(\'piechart\')"></button><button id="go-csv" onclick="qBase.downloadCSV()"></button><button id="go-png" onclick="qChart.downloadPNG()"></button></section>');

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

            qOpts.onFormDirty();
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
        byId('piechart-chooser').style.display = nextType === 'piechart' ? 'block' : 'none';
        byId('go-' + nextType).className = 'active';
        var showMoveLeftRight = (PERIOD <= 0 || nextType === 'table' || nextType === 'piechart') ? 'none' : 'block';
        byId('left-overlay').style.display = showMoveLeftRight;
        byId('right-overlay').style.display = showMoveLeftRight;

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

var hndlr;
window.addEventListener('resize', function () {
    clearTimeout(hndlr);
    
    hndlr = setTimeout(function () {
        if (qMenu.type === 'table') {
            qTable.resizeHeader();
        }
        else {
            qChart.resize();
        }
    }, 100);
});


function byId (id) {
    return document.getElementById(id);
}

function byName (id) {
    return document.getElementsByName(id)[0].value;
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


function formatPeriod (period, alwaysShowHours) {
    var time = Math.floor(period / DAY),
        str = '';

    if (time) {
        str = pad(time) + ':';
    }
    time = Math.floor((period % DAY) / 3600);
    if (time || str || alwaysShowHours) {
        str += pad(time) + ':';
    }
    time = Math.floor((period % 3600) / 60);
    if (time || str) {
        str += pad(time) + ':';
    }
    time = Math.round(period % 60);
    str += pad(time);
    return str;
}


function arrayPeriod (period, length) {
    var result = [];

    if (length === 4) {
        result.push(Math.floor(period / DAY));
    }

    result.push(Math.floor((period % DAY) / 3600), Math.floor((period % 3600) / 60), Math.round(period % 60));
    return result;
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

    window.qOpts = new QOptions();
    window.qMenu = new QMenu(byId('left-content'));

    window.qBase = new QBase(qOpts.getColumns(), qOpts.getRows());

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