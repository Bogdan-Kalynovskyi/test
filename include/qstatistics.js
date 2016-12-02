/*global google*/
/*global URL*/
/*global qstatistics_begin*/

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
                    isLogin: node.getAttribute('type') === 'agentlogin'
                };

            for (var j in events) {
                if (events[j].time === event.time && events[j].isLogin === event.isLogin) {
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
            total = 0,
            event = events[0];

        // when first event is logoff, and it is inside bounds, then virtually add login event before it
        if (event && !event.isLogin && event.time >= periodStart) {
            start = periodStart;
        }

        while (event && event.time < periodEnd) {
            clear = false;
            
            if (event.isLogin) {
                start = event.time;
            }
            else {
                end = event.time;
            }
            
            if (end <= periodStart) {                           // completely out of bounds 
                clear = true;
            }
            else if (start && end) {                            // gathered a pair, which is at least partially in bounds
                total += Math.min(periodEnd, end) - Math.max(periodStart, start);
                clear = true;
            }

            if (clear) {                                        // clear that pair, and search for a new one
                start = undefined;
                end = undefined;
            }

            i++;
            event = events[i];
        }
        
        if (start && start < periodEnd && !end) {               // unfinished pair in bounds, agent is still logged in 
            total += Math.min(moment().unix(), periodEnd) - Math.max(periodStart, start);
        }

        return total;
    }; 
    
    
    // queue agent is currently logged in
    this.isLoggedIn = function () {
        var n = events.length;
        if (n) {
            return events[n - 1].isLogin;
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
            top: 99,
            left: '8%',
            right: '16%'
        },
        animation = {
            duration: 400,
            easing: 'out'
        },
        chartOptions = {
            linechart: {
                animation: animation,
                sliceVisibilityThreshold: 0,
                chartArea: chartArea
            },
            barchart: {
                animation: animation,
                sliceVisibilityThreshold: 0,
                chartArea: chartArea,
                bar: {groupWidth: "90%"}
            },
            stacked: {
                animation: animation,
                isStacked: true,
                sliceVisibilityThreshold: 0,
                chartArea: chartArea,
                bar: {groupWidth: "90%"}
            },
            piechart: {
                animation: animation,
                is3D: true,
                sliceVisibilityThreshold: 0,
                chartArea: chartArea
            }
        };


    function centerPieSource () {
        var g = SLIDES.piechart.querySelectorAll('svg > g'),
            left = Infinity,
            right = 0;

        for (var i = (chartOptions.piechart.legend === null ? 2 : 1); i < g.length - 1; i++) {
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
        var totalCallsPos = qDB.colPos.indexOf(0) + 1,
            loggedInPos = qDB.colPos.indexOf(COL_loggedIn) + 1;
        
        for (i in dbTable) {
            var row = dbTable[i],
                totalVisible = 0;

            if (row.total) {
                for (var j = 1; j < colPosLen; j++) {
                    if (j !== totalCallsPos && j !== loggedInPos) {
                        totalVisible += row[j];
                    }
                }

                if (totalVisible) {
                    str += '<option value="' + i + '">' + row[0] + '</option>';
                }
            }
        }
        str += '</select></label>';
        byId('piechart-chooser').innerHTML = str;

        var byCol = byId('piechart-by-column'),
            byRow = byId('piechart-by-row');

        byCol.onchange = function () {
            that.pieFilter = {
                by: 'column',
                id: this.value
            };
            byRow.value = '';
            qOpts.onFormDirty();
            renderPieChart();
        };
        byRow.onchange = function () {
            that.pieFilter = {
                by: 'row',
                id: this.value
            };
            byCol.value = '';
            qOpts.onFormDirty();
            renderPieChart();
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
            loggedInTimeDivider = maxNum ? (maxLoggedIn / maxNum * 21) : maxLoggedIn;
        }
        // when logged in time column is displayed 
        else if (pieChartCol) {
            loggedInTimeDivider = qDB.maxLoggedIn;      // average
        }
        // other cases
        else {
            loggedInTimeDivider = qDB.maxNum ? (qDB.maxLoggedIn / qDB.maxNum * 21) : qDB.maxLoggedIn;
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
            for (var i in colPos) {
                tableHeader.push(COLUMNS[colPos[i]] + ((+i + 1 === loggedInPos) ? timeUnit : ''));
            }
        }
    }


    function getPieDataTable () {
        var pieChartOptions = chartOptions.piechart,
            pf = that.pieFilter;
        
        function setEmptyChart () {
            data = [['', ''], ['No calls', 1]];
            pieChartOptions.legend = 'none';
            pieChartOptions.pieSliceText = 'label';
            pieChartOptions.enableInteractivity = false;
        }
        
        pf.id = qOpts.get('piechart-by-column');
        pf.by = 'column';
        
        if (pf.id === '') {
            pf.by = 'row';
            pf.id = qOpts.get('piechart-by-row');
        }
        
        if (pf.id === '') {
            pf.by = 'column';
            byId('piechart-by-column').value = pf.id = qDB.colPos[0];
        }
        
        var row,
            id = +pf.id,
            data = [['', '']];                        // in pieChart, first row seems not to have any useful information
            
        pieChartOptions.legend = null;
        pieChartOptions.pieSliceText = 'percentage';
        pieChartOptions.enableInteractivity = true;

        if (pf.by === 'column') {
            pieChartOptions.title = 'Column: ' + COLUMNS[pf.id];
            cacheTableHeader(undefined, id === COL_loggedIn);
            var pos = qDB.colPos.indexOf(id) + 1,
                i = (!PERIOD && +qOpts.get('allcalls')) ? 1 : 0,              // in Destination mode, don't show "All
                                                                              // calls" in chart
                n = dbTable.length - (PERIOD && qOpts.totalRow ? 1 : 0),      // in Time mode, don't show "Total" row
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
            if (!totalVisible) {                                       // all cols should be given as an option, but they don't always contain data
                setEmptyChart();
            }
        }
        else {
            pieChartOptions.title = 'Row: ' + dbTable[pf.id][0];
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
                        else if (PERIOD || row[i]) {
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
            n = dbTable.length - (PERIOD && qOpts.totalRow ? 1 : 0);            // for time-based reports, don't show "Total" row

        for (; j < n; j++) {
            var dbRow = dbTable[j],
                row = dbRow.slice(),
                start = dbRow.start;

            // for time - based reports
            if (start && SAME_TZ) {
                row[0] = start;
            }

            for (var i in colPos) {
                var i1 = colPos[i],
                    j1 = +i + 1,
                    isTime = i1 >= COL_timeStart && i1 < COL_timeEnd;
                
                if (isTime) {
                    row[j1] = qUtils.googleTimeFormat(row[j1]);
                }
                else if (i1 === COL_loggedIn) {
                    // If agent was logged in for the whole time, the "logged in" chart should look as a straight line.
                    // For time-period-based report type, row[0] is a Date object
                    if (start && j === n - 1) {
                        row[j1] *= PERIOD / (Math.min(END * 1000, Date.now()) - start.getTime()) * 1000;
                    }
                    // show time in the most suitable unit of measure
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
            
            // then reflect column types in options
            if (j === 0) {
                if (hasNumericCols && hasDurationCols) {   // then display two axes, right is timeOfDay
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

        // google charts display time on x axis better than I do, because they know font and the scale
        if (SAME_TZ && PERIOD > 0) {
            chartOptions[type].hAxis = {
                format: qUtils.getGoogleApiFormat(),
                viewWindow: {
                    min: new Date(START * 1000),
                    max: new Date(Math.min(Date.now(), END * 1000))
                }
            };
        }
        else {
            delete chartOptions[type].hAxis;
        }

        chartOptions[type].title = qOpts.get('name');

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


    function reRenderWithoutAnimation () {
        qOpts.showNewTime();
        chartOptions[qMenu.type].animation.duration = 0;
        qDB.filter();
        chartOptions[qMenu.type].animation.duration = 400;
    }
    
    
    function move (direction) {
        var now = moment().unix(),
            leftTime = START,
            rightTime = Math.min(now, END),
            delta = (rightTime - leftTime) * 0.1 * direction;
        if (direction < 0 || rightTime !== now) {
            setZoomBackup();

            START += delta;
            END = rightTime + delta;

            reRenderWithoutAnimation();
        }
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

            var now = moment().unix(),
                leftTime = START,
                rightTime = Math.min(now, END);

            START += (rightTime - leftTime) * (minX - window.scrollX - rectSVG.left) / rectSVG.width;
            END = rightTime - (rightTime - leftTime) * (rectSVG.right + window.scrollX - maxX) / rectSVG.width;
            PERIOD = that.originalZoom.period * (Math.min(now, END) - START) / (Math.min(now, that.originalZoom.end) - that.originalZoom.start);

            reRenderWithoutAnimation();

            container.onmousemove = null;
        }
        
        endX = null;
    }

    
    function mousewheel (evt) {
        var svgr = charts[qMenu.type] && charts[qMenu.type].svgr;
        if (svgr && evt.deltaY && (svgr === evt.target || svgr.contains(evt.target))) {
            setZoomBackup();
            
            var now = moment().unix(),
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

            reRenderWithoutAnimation();
            
            evt.preventDefault();
            return false;
        }
    }

    
    function assignZoom (type) {
        if (PERIOD > 0) {
            setTimeout(function () {
                var svgr = SLIDES[type].getElementsByTagName('svg');
                if (svgr) {
                    svgr = svgr[0];
                    var title = svgr.children[2].children[0];
                    title.setAttribute('y', 32);
                    // a tricky part of Google charts integration. Find rectangle inside which the chart is rendered
                    svgr = (svgr.children[4] && svgr.children[4].children[0]) || (svgr.children[3] && svgr.children[3].children[0]) || svgr.children[2].children[0];
                    svgr.style.cursor = 'col-resize';
                    charts[type].svgr = svgr;
                }
            }, 650);
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

                qUtils.eqHeight();
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
        var fileName = (qOpts.get('name').replace(/[^\w\s]/g, '_') || 'noname') + '.png';
        qUtils.downloadUrl(charts[qMenu.type].getImageURI(), fileName);
    };


    this.resetZoom = function () {
        var orig = this.originalZoom;
        if (orig) {
            START = orig.start;
            END = orig.end;
            PERIOD = orig.period;
            this.originalZoom = null;
            resetZoomBtn.style.display = 'none';
            reRenderWithoutAnimation();
            byId('startday').value = orig.startOpt;
            byId('endday').value = orig.endOpt;
            if (orig.startOpt !== '1') {
                byId('startdate').style.display = 'none';
            }
            if (orig.endOpt !== '1') {
                byId('enddate').style.display = 'none';
            }
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

    SAME_TZ,            // same timezone
    REARRANGE = [];     // works when dragndrop columns

for (PERIOD = 0; PERIOD < COLUMNS.length; PERIOD++) {  // here PERIOD is just counter, and will be changed later
    REARRANGE[PERIOD] = PERIOD;
}


function QDataBase (visibleCols, visibleRows) {
    var that = this,
        callIds = {},
        calls = [],
        queues = {},
        agents = {},
        phones = {},
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
                        row[j1] = qUtils.timeFormat(row[j1], 3);
                    }
                    else if (loggedInCol) {
                        row[j1] = (PERIOD || table[i].isAgent) ? qUtils.timeFormat(row[j1], 4) : '';
                    }

                    if (withPercentage) {
                        var tblRow = table[i];
                        if (loggedInCol) {
                            if (PERIOD || tblRow[j0] || tblRow.isAgent) {
                                perc = tblRow.totalTime ? Math.round(100 * tblRow[j0] / tblRow.totalTime) : 0;
                            }
                            else {
                                perc = '';
                            }
                        }
                        else {
                            var divide = tblRow.total;
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
    };


    this.getData = function () {
        if (!table.length) {
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
            row  = data[i];
            for (var j in row) {
                var cell = row[j].toString().replace(/"/g, '""');
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = '"' + cell + '"';
                }
                str += +j > 0 ? (',' + cell) : cell;
            }
            str += '\n';
        }

        var fileName = (qOpts.get('name').replace(/[^\w\s]/g, '_') || 'noname') + '.csv',
            csvBlob = new Blob([str], {type: 'text/csv;charset=utf-8;'});

        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(csvBlob, fileName);
        }
        else {
            qUtils.downloadUrl(URL.createObjectURL(csvBlob), fileName);
        }
    };




    function newRow () {
        var row = new Array(COL_timeStart + 1 + (visibleCols[COL_loggedIn] ? 1 : 0)).fill(0);
        row.total = 0;
        row.calls = [];
        row.qnaCalls = [];
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
            multiRow.calls = multiRow.calls.concat(row.calls);
            multiRow.qnaCalls = multiRow.qnaCalls.concat(row.qnaCalls);
        }
    }

    // call                  - xml call
    // multiRow              - either appended one time or multiple times to multiRow or created as new row
    // dontAddToMultipleRows - see line above
    //
    // check for usages to understand better

    function decode (call, multiRow, dontAddToMultipleRows, cameFromPhoneFilter) {
        var stype = call.stype,
            dtype = call.dtype,
            answered = call.answer,
            external = 'external',
            local = 'local',
            isInbound,
            isInternal,
            isOutbound,
            row;

        row = dontAddToMultipleRows ? multiRow : newRow();
        row.calls.push(call);

        // rather weird requirement not to count queuestatus for calls that came from "Telephone lines" filter
        if (!cameFromPhoneFilter) {
            row.qnaCalls.push(call);
        }

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
            
            var oldCall = callIds[call.id];
            if (oldCall) {
                calls.splice(calls.indexOf(oldCall), 1);
            }
            callIds[call.id] = call;
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
            // todo: now I simply overwrite queues. Todo detect queue changes  
            var queue = newQueues[i];
            if (!queues[queue.id]) {
                dbChanged = true;
            }
            queue.name = queue.getAttribute('name');
            queues[queue.id] = queue;
            queue.marked = true;
        }
        
        for (i in queues) {
            if (!queues[i].marked) {
                delete queues[i];
                dbChanged = true;
            }
            else {
                queues[i].marked = false;
            }
        }

        
        for (i = 0, n = newAgents.length; i < n; i++) {
            // todo: now I simply overwrite queues. Todo detect queue changes  
            var agent = newAgents[i],
                oldAgent = agents[agent.id];

            if (!oldAgent) {
                dbChanged = true;
            }
            else {
                var oldAgentEvents = oldAgent.events;
            }

            cacheFields(agent);
            agent.dtype = agent.getAttribute('dtype');
            agent.dnumber = agent.getAttribute('dnumber');
            agent.events = oldAgentEvents || new QAgentEvents();
            agents[agent.id] = agent;
            agent.marked = true;
            
            if ((agent.events.add(agent.getElementsByTagName('event')) || agent.events.isLoggedIn()) && visibleCols[COL_loggedIn]) {
                dbChanged = true;
            }
        }
        
        for (i in agents) {
            if (!agents[i].marked) {
                delete agents[i];
                dbChanged = true;
            }
            else {
                agents[i].marked = false;
            }
        }

        
        for (i = 0, n = newPhones.length; i < n; i++) {
            // todo: now I simply overwrite queues. Todo detect queue changes
            var phone = newPhones[i],
                name = phone.getAttribute('name');
            if (!phones[name]) {
                dbChanged = true;
            }
            cacheFields(phone);
            phones[name] = phone;
            phone.marked = true;
        }
        // todo: ask David if we should update dropdowns
        
        for (i in phones) {
            if (!phones[i].marked) {
                delete phones[i];
                dbChanged = true;
            }
            else {
                phones[i].marked = false;
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
        var minHold = Infinity,
            minTalk = Infinity,
            minTotal = Infinity,
            maxHold = 0,
            maxTalk = 0,
            maxTotal = 0,
            sumHold = 0,
            sumTalk = 0,
            talkCallsCount = 0,
            sumTotal = 0;


        function calcSecondaryCols (row) {
            var call,
                rowTotal = row.calls.length,
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
                talkCount = 0,
                
                queueCount = 0;

            for (var i in row.calls) {
                call = row.calls[i];
                
                minhold = Math.min(minhold, call.hold);
                minHold = Math.min(minHold, minhold);
                avghold += call.hold;
                maxhold = Math.max(maxhold, call.hold);
                maxHold = Math.max(maxHold, maxhold);
                if (call.answer) {
                    mintalk = Math.min(mintalk, call.talk);
                    minTalk = Math.min(minTalk, mintalk);
                    avgtalk += call.talk;
                    maxtalk = Math.max(maxtalk, call.talk);
                    maxTalk = Math.max(maxTalk, maxtalk);
                    talkCount++;
                }
                mintotal = Math.min(mintotal, call.total);
                minTotal = Math.min(minTotal, mintotal);
                avgtotal += call.total;
                maxtotal = Math.max(maxtotal, call.total);
                maxTotal = Math.max(maxTotal, maxtotal);
            }
            row.total = rowTotal;

            for (i in row.qnaCalls) {
                call = row.qnaCalls[i];

                var dtypeQueue = call.dtype === 'queue',
                    stypeQueue = call.stype === 'queue';

                if (dtypeQueue || stypeQueue) {
                    var q = call.queuestatus;
                    
                    if (dtypeQueue) {
                        queueCount++;
                    }
                    
                    if (q === 'abandon') {
                        abandon++;
                    } else if (q === 'exitwithtimeout') {
                        timeout++;
                    } else if (q === 'completeagent') {
                        agent++;
                    } else if (q === 'completecaller') {
                        caller++;
                    } else if (q === 'transfer') {
                        transfer++;
                    } else if (dtypeQueue) {
                        if (q === 'exitempty') {
                            noagent++;
                        } else if (q === 'exitwithkey') {
                            keypress++;
                        }
                    }
                }
            }
            row.queueCount = queueCount;
            row.agentCount = row.qnaCalls.length;

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
                sumHold += avghold;
                sumTalk += avgtalk;
                talkCallsCount += talkCount;
                sumTotal += avgtotal;
                
                avghold /= rowTotal;
                avgtalk = talkCount ? avgtalk / talkCount : 0;
                avgtotal /= rowTotal;
            }

            row.splice(COL_timeStart + 1, 0, minhold, avghold, maxhold, mintalk, avgtalk, maxtalk, mintotal, avgtotal, maxtotal, abandon, noagent, timeout, keypress, agent, caller, transfer);
        }

        
        function calcTotalRow () {
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

                var map = {
                    13: minHold,
                    14: sumHold / totalCallsCount,
                    15: maxHold,
                    16: minTalk,
                    17: talkCallsCount ? sumTalk / talkCallsCount : 0,
                    18: maxTalk,
                    19: minTotal,
                    20: sumTotal / totalCallsCount,
                    21: maxTotal
                };
                for (var i in map) {
                    var pos = colPos.indexOf(+i);
                    if (pos !== -1) {
                        colSum[pos + 1] = map[i];
                    }
                }
            }
            colSum.queueCount = queueCallsCount;
            colSum.agentCount = agentCallsCount;
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
            result.start = row.start;
            result.queueCount = row.queueCount;
            result.agentCount = row.agentCount;
            result.total = row.total;
            if (PERIOD) {
                result.totalTime = row.totalTime;
            }
            else {
                result.totalTime = reportDuration;
            }
            queueCallsCount += result.queueCount;
            agentCallsCount += result.agentCount;
            totalCallsCount += result.total;
            result.isAgent = row.isAgent;
            return result;
        }
        

        var reportDuration = Math.min(moment().unix(), END) - START,
            colPos = that.colPos,
            maxNum = 0,
            maxLoggedIn = 0,
            queueCallsCount = 0,
            agentCallsCount = 0,
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
        var now = moment().unix(),
            startTime = START,
            endTime = START,
            finishTime = Math.min(now, END),
            calls,
            row,
            formatStr = qUtils.getMomentJSFormat();
 
        if ((Math.min(now, END) - START) / PERIOD > Math.max(900, window.innerWidth - 380)) {
            alert('Too many rows to display. Please set bigger interval.');
            byId('period').value = '0';
            PERIOD = 0;
            throw 'too many rows to display';
        }

        while (startTime < finishTime) {
            row = newRow();

            var start = moment.unix(startTime);
            row.start = start.toDate();
            row[0] = start.format(formatStr);

            if (PERIOD < DAY) {
                endTime += PERIOD;
            }
            else {
                endTime = start.add(PERIOD / DAY, 'days').unix();
            }
            endTime = Math.min(endTime, finishTime);

            calls = that.filterByTime(startTime, endTime);

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
        var now = moment().unix(),
            startTime = START,
            endTime = START - START % period,       // normalized
            calls,
            row,
            reportIndex,
            date = moment.unix(startTime),
            totalHours = DAY / period,
            isHalfHours = period === 1800,
            timeFormat = qOpts.config('timeformat'),
            startHour = date.hour();
        
        if (isHalfHours) {
            startHour = startHour * 2 + Math.floor(date.minute() / 30);
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
            hourString = qUtils.pad(reportIndex) + ':';
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
        var start = moment.unix(START),
            startTime = START,
            end = start,
            endTime = START,
            finish = moment.min(moment(), moment.unix(END)),
            finishTime = finish.unix(),
            calls,
            row,
            reportIndex,
            dayOfWeek,
            startDayOfWeek = start.day(),
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

        while (startTime < finishTime) {
            end.add(1, 'days');
            end = moment.min(end, finish);
            endTime = end.unix();

            dayOfWeek = start.day();
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

            start = end;
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
                    if (dest === 'queues') {
                        row[0] = 'Queue: ' + qUtils.escapeHtml(el.name);
                    }
                    else {
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
                            row[0] = 'Queue agent: ' + qUtils.escapeHtml(name);
                        }
                        else {
                            row[0] = 'Ext: ' + qUtils.escapeHtml(name);
                        }
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
                        decode(call, row, true, dest === 'phones');
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

        reduceTable();
        this.sort();
        qMenu.update();
    };


    // constructor
    this.calculateColPos();
    calculateRowPos();

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

        byId('name').addEventListener('change', function () {
            that.title.innerHTML = 'Call statistics :: ' + qUtils.escapeHtml(this.value);
        });
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
            qUtils.toggleLROverlay(qMenu.type);
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
        return document.settings[field].value;
    };


    this.get = function (id) {
        return byId(id).value;
    };
    

    PERIOD = +this.get('period');
    this.recursive = +byName('recursive');
    this.slaTime = +this.get('slatime');
    this.totalRow = +this.get('totalrow');
    this.title = document.getElementsByTagName('title')[0];
    moment.tz.setDefault(this.config('timezone'));
    SAME_TZ = (new Date()).getTimezoneOffset() === moment().utcOffset();
    // todo will not work so good in periods with daylight time saving

    
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
        submitCopy.disabled = false;
        submitCopy.value = 'Save as copy';
    };
    
    
    function onFormClean () {
        submitUpdate.disabled = true;
        submitUpdate.value = 'Report saved';
        if (copyButtonClicked) {
            submitCopy.disabled = true;
            submitCopy.value = 'Report copied';
        }
        dirty = false;
    }
    
 
    if (form[0].id.value) {
        onFormClean();
        this.title.innerHTML = 'Call statistics :: ' + qUtils.escapeHtml(form[0].name.value);
    }
    else {
        this.title.innerHTML = 'Call statistics :: New report';
    }


    inputs.on('change', this.onFormDirty);
    form.on('submit', submit);
    submitCopy.addEventListener('click', function () {
        copyButtonClicked = true;
    });
    window.addEventListener("popstate", function() {
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


        if (!form[0].name.value) {
            window.scrollTo(0, 0);
            form[0].name.focus();
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
            '<input type="hidden" name="starttime" value="' + (START - moment.unix(START).startOf('day').unix()) + '"/>' +
            '<input type="hidden" name="endtime" value="' + (END - moment.unix(END).startOf('day').unix()) + '"/>');

        if (qChart.pieFilter && qChart.pieFilter.id) {
            form[0].piesource.value = qChart.pieFilter.by + '_' + qChart.pieFilter.id;
        }


        form[0].type.value = qMenu.type;


        if (copyButtonClicked) {
            form[0].id.value = 0;
            if (form[0].name.value === originalName) {
                form[0].name.value += ' (copy)';
            }
        }
        originalName = form[0].name.value;


        $.post(form.attr('action'), form.serialize(), function (response) {
            var id = response.getElementsByTagName('return')[0].id;
            form[0].id.value = id;
            window.history.pushState('', form[0].name, '//' + location.host + location.pathname + '?id=' + id);
            onFormClean();
            copyButtonClicked = false;
        });


        markAllOptions(false);
        submitCopy.style.display = '';
        qUtils.eqHeight();
        return false;
    }
    
    
    if (!form[0].id.value) {
        submitCopy.style.display = 'none';
    }


    this.showNewTime = function () {
        byId('startday').value = 1;
        byId('endday').value = 1;
        var start = moment.unix(START),
            end = moment.unix(END),
            y1,m1,d1,y2,m2,d2;
        byId('startdate').style.display = '';
        byId('enddate').style.display = '';
        byId('start_year').value = y1 = start.year();
        byId('end_year').value = y2 = end.year();
        byId('start_month').value = m1 = start.month() + 1;
        byId('end_month').value = m2 = end.month() + 1;
        byId('start_day').value = d1 = start.date();
        byId('end_day').value = d2 = end.date();
        byId('start_hour').value = start.hours();
        byId('end_hour').value = end.hours();
        byId('start_minute').value = start.minutes();
        byId('end_minute').value = end.minutes();
        byId('start_second').value = start.seconds();
        byId('end_second').value = end.seconds();
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
    var username = qOpts.config('username'),
        password = qOpts.config('password'),
        xhr,
        preloaderShown,
        startDay,
        endDay,
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
        lastToday = moment().startOf('day');
        
        startDay = qOpts.get('startday');
        if (startDay === '1') {
            START = moment({
                year: qOpts.get('start_year'),
                month: qOpts.get('start_month') - 1,
                day: qOpts.get('start_day')
            });
        }
        else {
            START = moment().add(startDay, 'days');
        }
        START.set({
            hour: qOpts.get('start_hour'),
            minute: qOpts.get('start_minute'),
            second: qOpts.get('start_second')
        });

        endDay = qOpts.get('endday');
        if (endDay == '1') {
            END = moment({
                year: qOpts.get('end_year'),
                month: qOpts.get('end_month') - 1,
                day: qOpts.get('end_day')
            });
        }
        else {
            END = moment().add(endDay, 'days');
        }
        END.set({
            hour: qOpts.get('end_hour'),
            minute: qOpts.get('end_minute'),
            second: qOpts.get('end_second')
        });

        START = START.unix();
        END = END.unix();
        
        var temp1 = Math.min(START, END);
        var temp2 = Math.max(START, END);
        START = temp1;
        END = temp2;

        if (START > moment().unix()) {
            alert('We are not supporting reports which start in the future.');
            // todo
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

            // Handle the change of day at midnight. If the start or end day is not a specific date then the report
            // period will change every day.
            var today = moment().startOf('day');
            if (today.unix() !== lastToday.unix()) {
                if (startDay === '0') {
                    START = moment.unix(START).add(1, 'days').unix();
                }
                if (endDay === '0') {
                    END = moment.unix(END).add(1, 'days').unix();
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
        img.src = '/local/qstatistics/include/img/ajax.gif';
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
        
        qUtils.eqHeight();
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
        else {
            qUtils.eqHeight();
        }
        upToDate[nextSlideIndex] = true;

        byId('go-png').disabled = (nextType === 'table');
        byId('piechart-chooser').style.display = nextType === 'piechart' ? 'block' : 'none';
        byId('go-' + nextType).className = 'active';
        qUtils.toggleLROverlay(nextType);

        slideIndex = nextSlideIndex;
        this.type = nextType;
    };


    this.update = function () {
        upToDate = [];
        this.goTo(this.type);
    };
}


function QUtils () {

    this.pad = function (s) {
        if (s < 10) {
            s = '0' + s;
        }
        return s;
    };


    this.getMomentJSFormat = function () {
        if (PERIOD < DAY) {
            return qOpts.config('dateformat') + ' ' + (qOpts.config('timeformat') === '12' ? 'hh:mma' : 'HH:mm');
        }
        else {
            return qOpts.config('dateformat');
        }
    };


    this.getGoogleApiFormat = function () {
        var df = qOpts.config('dateformat').replace('YYYY', 'yyyy').replace('DD', 'dd');
        if (PERIOD < DAY) {
            return df + ' ' + (qOpts.config('timeformat') === '12' ? 'hh:mmaa' : 'HH:mm');
        }
        else {
            return df;
        }
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
        if (time || str) {
            str += this.pad(time) + ':';
        }
        time = period % 60;
        str += this.pad(time);
        return str;
    };


    this.googleTimeFormat = function (period, length) {
        var result = [];

        if (length === 4) {
            result.push(Math.floor(period / DAY));
        }

        result.push(Math.floor((period % DAY) / 3600), Math.floor((period % 3600) / 60), Math.floor(period % 60));
        return result;
    };


    this.downloadUrl = function (url, fileName) {
        var link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    this.escapeHtml = function (text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    };


    this.toggleLROverlay = function (nextType) {
        var showMoveLeftRight = (PERIOD <= 0 || nextType === 'table' || nextType === 'piechart') ? 'none' : 'block';
        byId('left-overlay').style.display = showMoveLeftRight;
        byId('right-overlay').style.display = showMoveLeftRight;
    };


    var openButton = byId('panel-open-button'),
        optionsHeading = byId('options-heading'),
        navbar = byId('nav_bar'),
        navbarHeight = navbar.offsetHeight,
        leftContent = byId('left-content'),
        rightPanel = byId('right-panel'),
        isExpanded = false;


    this.eqHeight = function () {
        var rightPanelHeight = isExpanded ? (rightPanel.scrollHeight + 9) : 0,
            centerPanelHeight = (isExpanded || qMenu.type !== 'table') ? (SLIDES[qMenu.type].scrollHeight + 1) : 0,
        //headerHeight = 196,
            maxHeight = Math.max(navbarHeight, window.innerHeight - 196, rightPanelHeight, centerPanelHeight);

        leftContent.style.height = maxHeight + 'px';
        document.getElementsByTagName('slide')[0].style.maxHeight = maxHeight + 'px';
    };


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
        qUtils.eqHeight();
    }

    openButton.addEventListener('click', toggle);
    optionsHeading.addEventListener('click', toggle);

    openButton.innerHTML = '';      // bad initial html

    isExpanded = true;
    rightPanel.classList.add('expanded');
    openButton.classList.add('expanded');
}


function byId (id) {
    return document.getElementById(id);
}

function byName (name) {
    return document.getElementsByName(name)[0].value;
}



function qstatistics_begin () {
    window.qUtils = new QUtils();
    window.qOpts = new QOptions();
    window.qMenu = new QMenu(byId('left-content'));

    window.qDB = new QDataBase(qOpts.getColumns(), qOpts.getRows());

    window.qTable = new QTable();
    window.qChart = new QChart(byId('left-content'));

    window.qPolling = window.qsPolling = new QPolling(function () {
        qDB.filter();
    });


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
            qUtils.eqHeight();
        }, 100);
    });
}