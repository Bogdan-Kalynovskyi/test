function CSOptions () {

    function setWatchers() {
        var i;

        for (i in timeControls) {
            byId(timeControls[i]).addEventListener('change', function () {
                csPoll.rePoll();
                dirty();
            });
        }
        for (i in columnControls) {
            byId(columnControls[i]).addEventListener('change', function () {
                var pos = columnControls.indexOf(this.id);
                csBase.visibleCols[pos] = +this.value;
                csBase.filter();
                csTable.createHeader();
                dirty();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                csBase.visibleRows[pos] = +this.value;
                csBase.filter();
                dirty();
            });
        }
        for (i in queueControls) {
            byId(queueControls[i]).addEventListener('change', function () {
                csBase.filter();
                dirty();
            });
        }
        for (i in filterByList) {
            byId(filterByList[i]).addEventListener('change', function () {
                csBase.filter();
                dirty();
            });
        }

        byId('period').addEventListener('change', function () {
            PERIOD = +this.value;
            csBase.filter();
            dirty();
        });
    }


    this.getColumns = function () {
        var result = [];

        for (var i in columnControls) {
            result[i + 1] = +byId(columnControls[i]).value;
        }
        return result;
    };


    this.getRows = function () {
        var result = [];

        for (var i in destControls) {
            result[i] = +byId(destControls[i]).value;
        }
        return result;
    };

    
    this.config = function (form, field) {
        if (document[form][field]) {
            return document[form][field].value;
        }
    };


    this.get = function (id) {
        return byId(id).value;
    };
    this.getNumber = function (id) {
        return +byId(id).value;
    };


    PERIOD = +byId('period').value;

    setWatchers();
}