function CSPoll () {
    var username = config('settings', 'username'),
        password = config('settings', 'password'),
        start,
        end,
        xhr,
        alertShown,
        that = this,
        allcolumns = config('settings', 'allcolumns'),
        timeoutHandle;


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


    function calcTimeframe () {
        var today = Math.floor(Date.now() / 1000);
        today -= today % 86400;

        var startday = number('startday');
        if (startday === 1) {
            start = new Date(number('start_year'), number('start_month'), number('start_day')).getTime() / 1000;
        }
        else {
            start = today + startday * 86400;
        }
        start += number('start_hour') * 3600 + number('start_minute') * 60 + number('start_second');

        var endday = number('endday');
        if (endday == 1) {
            end = new Date(number('end_year'), number('end_month'), number('end_day')).getTime() / 1000;
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
        if (xhr) {
            xhr.abort();
        }
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
        start = +update.getAttribute('timestamp');

        var calls = update.getElementsByTagName('cdrs')[0].getElementsByTagName('call');

        // Don't forget to handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.

        //today

        // Next request for update
        timeoutHandle = setTimeout(requestIfVisible, 4000);
    }


    function visibilityChange () {
        clearTimeout(timeoutHandle);
        if (xhr) {
            xhr.abort();
        }
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



    document.addEventListener('visibilitychange', visibilityChange);
    this.newPoll();
}