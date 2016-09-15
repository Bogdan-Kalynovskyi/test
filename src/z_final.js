document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();
    window.csUI = new CSUI(byId('left-content'));

    window.csBase = new CSBase(csOptions.getColumns(), csOptions.getRows());

    window.csTable = new CSTable();
    window.csChart = new CSChart();

    window.csPoll = new CSPoll(
        function () {
            csBase.filter();
        }
    );
});


(function () {
    var s = document.createElement('script');
    s.onload = function () {
        google.charts.load('current', {packages: ['line', 'corechart']});
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