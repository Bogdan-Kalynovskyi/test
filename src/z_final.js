document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();

    window.csBase = new CSBase(csOptions.getColumns(), csOptions.getRows());

    window.csTable = new CSTable(byId('left-content'));
    window.csChart = new CSChart(byId('line-chart'));
    
    window.addEventListener('resize', function () {
        csTable.resizeHeader();
        csChart.resize();
    });

    window.csPoll = new CSPoll(
        function () {
            csBase.filter();
        }
    );
});


(function () {
    var s = document.createElement('script');
    s.onload = function () {
        google.charts.load('current', {'packages': ['line']});
    };
    s.src = '//www.gstatic.com/charts/loader.js';
    document.head.appendChild(s);


    // patch move_selected
    var savedMoveselect = move_selects;
    move_selects = function () {
        savedMoveselect.apply(window, arguments);
        csBase.filter();
    }

})();


function qstatistics_begin () {

}