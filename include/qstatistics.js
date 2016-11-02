function QAgentEvents () {
    var events = [];            // should be sorted


    // Sort array of objects by .time
    function byTime (a, b) {
        if (a.time > b.time) {
            return 1;
        }
        else if (a.time < b.time) {
            return -1;
        }
        else {
            return 0;
        }
    }


    // Takes htmlNodesCollection and adds them to sorted array. Checks for duplicates. Returns whether array was changed
    this.add = function (nodes) {
        var isChanged = false;
        
        for (var i = 0, n = nodes.length; i < n; i++) {
            var node = nodes[i],
                event = {
                    time: +node.getAttribute('time'),
                    isLogged: node.getAttribute('type') === 'agentlogin'
                };

            for (var j in events) {
                if (events[j].time === event.time && events[j].isLogged === event.isLogged) {
                    event = null;
                    break;
                }
            }

            if (event) {
                events.push(event);
                isChanged = true;
            }
        }
        
        if (isChanged) {
            events.sort(byTime);
        }
        
        return isChanged;
    };


    // Calculates logged in time in period between periodStart and periodEnd.
    // Tricky thing is to group events into login-logout pairs.
    this.calcLoggedTime = function (periodStart, periodEnd) {
        var start,              // start and end of logged in period,
            end,                // is composed out of a pair of events.
            clear,              // marker that we're done with current start-end pair, so start over again 
            i = 0,
            n = events.length,
            total = 0;

        // when first event is logoff, and it is inside bounds, then virtually add login event before it
        if (n && !events[0].isLogged && events[0].time >= periodStart) {           
            start = periodStart;
        }

        while (i < n) {
            clear = false;
            
            if (events[i].isLogged) {
                start = events[i].time;
            }
            else {
                end = events[i].time;
            }
            
            if (end <= periodStart) {                           // completely out of bounds 
                clear = true;
            }
            else if (start && end) {                            // gathered a pair, which is at least partially in bounds
                total += Math.min(periodEnd, end) - Math.max(periodStart, start);
                clear = true;
            }

            if (start > periodEnd || end > periodEnd) {         // no more pairs in bounds, because array is sorted
                break;
            }
            if (clear) {                                        // clear that pair, and search for a new one
                start = undefined;
                end = undefined;
            }

            i++;
        }
        
        if (start && start < periodEnd && !end) {               // unfinished pair in bounds, agent is still logged in 
            total += Math.min(Date.now() / 1000, periodEnd) - Math.max(periodStart, start);
        }

        return total;
    }; 
    
    
    // queue agent is currently logged in
    this.isLoggedIn = function () {
        var n = events.length;
        if (n) {
            return events[n - 1].isLogged;
        }  
        else {
            return false;
        }
    };
}


