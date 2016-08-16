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