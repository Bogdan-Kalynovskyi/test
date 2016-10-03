(function () {
	var main = byId('main-content'),
		openBtn = byId('panel-open-button'),
		heading = byId('options-heading'),
		navbar = byId('nav_bar'),
		content = byId('left-content'),
		panel = byId('right-panel'),
		isExpanded = false;


	function eqHeight () { 
		if (window.csUI) {
			content.style.height = '';
			panel.style.height = '';
			var contentHeight = content.children[TYPES.indexOf(csUI.type)].scrollHeight,
				navbarHeight = navbar.offsetHeight,
				maxHeight = Math.max(contentHeight, navbarHeight, isExpanded ? (panel.scrollHeight - 10) : 0);

			content.style.height = maxHeight + 'px';
		}
	}

	window.rightPanelEqHeight = eqHeight;


	function toggle () {
		isExpanded = !isExpanded;
		if (isExpanded) {
			panel.classList.add('expanded');
			openBtn.classList.add('expanded');
		}
		else {
			panel.classList.remove('expanded');
			openBtn.classList.remove('expanded');
		}
		eqHeight();
	}
 

	if (panel.classList.contains('expanded')) {
		toggle();
	}

	openBtn.addEventListener('click', toggle);
	heading.addEventListener('click', toggle);

	window.addEventListener('resize', function () {
		if (isExpanded) {
			eqHeight();
		}
	});
})();