function QChart (container) {
    var that = this,
        dbTable,
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
        blockRefresh,
        chartArea = {
            top: 32,
            left: '8%',
            right: '16%'
        },
        chartOptions = {
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

        for (var i = (chartOptions.piechart.legend === null ? 1 : 0); i < g.length - 1; i++) {
            var rect = g[i].getBoundingClientRect();
            left = Math.min(left, rect.left);
            right = Math.max(right, rect.right);
        }

        rect = byId('left-content').getBoundingClientRect();
        byId('piechart-chooser').style.right = rect.right - right - left + rect.left + 12 + 'px';
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


    function renderPieSourceSelect () {
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
            colPosLen = qDB.colPos.length + 1;
        
        for (var i in COLUMNS) {
            if (visibleCols[i]) {
                str += '<option value="' + i + '">' + COLUMNS[i] + '</option>';
            }
        }
        str += '</select></label><label> or row <select id="piechart-by-row"><option value="">Choose row</option>';
        for (i in dbTable) {
            var row = dbTable[i],
                totalVisible = 0;

            if (row.total) {
                var totalCallsPos = qDB.colPos.indexOf(0) + 1;

                for (var j = 1; j < colPosLen; j++) {
                    if (j !== totalCallsPos) {
                        totalVisible += row[j];
                    }
                }

                if (totalVisible) {
                    str += '<option value="' + i + '">' + dbTable[i][0] + '</option>';
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
                renderPieChart();
            }
        };
        byRow.onchange = function () {
            if (this.value) {
                that.pieFilter = {
                    by: 'row',
                    id: this.value
                };
                byCol.value = '';
                renderPieChart();
            }
        };
        byCol.onfocus = byRow.onfocus = function () {
            blockRefresh = true;
            setTimeout(function () {
                blockRefresh = false;
            }, 60000);
        };
        byCol.onblur = byRow.onblur = function () {
            blockRefresh = false;
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


    function cacheTableHeader (pieChartRow, pieChartCol) {
        var colPos = qDB.colPos,
            loggedInPos = colPos.indexOf(COL_loggedIn) + 1,
            maxNum = 0,
            maxLoggedIn = 0;

        // when table row is displayed as pie chart
        if (pieChartRow !== undefined) {
            for (var j in colPos) {
                var pos = colPos[j],
                    el = dbTable[pieChartRow][+j + 1];

                if (pos === COL_loggedIn) {
                    maxLoggedIn = Math.max(maxLoggedIn, el);
                }
                else {
                    maxNum = Math.max(maxNum, el);
                }
            }
            loggedInTimeDivider = maxLoggedIn / maxNum * 20;
        }
        // when logged in time column is displayed 
        else if (pieChartCol) {
            for (var i = 0, n = dbTable.length - (PERIOD && qOpts.totalRow ? 1 : 0); i < n; i++) {
                maxLoggedIn += dbTable[i][loggedInPos];
            }    
            loggedInTimeDivider = maxLoggedIn / n;
        }
        // other cases
        else {
            loggedInTimeDivider = qDB.maxLoggedIn / qDB.maxNum * 20;
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

        tableHeader = [PERIOD ? 'Time' : 'Destination'];

        if (!pieChartCol) {
            for (i in colPos) {
                tableHeader.push(COLUMNS[colPos[i]] + ((+i + 1 === loggedInPos) ? timeUnit : ''));
            }
        }
    }


    function getPieDataTable () {
        function setEmptyChart () {
            data = [['', ''], ['No calls', 1]];
            chartOptions.piechart.legend = 'none';
            chartOptions.piechart.enableInteractivity = false;
        }
        
        that.pieFilter.id = qOpts.get('piechart-by-column');
        that.pieFilter.by = 'column';
        
        if (that.pieFilter.id === '') {
            that.pieFilter.id = qOpts.get('piechart-by-row');
            that.pieFilter.by = 'row';
        }
        
        if (that.pieFilter.id === '') {
            that.pieFilter.by = 'column';
            that.pieFilter.id = 0;
            byId('piechart-by-column').value = 0;
        }
        
        var row,
            id = +that.pieFilter.id,
            data = [['', '']];                        // in pieChart, first row seems not to have any useful information
            
        chartOptions.piechart.legend = null;
        chartOptions.piechart.enableInteractivity = true;

        if (that.pieFilter.by === 'column') {
            cacheTableHeader(undefined, id === COL_loggedIn);
            var pos = qDB.colPos.indexOf(id) + 1,
                i = (!PERIOD && +qOpts.get('allcalls')) ? 1 : 0,                 // in Destination mode, don't show "All calls" in chart
                n = dbTable.length - (PERIOD && qOpts.totalRow ? 1 : 0),           // in Time mode, don't show "Total" row
                totalVisible = 0;

            for (; i < n; i++) {
                row = dbTable[i];
                totalVisible += row[pos];
                if (id !== COL_loggedIn) {
                    if (row.total) {
                        data.push([row[0], row[pos]]);
                    }
                }
                else {
                    if (row[pos] || row.isAgent) {
                        data.push([row[0] + timeUnit, +(row[pos] / loggedInTimeDivider).toFixed(2)]);
                    }
                }
            }
            if (!totalVisible) {                                            // all cols should be given as an option, but they don't always contain data
                setEmptyChart();
            }
        }
        else {
            if (dbTable[id].total) {                                         // this can be false if you save report and then data changes
                cacheTableHeader(id);
                row = dbTable[id];
                var totalCallsPos = qDB.colPos.indexOf(0) + 1,
                    loggedInPos = qDB.colPos.indexOf(COL_loggedIn) + 1;
                
                for (i = 1, n = tableHeader.length; i < n; i++) {
                    if (i !== totalCallsPos) {
                        if (i !== loggedInPos) {
                            data.push([tableHeader[i], row[i]]);
                        }
                        else {
                            data.push([tableHeader[i], +(row[i] / loggedInTimeDivider).toFixed(2)]);
                        }
                    }
                }
            }
            else {
                setEmptyChart();
            }
        }

        return google.visualization.arrayToDataTable(data);
    }


    function getDataTable (type) {
        cacheTableHeader();
        var colPos = qDB.colPos,
            data = [tableHeader],
            hasNumericCols = false,
            hasDurationCols = false,
            cols = [],
            j = 0,
            n = dbTable.length - (PERIOD && qOpts.totalRow ? 1 : 0);            // in Time mode, don't show "Total" row

        for (; j < n; j++) {
            var row = dbTable[j].slice();
            for (var i in colPos) {
                var i1 = colPos[i],
                    j1 = +i + 1,
                    isTime = i1 >= COL_timeStart && i1 < COL_timeEnd;
                
                if (isTime) {
                    row[j1] = arrayPeriod(row[j1]);
                }
                else if (i1 === COL_loggedIn) {
                    row[j1] = +(row[j1] / loggedInTimeDivider).toFixed(2);
                }

                // once, check for column types
                if (j === 0) {
                    if (isTime) {
                        hasDurationCols = true;
                        cols.push(1);
                    }
                    else {
                        hasNumericCols = true;
                        cols.push(0);
                    }
                }
            }
            
            // then reflect col types in options
            if (j === 0) {
                if (hasNumericCols && hasDurationCols) {
                    var series = {};
                    for (i in colPos) {
                        series[i] = {targetAxisIndex: cols[i]};
                    }
                    chartOptions[type].vAxes = {
                        0: {},
                        1: {}
                    };
                    chartOptions[type].series = series;
                }
                else {
                    delete chartOptions[type].vAxes;
                    delete chartOptions[type].series; 
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
            resetZoomBtn.style.display = 'block';
        }
    }
    
    
    function move (direction) {
        var leftTime = START,
            rightTime = Math.min(Date.now() / 1000, END),
            delta = (rightTime - leftTime) * 0.1 * direction;
        setZoomBackup();

        START += delta;
        END = rightTime + delta;

        qOpts.showNewTime();
        qDB.filter();
    }
    

    function mousedown (evt) {
        var svgr = charts[qMenu.type] && charts[qMenu.type].svgr;
        goodEvt = svgr && (svgr === evt.target || svgr.contains(evt.target));
        
        if (goodEvt) {
            rectSVG = svgr.getBoundingClientRect();
            startX = evt.pageX;
            zoomingOverlay.style.top = rectSVG.top + 'px';
            zoomingOverlay.style.bottom = document.body.clientHeight - rectSVG.bottom + 'px';
            zoomingOverlay.style.left = startX - window.scrollX + 'px';
            zoomingOverlay.style.right = document.body.clientWidth + window.scrollX - startX + 'px';
            zoomingOverlay.style.display = 'block';
            container.onmousemove = mousemove;
        }
    }


    function mousemove (evt) {
        endX = evt.pageX;
        zoomingOverlay.style.top = rectSVG.top + 'px';
        zoomingOverlay.style.bottom = document.body.clientHeight - rectSVG.bottom + 'px';
        zoomingOverlay.style.left = Math.min(startX, endX) - window.scrollX + 'px';
        zoomingOverlay.style.right = document.body.clientWidth + window.scrollX - Math.max(startX, endX) + 'px';
    }

    
    function mouseup () {
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

            START += (rightTime - leftTime) * (minX - window.scrollX - rectSVG.left) / rectSVG.width;
            END = rightTime - (rightTime - leftTime) * (rectSVG.right + window.scrollX - maxX) / rectSVG.width;
            PERIOD = that.originalZoom.period * (Math.min(now, END) - START) / (Math.min(now, that.originalZoom.end) - that.originalZoom.start);

            qOpts.showNewTime();
            qDB.filter();

            container.onmousemove = null;
        }
        
        endX = null;
    }

    
    function mousewheel (evt) {
        var svgr = charts[qMenu.type] && charts[qMenu.type].svgr;
        if (svgr && evt.deltaY && (svgr === evt.target || svgr.contains(evt.target))) {
            setZoomBackup();
            
            var now = Date.now() / 1000,
                leftTime = START,
                rightTime = Math.min(now, END),
                rectSVG = svgr.getBoundingClientRect(),
                center = evt.pageX + window.scrollX,
                left = center - rectSVG.left,
                right = rectSVG.right - center,
                zoom = -0.2 * evt.deltaY / 100;

            START += (rightTime - leftTime) * left / rectSVG.width * zoom;
            END = rightTime - (rightTime - leftTime) * right / rectSVG.width * zoom;
            PERIOD = that.originalZoom.period * (Math.min(now, END) - START) / (Math.min(now, that.originalZoom.end) - that.originalZoom.start);
            
            qOpts.showNewTime();
            qDB.filter();
            
            evt.preventDefault();
            return false;
        }
    }

    
    function assignZoom (type) {
        if (PERIOD > 0) {
            var svgr = SLIDES[type].getElementsByTagName('svg');
            if (svgr) {
                svgr = svgr[0].children[3].children[0];
                svgr.style.cursor = 'col-resize';
                charts[type].svgr = svgr;
            }
        }
    }


    function renderChart (type) {
        dataTable = getDataTable(type);
        charts[type].draw(dataTable, chartOptions[type]);
        assignZoom(type);
    }


    function renderPieChart () {
        dataTable = getPieDataTable();
        charts.piechart.draw(dataTable, chartOptions.piechart);
        centerPieSource();
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
                dbTable = qDB.getData();
              
                if (type === 'piechart') {
                    if (!blockRefresh) {
                        renderPieSourceSelect();
                    }
                    renderPieChart();
                }
                else {
                    renderChart(type);
                }

                eqHeight();
            });
        }
    };


    this.resize = function () {
        var type = qMenu.type;
        if (charts[type]) {
            charts[type].draw(dataTable, chartOptions[type]);
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
        var orig = this.originalZoom;
        if (orig) {
            START = orig.start;
            END = orig.end;
            PERIOD = orig.period;
            qOpts.showNewTime();
            byId('startday').value = orig.startOpt;
            byId('endday').value = orig.endOpt;
            this.originalZoom = null;
            resetZoomBtn.style.display = 'none';
            qDB.filter();
        }
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
        'Internal call legs',
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
    COL_loggedIn = 29,
    
    REARRANGE = [];

for (PERIOD = 0; PERIOD < COLUMNS.length; PERIOD++) {  // here PERIOD is just counter, and will be changed later
    REARRANGE[PERIOD] = PERIOD;
}


function QDataBase (visibleCols, visibleRows) {
    var that = this,
        calls,
        queues,
        agents,
        phones,
        rowPos,
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
        if (PERIOD && qOpts.totalRow) {
            var totalRow = table.pop();
        }
        if (qTable.sortingCol > 0) {
            table.sort(byCol(this.colPos.indexOf(qTable.sortingCol - 1) + 1, qTable.sortingOrder));
        }
        else if (qTable.sortingOrder === -1) {
            table.reverse();
        }
        if (PERIOD && qOpts.totalRow) {
            table.push(totalRow);
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


    this.getTable = function (csv) {
        var result = new Array(table.length),
            inserts = 0,
            i, j;

        for (i in table) {
            result[i] = table[i].slice();
        }
        
        for (j in this.colPos) {
            var i1 = this.colPos[j], 
                j0 = +j + 1,
                j1 = j0 + inserts,
                withPercentage = visibleCols[i1] === 2,
                time = i1 >= COL_timeStart && i1 < COL_timeEnd,
                loggedInCol = i1 === COL_loggedIn;

            if (withPercentage || time || loggedInCol) {
                for (i in result) {
                    var row = result[i],
                        perc;

                    if (time) {
                        row[j1] = formatPeriod(row[j1], 3);
                    }
                    else if (loggedInCol) {
                        row[j1] = (PERIOD || table[i].isAgent) ? formatPeriod(row[j1], 4) : '';
                    }

                    if (withPercentage) {
                        var tblRow = table[i];
                        if (loggedInCol) {
                            perc = (PERIOD || tblRow[j0] || tblRow.isAgent) ? Math.round(100 * tblRow[j0] / (tblRow.totalTime || Infinity)) : '';
                        }
                        else {
                            perc = tblRow.total ? Math.round(100 * tblRow[j0] / tblRow.total) : '';
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
    };


    this.getData = function () {
        if (!table.length) {
            debugger;
            return new Array(this.colPos.length).fill(0).unshift('');
        }
        else {
            return table;
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

        var data = qDB.getTable(true);
        for (i in data) {
            str += data[i].join(',') + '\n';
        }

        var fileName = (qOpts.get('name') || 'noname') + '.csv',
            csvBlob = new Blob([str], {type: 'text/csv;charset=utf-8;'});

        downloadBlob(fileName, csvBlob);
    };




    function newRow () {
        var row = new Array(COL_timeStart + 1 + (visibleCols[COL_loggedIn] ? 1 : 0)).fill(0);
        row.total = 0;
        row.calls = [];
        row.queueCalls = [];
        row.isAgent = false;
        return row;
    }


    function add2TableOrMultiRow (rowIndex, row, multiRow) {
        if (visibleRows[rowIndex]) {
            var i = 1,
                n = row.length;

            multiRow = multiRow || table[rowPos[rowIndex]];

            for (; i < n; i++) {
                multiRow[i] += row[i];
            }
            multiRow.total += row.total;
            multiRow.calls = multiRow.calls.concat(row.calls);
        }
    }


    function decode (call, multiRow, dontAddToMultipleRows) {
        var stype = call.stype,
            dtype = call.dtype,
            answered = call.answer,
            external = 'external',
            local = 'local',
            isInbound,
            isInternal,
            isOutbound,
            row;

        if (dontAddToMultipleRows) {
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
        if (answered && (call.hold <= qOpts.slaTime)) {
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
        
        if (!dontAddToMultipleRows) {
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
        var newCalls = update.getElementsByTagName('call');
        var newQueues = update.getElementsByTagName('queue');
        var newAgents = update.getElementsByTagName('agent');
        var newPhones = update.getElementsByTagName('phone');
        var dbChanged = false;
        
        this.minTime = Math.min(this.minTime, start);
        this.maxTime = Math.max(this.maxTime, end);
        
        for (var i = 0, n = newCalls.length; i < n; i++) {
            var call = newCalls[i];
            call.start = +call.getAttribute('start');
            call.answer = +call.getAttribute('answered');
            call.end = +call.getAttribute('end');
            call.dtype = call.getAttribute('dtype');
            call.stype = call.getAttribute('stype');
            call.dnumber = call.getAttribute('dnumber');
            call.snumber = call.getAttribute('snumber');
            call.queuestatus = call.getAttribute('queuestatus');
            call.hold = +call.getAttribute('holdtime');
            call.talk = +call.getAttribute('talktime');
            call.total = +call.getAttribute('totaltime');
            calls.push(call);
            dbChanged = true;
        }
        if (dbChanged) {
            calls.sort(byEnd);
        }

        function cacheFields (tag) {
            tag.name = tag.getAttribute('name');
            tag.description = tag.getAttribute('description');
            tag.callerid = tag.getAttribute('callerid_internal');
        }
        
        
        for (i = 0, n = newQueues.length; i < n; i++) {
            var queue = newQueues[i];
            if (!queues[queue.id]) {
                queue.name = queue.getAttribute('name');
                queues[queue.id] = queue;
                dbChanged = true;
            }
        }

        
        for (i = 0, n = newAgents.length; i < n; i++) {
            var agent = newAgents[i],
                savedAgent = agents[agent.id];
            if (!savedAgent) {
                cacheFields(agent);
                agent.dtype = agent.getAttribute('dtype');
                agent.dnumber = agent.getAttribute('dnumber');
                agent.events = new QAgentEvents();
                agents[agent.id] = savedAgent = agent;
                dbChanged = true;
            }
            
            if ((savedAgent.events.add(agent.getElementsByTagName('event')) || savedAgent.events.isLoggedIn()) && visibleCols[COL_loggedIn]) {
                dbChanged = true;
            }
        }

        for (i = 0, n = newPhones.length; i < n; i++) {
            var phone = newPhones[i],
                name = phone.getAttribute('name');
            if (!phones[name]) {
                cacheFields(phone);
                phones[name] = phone;
                dbChanged = true;
            }
        }
        return dbChanged;
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
        var totalHold = 0,
            totalTalk = 0,
            totalTalkCount = 0,
            totalTotal = 0;
        
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
                talkCount = 0;

            for (var i in row.calls) {
                call = row.calls[i];
                
                minhold = Math.min(minhold, call.hold);
                avghold += call.hold;
                maxhold = Math.max(maxhold, call.hold);
                if (call.answer) {
                    mintalk = Math.min(mintalk, call.talk);
                    avgtalk += call.talk;
                    maxtalk = Math.max(maxtalk, call.talk);
                    talkCount++;
                }
                mintotal = Math.min(mintotal, call.total);
                avgtotal += call.total;
                maxtotal = Math.max(maxtotal, call.total);
            }

            for (i in row.queueCalls) {
                var q = row.queueCalls[i].queuestatus;
                if (q === 'abandon') {
                    abandon++;
                } else if (q === 'exitempty') {
                    noagent++;
                } else if (q === 'exitwithtimeout') {
                    timeout++;
                } else if (q === 'exitwithkey') {
                    keypress++;
                } else if (q === 'completeagent') {
                    agent++;
                } else if (q === 'completecaller') {
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
                totalHold += avghold;
                totalTalk += avgtalk;
                totalTalkCount += talkCount;
                totalTotal += avgtotal;
                
                avghold /= rowTotal;
                avgtalk = talkCount ? avgtalk / talkCount : 0;
                avgtotal /= rowTotal;
            }

            row.splice(COL_timeStart + 1, 0, minhold, avghold, maxhold, mintalk, avgtalk, maxtalk, mintotal, avgtotal, maxtotal, abandon, noagent, timeout, keypress, agent, caller, transfer);
        }

        
        function calcTotalRow () {
            var pos;
            if (totalCallsCount) {
                pos = colPos.indexOf(14);        // hold 
                if (pos !== -1) {
                    colSum[pos + 1] = totalHold / totalCallsCount;
                }
                pos = colPos.indexOf(17);        // talk
                if (pos !== -1) {
                    colSum[pos + 1] = totalTalkCount ? totalTalk / totalTalkCount : 0;
                }
                pos = colPos.indexOf(20);        // total
                if (pos !== -1) {
                    colSum[pos + 1] = totalTotal / totalCallsCount;
                }
            }
            colSum.total = totalCallsCount;
            colSum.totalTime = reportDuration;
            table.push(colSum);
        }
        
        
        function reduceRow () {
            var result = [row[0]];
            
            for (var j in colPos) {
                var pos = colPos[j],
                    el = row[pos + 1];
                result.push(el);
                if (pos < COL_timeStart || pos >= COL_timeEnd) {
                    if (pos === COL_loggedIn) {
                        maxLoggedIn = Math.max(maxLoggedIn, el);
                    }
                    else {
                        maxNum = Math.max(maxNum, el);
                    }
                }
                if (showTotal) {
                    colSum[+j + 1] += el;
                }
            }
            result.total = row.total;
            if (PERIOD) {
                result.totalTime = row.totalTime;
            }
            else {
                result.totalTime = reportDuration;
            }
            totalCallsCount += result.total;
            result.isAgent = row.isAgent;
            return result;
        }
        

        var reportDuration = Math.min(Date.now() / 1000, END) - START,
            colPos = that.colPos,
            maxNum = 0,
            maxLoggedIn = 0,
            totalCallsCount = 0,
            showTotal = PERIOD && qOpts.totalRow;

        if (showTotal) {
            var colSum = new Array(colPos.length + 1).fill(0);
            colSum[0] = 'Total';
        }

        for (var i in table) {
            var row = table[i];
            calcSecondaryCols(row);
            table[i] = reduceRow(row);
        }

        if (showTotal) {
            calcTotalRow();
        }
        
        that.maxNum = maxNum;
        that.maxLoggedIn = maxLoggedIn;
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
    }


    function byTimePeriods () {
        var now = Date.now() / 1000,
            startTime = START,
            endTime = START,
            timeObj,
            calls,
            row,
            dateFormat = qOpts.config('dateformat'),
            timeFormat = qOpts.config('timeformat');
 
        if ((Math.min(now, END) - START) / PERIOD > Math.max(900, window.innerWidth - 390)) {
            alert('Too many rows to display. Please set bigger time period.');
            byId('period').value = '0';
            throw 'too many rows to display';
        }

        while (startTime < END && startTime < now) {
            endTime += PERIOD;
            endTime = Math.min(endTime, now, END);

            calls = that.filterByTime(startTime, endTime);
            row = newRow();

            timeObj = new Date(startTime * 1000);
            if (PERIOD < DAY) {
                row[0] = formatDate(timeObj, dateFormat) + ' ' + formatTime(timeObj, timeFormat);
            }
            else {
                row[0] = formatDate(timeObj, dateFormat);
            }

            for (var i in calls) {
                decode(calls[i], row);
            }
            byQueueAgentPhone(calls, row, startTime, endTime);
            row.totalTime = endTime - startTime;
            table.push(row);

            startTime = endTime;
        }
    }


    function byHours (period) {
        var now = Date.now() / 1000,
            startTime = START,
            endTime = START - START % period,       // normalized
            calls,
            row,
            reportIndex,
            date = new Date(startTime * 1000),
            totalHours = DAY / period,
            isHalfHours = period === 1800,
            timeFormat = qOpts.config('timeformat'),
            startHour = date.getHours();
        
        if (isHalfHours) {
            startHour = startHour * 2 + Math.floor(date.getMinutes() / 30);
        }

        for (var i = 0; i < totalHours; i++) {
            var hourString,
                ampm = '';
            row = newRow();
            row.totalTime = 0;
            
            reportIndex = startHour + i;
            if (reportIndex >= totalHours) {
                reportIndex -= totalHours;
            }
            if (isHalfHours) {
                reportIndex = Math.floor(reportIndex / 2);
            }
            if (timeFormat === '12') {
                ampm = reportIndex >= 12 ? 'pm' : 'am';
                reportIndex %= 12;
            }
            hourString = pad(reportIndex) + ':';
            if (isHalfHours) {
                hourString += ((i + startHour) % 2) ? '30' : '00';
            }
            else {
                hourString += '00';
            }

            row[0] = hourString + ampm;
            table[i] = row;
        }

        while (startTime < END && startTime < now) {
            endTime += period;
            endTime = Math.min(endTime, now, END);

            date = new Date(startTime * 1000);
            reportIndex = date.getHours();
            if (isHalfHours) {
                reportIndex = reportIndex * 2 + Math.round(date.getMinutes() / 30);
            }
            reportIndex -= startHour;
            if (reportIndex < 0) {
                reportIndex = totalHours + reportIndex;
            }
       
            row = table[reportIndex];
            calls = that.filterByTime(startTime, endTime);

            for (i in calls) {
                decode(calls[i], row);
            }
            byQueueAgentPhone(calls, row, startTime, endTime);
            row.totalTime += endTime - startTime;

            startTime = endTime;
        }

    }


    function byDaysOfWeek () {
        var now = Date.now() / 1000,
            startTime = START,
            endTime = START,
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
            row.totalTime = 0;
            reportIndex = i + startDayOfWeek;  // start from startDayOfWeek
            if (reportIndex >= 7) {
                reportIndex -= 7;
            }
            row[0] = daysOfWeek[reportIndex];
            table[i] = row;
        }

        while (startTime < END && startTime < now) {
            endTime = Math.floor(getDaysAhead(endTime, 1) / 1000);
            endTime = Math.min(endTime, now, END);

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
            byQueueAgentPhone(calls, row, startTime, endTime);
            row.totalTime += endTime - startTime;

            startTime = endTime;
        }
    }


    function byQueueAgentPhone (filteredCalls, multiRow, periodStart, periodEnd) {
        var destinations = ['queues', 'agents', 'phones'],
            phoneDisplay = qOpts.get('phonetitle');

        for (var d in destinations) {
            var dest = destinations[d],
                ids = [],
                arr,
                destFilter = qOpts.get(dest),
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

            if (destFilter === 'use_include') {
                var options = byId(dest + 'include_selected').options;
                for (i = 0, n = options.length; i < n; i++) {
                    ids.push(options[i].value);
                }
            }
            else {
                for (i in arr) {
                    if (destFilter !== 'use_control_panel' || arr[i].getAttribute('panel') === '1') {
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
                    row = multiRow || newRow();

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
                            if (match) {
                                row.queueCalls.push(call);
                            }
                            break;

                        case 'agents':
                            match = call.stype === 'queue' && call.dnumber === el.dnumber && call.dtype === el.dtype;
                            if (match) {
                                row.queueCalls.push(call);
                            }
                            break;

                        case 'phones':
                            match = (call.stype === 'phone' && call.snumber === id) || (call.dtype === 'phone' && call.dnumber === id);
                            break;
                    }

                    if (match) {
                        decode(call, row, true);
                    }
                }

                if (dest === 'agents' && visibleCols[COL_loggedIn]) {
                    row[COL_timeStart + 1] += el.events.calcLoggedTime(periodStart || START, periodEnd || END);
                }

                if (!multiRow) {
                    row.isAgent = dest === 'agents';
                    table.push(row);
                }
            }
        }
    }


    function getDestinationQueueCalls () {
        for (var i in visibleRows) {
            if (visibleRows[i]) {
                var row = table[rowPos[i]],
                    calls = row.calls;
                for (var j in calls) {
                    var call = calls[j];
                    if (call.dtype === 'queue' || call.stype === 'queue') {
                        row.queueCalls.push(call);
                    }
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
            getDestinationQueueCalls();
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

        reduceTable();
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


    this.preventScroll = function () {
        window.scrollTo(savedScrollX, savedScrollY);
    };


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
                that.preventScroll();
            });
        }
        for (i in columnControls) {
            byId(columnControls[i]).addEventListener('change', function () {
                var pos = columnControls.indexOf(this.id);
                qDB.setVisibleCol(pos, +this.value);
                that.preventScroll();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                qDB.setVisibleRow(pos, +this.value);
                that.preventScroll();
            });
        }
        for (i in filterControls) {
            byId(filterControls[i]).addEventListener('change', function () {
                qDB.filter();
                that.preventScroll();
            });
        }
        
        byId('period').addEventListener('change', function () {
            PERIOD = +this.value;
            byId('heading_rows').innerHTML = PERIOD ? 'Sum of destinations:' : 'Display destinations:';
            var showMoveLeftRight = (PERIOD <= 0 || qMenu.type === 'table' || qMenu.type === 'piechart') ? 'none' : 'block';
            byId('left-overlay').style.display = showMoveLeftRight;
            byId('right-overlay').style.display = showMoveLeftRight;
            qDB.filter();
            that.preventScroll();
        });

        form.find('input[type="button"]').on('click', function () {
            qDB.filter();
            that.preventScroll();
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
    

    PERIOD = +this.get('period');
    this.recursive = +byName('recursive');
    this.slaTime = +this.get('slatime');
    this.totalRow = +this.get('totalrow');

    
    // FORM
    
    var form = $('form').last(),
        inputs = form.find('select, input'),
        submitBtn = form.find('input[type="submit"]'),
        originalName = form[0].name.value,
        submitUpdate = submitBtn[0],
        submitCopy = submitBtn[1],
        copyButtonClicked,
        dirty,
        appended;

    setWatchers();

    
    this.onFormDirty = function () {
        dirty = true;
        submitUpdate.disabled = false;
        submitUpdate.value = 'Save report';
    };
    
    
    function onFormClean () {
        submitUpdate.disabled = true;
        submitUpdate.value = 'Report saved';
        dirty = false;
    }
    
 
    if (form[0].id.value) {
        onFormClean();
    }
    inputs.on('change', this.onFormDirty);
    form.on('submit', submit);
    submitCopy.addEventListener('click', function () {
        copyButtonClicked = true;
    });
    window.addEventListener("popstate", function(e) {
        location.reload();
    });

    // submitting form
    function submit () {

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

        markAllOptions(true);
        qChart.resetZoom();


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


        if (copyButtonClicked) {
            form[0].id.value = 0;
            if (form[0].name.value === originalName) {
                form[0].name.value += ' (copy)';
            }
            copyButtonClicked = false;
        }
        originalName = form[0].name.value;


        $.post(form.attr('action'), form.serialize(), function (response) {
            var id = response.getElementsByTagName('return')[0].id;
            form[0].id.value = id;
            window.history.pushState('', form[0].name, '//' + location.host + location.pathname + '?id=' + id);
            onFormClean();
        });


        markAllOptions(false);
        submitCopy.style.display = '';
        eqHeight();
        return false;
    }
    
    
    if (!form[0].id.value) {
        submitCopy.style.display = 'none';
    }


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
function QPolling (onFreshData) {
    var that = this,
        username = qOpts.config('username'),
        password = qOpts.config('password'),
        xhr,
        preloaderShown,
        today,
        lastToday,
        requestStart,
        requestEnd,
        stopPolling = false,
        firstRequest,
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

        var startday = +qOpts.get('startday');
        if (startday === 1) {
            START = new Date(+qOpts.get('start_year'), +qOpts.get('start_month') - 1, +qOpts.get('start_day'));
        }
        else {
            START = getDaysAhead(today, startday);
        }
        START.setHours(+qOpts.get('start_hour'), +qOpts.get('start_minute'), +qOpts.get('start_second'));

        var endday = +qOpts.get('endday');
        if (endday == 1) {
            END = new Date(+qOpts.get('end_year'), +qOpts.get('end_month') - 1, +qOpts.get('end_day'));
        }
        else {
            END = getDaysAhead(today, endday);
        }
        END.setHours(+qOpts.get('end_hour'), +qOpts.get('end_minute'), +qOpts.get('end_second'));
        
        START /= 1000;
        END /= 1000;

        if (START >= END) {
            alert('Start time should be before end time.');
            stopPolling = true;
            throw 'start >= end';
        }

        else if (START > Date.now() / 1000) {
            alert('Start time should be before current moment.');
            stopPolling = true;
            throw 'start > now';
        }

        qChart.originalZoom = null;
    }


    function tryNewRequest () {
        if (!stopPolling && !document.hidden) {
            var request = '?_username=' + username + ';_password=' + password + ';start=' + requestStart + ';end=' + requestEnd + ';recursive=' + qOpts.recursive;
            ajaxGet(request, response, function () {    // on error, poll again
                timeoutHandle = setTimeout(tryNewRequest, qMenu.type === 'table' ? pollDelay : Math.max(20000, pollDelay));
            });
        }
    }


    this.update = function () {
        byId('zoom-out').style.display = 'none'; 
        qChart.originalZoom = null;

        stopCurrentRequest();
        calcTimeFrame();

        stopPolling = false;
        firstRequest = true;

        // if all required data is in the cache, don't query server 
        if (START >= qDB.minTime && END <= qDB.maxTime) {
            onFreshData(); 
            stopPolling = true;
            return;    
        }
        // query only what is missing (from the beginning)
        else if (START < qDB.minTime && END >= qDB.minTime) {
            onFreshData();
            requestStart = START;
            requestEnd = qDB.minTime;
        }
        // query only what is missing (from the end)
        else if (START <= qDB.maxTime && END > qDB.maxTime) {
            onFreshData();
            requestStart = qDB.maxTime;
            requestEnd = END;
        }
        // if missing data is on both sides, just query everything
        else {
            requestStart = START;
            requestEnd = END;
        }

        if (!preloaderShown && requestEnd - requestStart > DAY / 2) {
            showPreloader();
        }
      
        tryNewRequest();
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
                anythingChanged = qDB.add(update, requestStart, Math.min(requestEnd, updateEnd));

            if (firstRequest || anythingChanged) {
                onFreshData();
            }

            firstRequest = false;
            hidePreloader();

            // Handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.
            today = getToday();
            if (today !== lastToday) {
                if (qOpts.get('startday') === '0') {
                    START = Math.floor(getDaysAhead(START, 1) / 1000);
                }
                if (qOpts.get('endday') === '0') {
                    END = Math.floor(getDaysAhead(END, 1) / 1000);
                }
            }
            lastToday = today;

            if (START >= END) {
                stopPolling = true;
                alert('Because start_time was set for "Today", it became greater than end_time after midnight. Stopping.');
                return;
            }

            if (END <= qDB.maxTime) {
                stopPolling = true;
                return;
            }

            requestStart = qDB.maxTime;
            requestEnd = END;

            timeoutHandle = setTimeout(tryNewRequest, qMenu.type === 'table' ? pollDelay : Math.max(20000, pollDelay));
        }
    }


    function stopCurrentRequest () {
        clearTimeout(timeoutHandle);
        if (xhr) {
            xhr.abort();
        }
    }


    function visibilityChange () {
        stopCurrentRequest();
        tryNewRequest();
    }
    
    
    window.addEventListener('beforeunload', visibilityChange);


    function showPreloader () {
        preloaderShown = true;
        var img = document.createElement('IMG');
        img.src = '/local/bohdan/include/img/ajax.gif';
        img.alt = '';
        img.id = 'ajax-preloader';
        document.body.appendChild(img);
    }


    function hidePreloader () {
        if (preloaderShown) {
            var el = byId('ajax-preloader');
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
        tbody,
        blockRefresh;

    this.sortingCol = 0;
    this.sortingOrder = 1;


    this.render = function (slide) {
        if (blockRefresh) {
            return;
        } // todo deep vs shallow rerender
        
        var i,
            str = '',
            data = qDB.getTable();

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
        
        eqHeight();
        qOpts.preventScroll();
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
        
        for (var i in qDB.colPos) {
            var newI = qDB.colPos[i];
            str += '<th id="' + (newI + 1) + 'col" draggable="true" ondragover="return false" align="left"' + getSorting(newI + 1) + '>' + COLUMNS[newI] + '</th>';
        }

        return str;
    }


    this.resizeHeader = function () {
        theadTr.style.fontSize = '';
        var containerWidth = container.clientWidth,
            tableWidth = table.clientWidth,
            fontSize = 13;

        if (containerWidth >= tableWidth) {
            return;
        }

        do {
            theadTr.style.fontSize = --fontSize + 'px';
        } while (fontSize > 10 && containerWidth < table.clientWidth);
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
                qDB.sort();
                qMenu.update();
            }
            else {
                qDB.filter();
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
            blockRefresh = false;
            for (var i = 0, n = ths.length; i < n; i++) {
                ths[i].style.opacity = '';
                startTh.style.outline = '';
            }
        });

        tr.addEventListener('drop', function (evt) {
            blockRefresh = false;
            var target = evt.target,
                currId = parseInt(target.id);

            startTh.style.opacity = 1;
            if (startTh !== target) {
                var id1 = REARRANGE.indexOf(currId - 1),
                    id2 = REARRANGE.indexOf(startId - 1);
                var temp = REARRANGE[id1];
                REARRANGE[id1] = REARRANGE[id2];
                REARRANGE[id2] = temp;
                qDB.calculateColPos();
                qDB.filter();
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
        str += '<slide style="z-index: ' + (+i === slideIndex ? 1 : 0) + '"></slide>';
    }

    container.innerHTML = str +
        '<div id="piechart-chooser"></div><button id="zoom-out" onclick="qChart.resetZoom()" class="universal">Reset chart</button>' +
        '<div id="zooming-overlay" ondragstart="return false"></div><div id="left-overlay">&#10096;</div><div id="right-overlay">&#10097;</div>';
    container.insertAdjacentHTML('afterend', '<section id="right-menu"><button id="go-table" onclick="qMenu.goTo(\'table\')"></button><button id="go-linechart" onclick="qMenu.goTo(\'linechart\')"></button><button id="go-barchart" onclick="qMenu.goTo(\'barchart\')"></button><button id="go-stacked" onclick="qMenu.goTo(\'stacked\')"></button><button id="go-piechart" onclick="qMenu.goTo(\'piechart\')"></button><button id="go-csv" onclick="qDB.downloadCSV()"></button><button id="go-png" onclick="qChart.downloadPNG()"></button></section>');

    var slides = container.children;


    this.goTo = function (nextType) {
        var slide = slides[slideIndex],
            nextSlideIndex = TYPES.indexOf(nextType),
            nextSlide = slides[nextSlideIndex];

        SLIDES[nextType] = nextSlide;
        
        if (nextSlideIndex !== slideIndex) {
            slide.style.opacity = 0;
            nextSlide.style.zIndex = ++zIndex;
            nextSlide.style.opacity = 1;
            byId('go-' + this.type).className = '';

            qOpts.onFormDirty();
        }

        if (qChart.originalZoom && slideIndex !== nextSlideIndex) {
            slideIndex = nextSlideIndex;
            this.type = nextType;
       
            qChart.resetZoom();
            qDB.filter();
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

        eqHeight();
    };


    this.update = function () {
        upToDate = [];
        this.goTo(this.type);
    };
}


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
    return date;
}


function getBeginningOfDay (date) {
    return Math.floor(new Date(date * 1000).setHours(0,0,0,0) / 1000);
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
        var ampm = hh >= 12 ? 'pm' : 'am';
        hh %= 12;
        hh = hh ? hh : 12;
        return pad(hh) + ':' + pad(mm) + ampm;
    }
    else {
        return pad(hh) + ':' + pad(mm);
    }
}


function formatPeriod (period, minPeriod) {
    period = Math.round(period);
    var time = Math.floor(period / DAY),
        str = '';

    if (time || minPeriod === 4) {
        str = pad(time) + ':';
    }
    time = Math.floor((period % DAY) / 3600);
    if (time || str || minPeriod === 3) {
        str += pad(time) + ':';
    }
    time = Math.floor((period % 3600) / 60);
    if (time || str) {
        str += pad(time) + ':';
    }
    time = period % 60;
    str += pad(time);
    return str;
}


function arrayPeriod (period, length) {
    var result = [];

    if (length === 4) {
        result.push(Math.floor(period / DAY));
    }

    result.push(Math.floor((period % DAY) / 3600), Math.floor((period % 3600) / 60), Math.floor(period % 60));
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

document.addEventListener("DOMContentLoaded", function() {

    window.qOpts = new QOptions();
    window.qMenu = new QMenu(byId('left-content'));

    window.qDB = new QDataBase(qOpts.getColumns(), qOpts.getRows());

    window.qTable = new QTable();
    window.qChart = new QChart(byId('left-content'));

    window.qPolling = window.qsPolling = new QPolling(function () {
        qDB.filter();
    });

    byId('panel-open-button').innerHTML = '';

    // patch move_selected
    var savedMoveselect = move_selects;
    window.move_selects = function () {
        savedMoveselect.apply(window, arguments);
        qDB.filter();
    };

    
    var handler;
    window.addEventListener('resize', function () {
        clearTimeout(handler);

        handler = setTimeout(function () {
            if (qMenu.type === 'table') {
                qTable.resizeHeader();
            }
            else {
                qChart.resize();
            }
        }, 100);
    });


    (function () {
        var openButton = byId('panel-open-button'),
            optionsHeading = byId('options-heading'),
            navbar = byId('nav_bar'),
            navbarHeight = navbar.offsetHeight,
            leftContent = byId('left-content'),
            rightPanel = byId('right-panel'),
            isExpanded = false;


        function eqHeight () {
            var maxHeight = Math.max(navbarHeight, window.innerHeight - 196, isExpanded ? (rightPanel.scrollHeight + 9) : 0, isExpanded ? (SLIDES[qMenu.type].scrollHeight + 16) : 0);

            leftContent.style.height = maxHeight + 'px';
            document.getElementsByTagName('slide')[0].style.maxHeight = maxHeight + 'px';
        }
        
        
        window.eqHeight = eqHeight;


        function toggle () {
            isExpanded = !isExpanded;
            if (isExpanded) {
                rightPanel.classList.add('expanded');
                openButton.classList.add('expanded');
            }
            else {
                rightPanel.classList.remove('expanded');
                openButton.classList.remove('expanded');
            }
            eqHeight();
        }

        openButton.addEventListener('click', toggle);
        optionsHeading.addEventListener('click', toggle);
        
        window.addEventListener('resize', function () {
            eqHeight();
        });


        isExpanded = true;
        rightPanel.classList.add('expanded');
        openButton.classList.add('expanded');
    })();

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