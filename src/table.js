function CSTable (container, options) {
    var columns = [
            'Destination',
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
        ids = [
            '',
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
        //that = this,
        table,
        th,
        tbody;


    function buildHtml () {
        var str = '<table width="100%" border="0" cellpadding="0" cellspacing="0">' +
                    '<thead><tr class="head">';

        for (var i in columns) {
            str += '<th>' + columns[i] + '</th>';
        }

        str += '</tr></thead><tbody></tbody>';

        container.innerHTML = str;
        table = container.children[0];
        th = table.children[0].children[0].children;
        tbody = table.children[1];
        filterColumns();
    }


    this.setColumn = function (columnId, visibility) {
        var pos = ids.indexOf(columnId);
        options.visibleColumns[pos] = visibility;
        filterColumn(pos);
    };


    function filterColumns () {
        var rows = tbody.children,
            visibleColumns = options.visibleColumns;

        for (var i = 0, n = visibleColumns.length; i < n; i++) {
            th[i].style.display = visibleColumns[i] ? '' : 'none';
        }
        for (var j = 0, m = rows.length; j < m; j++) {
            var row = rows[i];
            for (i = 0, n = visibleColumns.length; i < n; i++) {
                row[i].style.display = visibleColumns[i] ? '' : 'none';
            }
        }
    }


    function filterColumn (pos) {
        var rows = tbody.children,
            visibleColumns = options.visibleColumns;

        th[pos].style.display = visibleColumns[pos] ? '' : 'none';

        for (var j = 0, m = rows.length; j < m; j++) {
            rows[j].row[pos].style.display = visibleColumns[pos] ? '' : 'none';
        }
    }


    this.update = function () {

    };


    buildHtml();
}