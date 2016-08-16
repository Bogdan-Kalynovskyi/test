function CSOptions () {
    var timeControls = [
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
        ];


    function setWatchers() {
        var i;

        for (i in timeControls) {
            byId(timeControls[i]).addEventListener('change', function () {
                csPoll.newPoll(function () {
                    csTable.update();
                });
            });
        }
        for (i in columnControls) {
            byId(columnControls[i]).addEventListener('change', function () {
                csTable.setColumn(this.id, this.value !== '0');
            });
        }
    }


    this.getColumnsVisibilities = function () {
        var result = [],
            i;

        for (i in columnControls) {
            result[i] = byId(columnControls[i]).value !== '0';
        }
        return result;
    };


    setWatchers();
}
function CSPoll () {
    var username = '';
    var password = '';
    var start,
        end,
        alertShown,
        that = this,
        allcolumns,
        timeoutHandle;


    function initAndStart () {
        document.addEventListener('visibilitychange', visibilityChange);

        // Get settings from the /view/ web page.
        username = config('settings', 'username');
        password = config('settings', 'password');
        allcolumns = config('settings', 'allcolumns');      // Show all columns regardless of what options are specified.

        that.newPoll();
    }


    function ajaxGet (uri, success, failure) {
        var xhr = new XMLHttpRequest();
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


    function calcTimeframe () {
        var today = Math.floor(Date.now() / 1000);
        today -= today % 86400;

        var startday = number('startday');
        if (startday === 1) {
            start = new Date(number('start_year') + '.' + number('start_month') + '.' + number('start_day')).getTime() / 1000;
        }
        else {
            start = today + startday * 86400;
        }
        start += number('start_hour') * 3600 + number('start_minute') * 60 + number('start_second');

        var endday = number('endday');
        if (endday == 1) {
            end = new Date(number('end_year') + '.' + number('end_month') + '.' + number('end_day')).getTime() / 1000;
        }
        else {
            end = today + endday * 86400;
        }
        end += number('end_hour') * 3600 + number('end_minute') * 60 + number('end_second');

        //alertShown = false;
    }


    function requestIfVisible () {
        if (!document.hidden && start < Date.now()) {
            var request = '?_username=' + username + ';_password=' + password + ';start=' + start + ';end=' + end;

            ajaxGet(request, response, function () {
                timeoutHandle = setTimeout(requestIfVisible, 4000);
            });
        }
    }


    this.newPoll = function () {
        clearTimeout(timeoutHandle);
        calcTimeframe();
        requestIfVisible();
    };


    function response(response) {
        var update = response.getElementsByTagName('update')[0];

        if (!update) {
            var error = response.getElementsByTagName('errors')[0];
            if (error && !alertShown) {
                alert(error.getElementsByTagName('error')[0].getAttribute('message'));
          //      alertShown = true;
            }
            return;
        }

        // Update start time for next request to server.
        start = update.getAttribute('timestamp');

        var calls = update.getElementsByTagName('cdrs')[0].getElementsByTagName('call');

        // Don't forget to handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.

        //today

        // Next request for update
        timeoutHandle = setTimeout(requestIfVisible, 4000);
    }


    function visibilityChange () {
        clearTimeout(timeoutHandle);
        requestIfVisible();
    }


    function config(form, field) {
        if (document[form][field]) {
            return document[form][field].value;
        }
    }


    function option(id) {
        return byId(id).value;
    }


    function number(id) {
        return +byId(id).value;
    }


    initAndStart();
}
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
function byId (id) {
    return document.getElementById(id);
}
document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();

    window.csTable = new CSTable(byId('left-content'), {
            visibleColumns: csOptions.getColumnsVisibilities()
        });

    window.csPoll = new CSPoll();

});


function qstatistics_begin () {

}