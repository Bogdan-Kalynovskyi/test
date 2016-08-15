(function () {
	function byId (id) {
		return document.getElementById(id);
	}

	var main = byId('main-content'),
		openBtn = byId('panel-open-button'),
		heading = byId('options-heading'),
		navbar = byId('nav_bar'),
		content = byId('left-content'),
		panel = byId('right-panel'),
		panelHeight = parseFloat(window.getComputedStyle(panel).height),
		isExpanded = false;

	panel.style.height = 'calc(100% - 5px)';


	function eqHeight () {
		content.style.height = '';
		panel.style.height = '';
		var contentHeight = parseFloat(window.getComputedStyle(content).height),
			navbarHeight = parseFloat(window.getComputedStyle(navbar).height),
			maxHeight = Math.max(contentHeight, navbarHeight, panelHeight + 5);

		content.style.height = maxHeight + 'px';
		panel.style.height = maxHeight - 5 + 'px';
	}


	function expand () {
		panel.classList.add('expanded');
		eqHeight();
		isExpanded = true;
	}


	function collapse () {
		panel.classList.remove('expanded');
		content.style.height = '';
		isExpanded = false;
	}


	if (panel.classList.contains('expanded')) {
		expand();
	}

	openBtn.addEventListener('click', expand);
	heading.addEventListener('click', collapse);

	window.addEventListener('resize', function () {
		if (isExpanded) {
			eqHeight();
		}
	});
})();
