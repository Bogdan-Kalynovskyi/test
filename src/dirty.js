function dirty() {
    dirty.state = true;
}


$('[name="submit"]').closest('form').on('submit', function () {
    dirty.state = false; 
});


window.onbeforeunload = function () {
    if (dirty.state) {
        //return "You have not saved your settings. If you navigate away, your changes will be lost";
    }
};