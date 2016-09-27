function CSOptions () {

    function setWatchers() {
        var i;

        for (i in timeControls) {
            byId(timeControls[i]).addEventListener('change', function () {
                csPoll.rePoll();
            });
        }
        for (i in columnControls) {
            byId(columnControls[i]).addEventListener('change', function () {
                var pos = columnControls.indexOf(this.id);
                csBase.setVisibleCols(pos, +this.value);
                csTable.createHeader();
            });
        }
        for (i in destControls) {
            byId(destControls[i]).addEventListener('change', function () {
                var pos = destControls.indexOf(this.id);
                csBase.setVisibleRows(pos, +this.value);
            });
        }
        for (i in queueControls) {
            byId(queueControls[i]).addEventListener('change', function () {
                csBase.filter();
            });
        }
        for (i in filterByList) {
            byId(filterByList[i]).addEventListener('change', function () {
                csBase.filter();
            });
        }

        byId('period').addEventListener('change', function () {
            PERIOD = +this.value;
            csTable.createHeader();
            csBase.filter();
        });

        byId('totalrow').addEventListener('change', function () {
            csUI.update();
        });
    }


    this.getColumns = function () {
        var result = [];
        for (var i in columnControls) {
            result[i] = +byId(columnControls[i]).value;
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
    
    var form = $('form:last-child'),
        dirty = false;
    
    form.find('select, input').on('change', function () {
        dirty = true;
    });
    form.find('input[type=submit]').on('click', function () {
        dirty = false;
    });

    window.onbeforeunload = function () {
        if (dirty) {
            return "You have not saved your report options. If you navigate away, your changes will be lost";
        }
    };
}