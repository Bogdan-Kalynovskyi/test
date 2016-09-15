function CSChart (container) {
    var that = this,
        updateThrottle,
        currentType,
        gData,
        chart,
        options = {};

    
    function prepareData () {
        var data = [],
            row = [];

        row.push((PERIOD === 0) ? 'Destination' : 'Time');

        for (var i in csBase.colPos) {
            row.push(COLUMNS[csBase.colPos[i]]);
        }
        data.push(row);
        data = data.concat(table);

        gData = google.visualization.arrayToDataTable(data);
    }
    

    this.render = function (table) {
        if (!window.google || !google.visualization) {
            setTimeout(function () {
                that.render(table);
            }, 200);
        }
        else {
            google.charts.setOnLoadCallback(function () {
    
                if (!chart) {
                    chart = new google.charts.Line(container);
                }

                chart.draw(gData, options);
            });
        }
    }; 


    this.resize = function () {
        clearTimeout(updateThrottle);

        updateThrottle = setTimeout(function () {
            if (chart) {
                chart.draw(gData, options);
            }
        }, 100);
    };


    this.downloadPNG = function () {
        var link = document.createElement('a'),
            url = chart.getImageURI();

        link.setAttribute('href', url);
        link.setAttribute('download', (csOptions.get('name') || 'noname') + '.png');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
            document.body.removeChild(link);
        }, 10000);
    };
}