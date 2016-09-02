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

        str += that.createHeader(true) + '</tr></thead><tbody></tbody></table><br><br>' +
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
                that.sortingOrder = 1;
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
                target.style.opacity = 0.7;
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
            for (var i = 0, n = ths.length; i < n; i++) {
                ths[i].style.opacity = '';
            }
        });

        tr.addEventListener('drop', function (evt) {
            var target = evt.target,
                currId = parseInt(target.id);

            startTh.style.opacity = 1;
            if (startTh !== target) {
                var id1 = currId - 1,
                    id2 = startId - 1;
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