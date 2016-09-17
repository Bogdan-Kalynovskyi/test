function CSUI (container) {
    var that = this,
        upToDate = [],
        zIndex = 1;

    this.slide = 'table';
    this.slideIndex = 0;


    var str = '';
    for (var i in SLIDES) {
        str += '<slide></slide>';
    }

    container.innerHTML = str +
        '<div id="chart-chooser"></div>' +
        '<div id="zooming"></div>' +
        '<button id="reset-zoom" class="universal">Reset zoom</button>' +
        '<section id="right-menu"><button id="go-table" onclick="csUI.goTo(\'table\')">tbl</button><button id="go-line" onclick="csUI.goTo(\'line\')">line</button><button id="go-bar1" onclick="csUI.goTo(\'bar1\')">bar</button><button id="go-bar2" onclick="csUI.goTo(\'bar2\')">bar2</button><button id="go-pie" onclick="csUI.goTo(\'pie\')">pie</button><br><br><button onclick="csBase.downloadCSV()">CSV</button><button id="png" onclick="csChart.downloadPNG()">PNG</button></section>';


    var elements = container.children;


    this.goTo = function (slide) {
        var el = elements[this.slideIndex],
            nextSlideIndex = SLIDES.indexOf(slide),
            nextEl = elements[nextSlideIndex];

        this.slide = slide;

        if (!upToDate[nextSlideIndex]) {
            switch (slide) {
                case 'table':
                    csTable.render(nextEl);
                    break;
                default:
                    csChart.render(nextEl);
                    break;
            }
        }
        upToDate[nextSlideIndex] = true;

        if (nextSlideIndex !== this.slideIndex) {
            el.style.opacity = 0;
            var width = el.offsetWidth;
            el.className = '';

            if (nextSlideIndex > this.slideIndex) {
                nextEl.style.left = width + 'px';
            }
            else {
                nextEl.style.left = -width + 'px';
            }

            nextEl.className = 'transition-slide';
            nextEl.style.zIndex = zIndex++;
            nextEl.clientHeight;
            nextEl.getBoundingClientRect();

            nextEl.style.opacity = 1;
            nextEl.style.left = '0';

            this.slideIndex = nextSlideIndex;
        }

        rightPanelEqHeight();
    };


    this.update = function () {
        upToDate = [];
        csChart.invalidate();
        this.goTo(this.slide);
    };

    
    window.addEventListener('resize', function () {
        if (that.slide === 'table') {
            csTable.resizeHeader();
        }
        else {
            csChart.resize();
        }
    });
}