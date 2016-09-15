function CSUI (container) {
    var rendered,
        currSlide = 'table',
        currSlideIndex = 0;

    var str = '';
    for (var i in SLIDES) {
        str += '<slide id="slide' + i + '"></slide>';
    }

    container.innerHTML = str +
        '<section id="right-menu"><button onclick="csIU.goTo(\'table\')">tbl</button><button onclick="csIU.goTo(\'line\')">line</button><button onclick="csIU.goTo(\'bar1\')">bar</button><button onclick="csIU.goTo(\'bar2\')">bar2</button><button onclick="csIU.goTo(\'pie\')">pie</button><br><br><button onclick="csTable.downloadCSV()">CSV</button><button onclick="csChart.downloadPNG()">PNG</button></section>';


    var elements = container.children;


    this.goTo = function (slide) {
        var index = SLIDES.indexOf(slide);

        if (index !== currSlideIndex) {
            var nextEl = elements[index];

            if (!rendered[index]) {
                switch (slide) {
                    case 'table':
                        csTable.render(nextEl);
                        break;
                    default:
                        csChart.render(nextEl);
                        break;
                }
            }

            if (index > currSlideIndex) {
                nextEl.style.left = '100%';
            }
            else {
                nextEl.style.left = '-100%';
            }

            nextEl.className = 'transition-slide';
            nextEl.style.left = '0';

            setTimeout(function () {
                nextEl.className = '';
            }, 300);

            currSlideIndex = index;
        }
    };


    this.changed = function () {
        rendered = new Array(slides.length).fill(false);
    };


    this.changed();
    rendered[0] = true;

    
    window.addEventListener('resize', function () {
        if (currSlide === 'table') {
            csTable.resizeHeader();
        }
        else {
            csChart.resize(currSlide);
        }
    });
}