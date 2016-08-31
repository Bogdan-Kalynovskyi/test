document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();

    window.csBase = new CSBase();
    csBase.visibleCols = csOptions.getColumns();
    csBase.visibleRows = csOptions.getRows();

    window.csTable = new CSTable(byId('left-content'));
    
    window.addEventListener('resize', function () {
        csTable.resizeHeader();
    });

    window.csPoll = new CSPoll(
        function () {
            csBase.filter();
        }
    );
});


(function () {
    var s = document.createElement('script'),
        ua = navigator.userAgent,
        IEVersion = ua.indexOf("MSIE ");

    if (IEVersion !== -1) {
        IEVersion = parseInt(ua.split('MSIE ')[1]);
    } else if (ua.match(/trident.*rv\:11\./)) {
        IEVersion = 11;
    }
    if (IEVersion !== -1 && IEVersion <= 11) {
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/es6-promise/3.2.2/es6-promise.min.js';
        document.head.appendChild(s);
    }
})();


function qstatistics_begin () {

}