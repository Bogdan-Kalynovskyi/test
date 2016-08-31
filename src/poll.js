function CSPoll (onResponse) {
    var that = this,
        username = csOptions.config('settings', 'username'),
        password = csOptions.config('settings', 'password'),
        xhr,
        preloaderShown,
        lastDate,
        requestStart,
        requestEnd,
        timeoutHandle,
        pollDelay = 6000;


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
        var today = Math.floor(Date.now() / 1000);
        today -= today % DAY;

        var startday = csOptions.getNumber('startday');
        if (startday === 1) {
            START = new Date(csOptions.getNumber('start_year'), csOptions.getNumber('start_month'), csOptions.getNumber('start_day')).getTime() / 1000;
        }
        else {
            START = today + startday * DAY;
        }
        START += csOptions.getNumber('start_hour') * 3600 + csOptions.getNumber('start_minute') * 60 + csOptions.getNumber('start_second');

        var endday = csOptions.getNumber('endday');
        if (endday == 1) {
            END = new Date(csOptions.getNumber('end_year'), csOptions.getNumber('end_month'), csOptions.getNumber('end_day')).getTime() / 1000;
        }
        else {
            END = today + endday * DAY;
        }
        END += csOptions.getNumber('end_hour') * 3600 + csOptions.getNumber('end_minute') * 60 + csOptions.getNumber('end_second');

        if (START >= END) {
            alert('Start time should be before end time');
            throw 'start > end';
        }
    }


    function requestIfAllowed () {
        if (!document.hidden) {
            var request = '?_username=' + username + ';_password=' + password + ';start=' + requestStart + ';end=' + requestEnd;
            ajaxGet(request, response, function () {    // on error, poll again
                timeoutHandle = setTimeout(requestIfAllowed, pollDelay);
            });
        }
    }


    this.rePoll = function (start, end) {
        if (start && end) {
            START = start;
            END = end;
        }
        else {
            calcTimeFrame();
        }

        // don't poll regularly
        if (START >= csBase.minTime && END <= csBase.maxTime) {
            onResponse(csBase.filterByTime(START, END));
            return;
        }
        //query what is missing
        else if (START < csBase.minTime && END >= csBase.minTime) {
            onResponse(csBase.filterByTime(csBase.minTime, Math.min(csBase.maxTime, END)));  // return part from cache
            requestStart = START;
            requestEnd = csBase.minTime - 1;
        }
        //query what is missing
        else if (START <= csBase.maxTime/* && END > csBase.maxTime*/) {
            onResponse(csBase.filterByTime(START, csBase.maxTime/*Math.min(csBase.maxTime, END)*/));  // return part from cache
            requestStart = csBase.maxTime + 1;
            requestEnd = END;
        }

        else {
            requestStart = START;
            requestEnd = END;
        }

        clearTimeout(timeoutHandle);
        if (xhr) {
            xhr.abort();
        }
        if (!preloaderShown) {
            showPreloader();
        }
      
        requestIfAllowed();
    };


    function response(response) {
        var update = response.getElementsByTagName('update')[0];

        // break polling loop on error
        if (!update) {
            var error = response.getElementsByTagName('errors')[0];
            if (error && !alertShown) {
                alert(error.getElementsByTagName('error')[0].getAttribute('message'));
            }
        }
        else {
            var updateEnd = +update.getAttribute('timestamp') - 1,
                updateNotEmpty = csBase.add(update, requestStart, Math.min(requestEnd, updateEnd));

            if (updateNotEmpty) {
                onResponse();
            }

            hidePreloader();

            // Handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.
            if (lastDate && lastDate !== (new Date()).getDay()) {
                if (byId('startday').value === '0') {
                    START += DAY;
                }
                if (byId('endday').value === '0') {
                    END += DAY;
                }
            }
            lastDate = (new Date()).getDay();

            if (START >= END) {
                alert('Because start time was set for "Today", it became greater than end time after midnight. Stopping.');
                return;
            }

            if (END <= csBase.maxTime) {
                return;
            }

            requestStart = csBase.maxTime + 1;
            requestEnd = END;

            timeoutHandle = setTimeout(requestIfAllowed, pollDelay);
        }
    }


    function visibilityChange () {
        clearTimeout(timeoutHandle);
        if (xhr) {
            xhr.abort();
        }
        requestIfAllowed();
    }


    function showPreloader () {
        preloaderShown = true;
        var img = document.createElement('IMG');
        img.setAttribute('style',
            'position: fixed;' +
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
    this.rePoll();
}