(function () {
	var main = byId('main-content'),
		openBtn = byId('panel-open-button'),
		heading = byId('options-heading'),
		navbar = byId('nav_bar'),
		content = byId('left-content'),
		panel = byId('right-panel'),
		panelHeight = panel.offsetHeight,
		isExpanded = false;

	panel.style.height = 'calc(100% - 5px)';


	function eqHeight () { 
		if (window.csUI) {
			content.style.height = '';
			panel.style.height = '';
			var contentHeight = content.children[SLIDES.indexOf(csUI.type)].scrollHeight,
				navbarHeight = navbar.offsetHeight,
				maxHeight = Math.max(contentHeight, navbarHeight, isExpanded ? panelHeight : 0);

			content.style.height = maxHeight + 'px';
			panel.style.height = maxHeight - 5 + 'px';
		}
	}

	window.rightPanelEqHeight = eqHeight;


	function expand () {
		isExpanded = true;
		panel.classList.add('expanded');
		eqHeight();
	}


	function collapse () {
		isExpanded = false;
		panel.classList.remove('expanded');
		eqHeight();
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
