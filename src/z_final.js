document.addEventListener("DOMContentLoaded", function() {

    window.csOptions = new CSOptions();

    window.csTable = new CSTable(byId('left-content'), {
            visibleColumns: csOptions.getColumnsVisibilities()
        });

    window.csPoll = new CSPoll();

});


function qstatistics_begin () {

}