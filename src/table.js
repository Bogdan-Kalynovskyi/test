function CSTable (container) {
        var newIds = [
            0,1,2,3,4,5,6,7,8,9,10,11
        ],
        that = this,
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

        str += that.createHeader(true) + '</tr></thead><tbody></tbody></table>' +
            '<br><br><button id="csv">Download as CSV</button>';

        container.innerHTML = str;
        table = container.children[0],
        theadTr = table.children[0].children[0],
        ths = theadTr.children;
        tbody = table.children[1];

        that.resizeHeader();
    }


    this.createHeader = function (initial) {
        var str = '';
        for (var i in COLUMNS) {
            var newI = newIds[i],
                title,
                sorting;

            if (csBase.visibleCols[newI]) {

                if (newI === 0) {
                    title = PERIOD === 0 ? 'Destination' : 'Time';
                }
                else {
                    title = COLUMNS[newI];
                }

                if (this.sortingCol === newI) {
                    sorting = this.sortingOrder === 1 ? ' ▼' : ' ▲'
                }
                else {
                    sorting = '';
                }

                str += '<th id="' + newI + 'col" draggable="true" ondragover="return false"><b>' + title + sorting + '</b></th>';
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

        if (containerWidth === tableWidth) {
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
            if (!isNaN(startId)) {
                startTh.style.opacity = 0.6;
            }
            evt.dataTransfer.effectAllowed = 'move';
            evt.dataTransfer.dropEffect = 'move';
        });

        tr.addEventListener('dragover', function (evt) {
            var target = evt.target,
                id = parseInt(startTh.id);

            if (!isNaN(id) && startTh !== target) {
                target.style.opacity = 0.9;
                var currId = parseInt(target.id);

                if (!currId) {
                    return false;
                }

                // var eventX = evt.pageX - target.offsetLeft,
                //     width = target.clientWidth;
                // if (eventX < width / 2) {
                //     target.style.marginLeft = width + 'px';
                // }
                // else {
                //     target.style.marginRight = width + 'px';
                // }
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
            if (!isNaN(currId) && startTh !== target) {
                var eventX = evt.pageX - target.offsetLeft,
                    width = target.clientWidth,
                    temp;

                // if (eventX < width / 2) {
                //     temp = currId < startId ? currId : currId - 1;
                // }
                // else {
                //     temp = currId < startId ? currId + 1 : currId;
                // }
                temp = newIds[currId];
                newIds[currId] = newIds[startId];
                newIds[startId] = temp;
                that.createHeader();
                that.update();
            }
        });
    }
    
    
    function assignCSVButtonClick () {
        byId('csv').onclick = function () {

            function encodeRow (row) {
                for (var j = 0; j < row.length; j++) {
                    var cell = row[j].toString().replace(/"/g, '""');
                    if (cell.search(/("|,|\n)/g) >= 0) {
                        cell = '"' + cell + '"';
                    }

                    str += (j > 0) ? (',' + cell) : cell;
                }
                str += '\n';
            }

            
            var str = '',
                row = [];
            
            row.push((PERIOD === 0) ? 'Destination' : 'Time');
            
            for (var i in COLUMNS) {
                if (csBase.visibleCols[newIds[i]]) {
                    row.push(COLUMNS[newIds[i]]);
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
            var line = data[i];
            str += '<tr>';
            for (var j in line) {
                str += '<td>' + line[newIds[j]] + '</td>';
            }
            str += '</tr>';
        }
        tbody.innerHTML = str;
        cachedData = data;
    };


    createTable();
    assignHeaderEvents();
    assignCSVButtonClick();
}