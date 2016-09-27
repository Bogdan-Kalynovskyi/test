function CSChart () {
    var that = this,
        resizeDebounce,
        table,
        dataTable,
        pieDataTable,
        charts = {},
        lastChart,
        options = {
            line: {},
            bar1: {
                orientation: 'horizontal'
            },
            bar2: {
                isStacked: true,
                orientation: 'horizontal'
            },
            pie: {
                is3D: true
            }
        },
        pieFilter = {
            by: 'column',
            id: '0'
        },
        originalZoom;


    function pieChartChooser () {
        var str = '<div id="pi-chooser">Display pie chart:<label>by column <select id="pie-by-column"><option>Choose column</option>';
        for (var i in COLUMNS) {
            str += '<option value="' + i + '">' + COLUMNS[i] + '</option>';
        }
        str += '</select></label><label>, or by row <select id="pie-by-row"><option>Choose row</option>';
        for (i in table) {
            if (table[i].total) {
                str += '<option value="' + i + '">' + table[i][0] + '</option>';
            }
        }
        str += '</select></label></div>';
        byId('chart-chooser').innerHTML = str;

        var byCol = byId('pie-by-column'),
            byRow = byId('pie-by-row');

        byCol.onchange = function () {
            pieFilter = {
                by: 'column',
                id: this.value
            };
            if (pieFilter.id) {
                pieDataTable = getPieDataTable();
                charts.pie.draw(pieDataTable, options[csUI.slide]);
                byRow.selectedIndex = 0;
            }
        };
        byRow.onchange = function () {
            pieFilter = {
                by: 'row',
                id: this.value
            };
            if (pieFilter.id) {
                pieDataTable = getPieDataTable();
                charts.pie.draw(pieDataTable, options[csUI.slide]);
                byCol.selectedIndex = 0;
            }
        };
        byCol.selectedIndex = 1;
    }


    function getPieDataTable () {
        table = table || csBase.getTable();
        var id = +pieFilter.id,
            data = [];

        if (pieFilter.by === 'column') {
            data.push([PERIOD ? 'Time' : 'Destination', COLUMNS[id]]);
            for (var i in table) {
                data.push([table[i][0], table[i][id + 1]]);
            }
        }
        else {
            var tableHeading = getTableHeading();
            for (i in tableHeading) {
                data.push([tableHeading[i], table[id][i]]);
            }
        }

        return google.visualization.arrayToDataTable(data);
    }


    function getDataTable () {
        table = table || csBase.getTable();
        var data = [getTableHeading()].concat(table);
        return google.visualization.arrayToDataTable(data);
    }

    
    function assignZoom (container) {
        function zooming (evt) {
            overlay.style.left = evt.pageX - left + 'px';
        }

        var overlay = byId('zooming'),
            rect = container.getBoundingClientRect(),
            left = rect.left;

        container.onmousedown = function (evt) {
            overlay.style.display = 'block';
            overlay.style.left = evt.pageX - left + 'px';
            overlay.style.right = rect.width - evt.pageX + left + 'px';
            container.onmousemove = zooming;
        };

        container.onmouseup = container.mouseexit = function () {
            overlay.style.display = 'none';
            container.onmousemove = null;
        }
    }
    

    this.render = function (container) {
        if (!window.google || !google.visualization) {
            setTimeout(function () {
                that.render();
            }, 200);
        }
        else {
            google.charts.setOnLoadCallback(function () {
                var type = csUI.slide;
    
                if (!charts[type]) {
                    switch (type) {
                        case 'line':
                            charts[type] = new google.visualization.LineChart(container);
                            break;
                        case 'bar1':
                            charts[type] = new google.visualization.BarChart(container);
                            break;
                        case 'bar2':
                            charts[type] = new google.visualization.BarChart(container);
                            break;
                        case 'pie':
                            charts[type] = new google.visualization.PieChart(container);
                            break;
                    }
                    if (type !== 'pie') {
                        assignZoom(container);
                    }
                }

                if (type !== 'pie') {
                    dataTable = dataTable || getDataTable();
                    charts[type].draw(dataTable, options[type]);
                    byId('chart-chooser').innerHTML = '';
                }
                else if (pieFilter.id) {
                    pieDataTable = pieDataTable || getPieDataTable();
                    charts[type].draw(pieDataTable, options[type]);
                    pieChartChooser();
                }
                originalZoom = {
                    start: START,
                    end: END
                };
                lastChart = charts[type];
            });
        }
    };


    this.invalidate = function () {
        table = dataTable = pieDataTable = undefined;
    };


    this.resize = function () {
        clearTimeout(resizeDebounce);

        resizeDebounce = setTimeout(function () {
            var type = csUI.slide;
            if (charts[type]) {
                charts[type].draw(type === 'pie' ? pieDataTable : dataTable, options[type]);
            }
        }, 100);
    };


    this.downloadPNG = function () {
        if (lastChart) {
            var fileName = (csOptions.get('name') || 'noname') + '.png';
            downloadUrl(lastChart.getImageURI(), fileName);
        }
    };


    byId('reset-zoom').onclick = function () {
        byId('overlay').style.display = 'none';
    }

}