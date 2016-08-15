var refresh_visible = 2000;
var refresh_hidden = 10000;
var refresh_current = refresh_visible;
var david = 1;

var hidden_property = '';
var timeout_handle = null;
var error_alerted = 0;

var username = '';
var password = '';
var start = null;
var end = null;

function qstatistics_begin() {
	var properties = {
		hidden: "visibilitychange",
		mozHidden: "mozvisibilitychange",
		webkitHidden: "webkitvisibilitychange",
		msHidden: "msvisibilitychange",
		oHidden: "ovisibilitychange"
	};

	var value = null;
	for ( hidden_property in properties ) {
		if ( properties.hasOwnProperty( hidden_property ) && hidden_property in document ) {
			value = properties[ hidden_property ];
			break;
		}
	}

	if ( value ) {
		document.addEventListener( value, qstatistics_visible_change );
	} else if (/*@cc_on!@*/false) { // IE 9 and earlier
		document.onfocusin = document.onfocusout = qstatistics_visible_change;
	} else {
		window.onfocus = window.onblur = qstatistics_visible_change;
	}

	// Get settings from the /view/ web page.
	username = config( 'settings', 'username', 'string' );
	password = config( 'settings', 'password', 'string' );
	refresh_visible = config( 'settings', 'refresh', 'number' ); // Override refresh interval.
	refresh_current = refresh_visible;
	debug = config( 'settings', 'debug', 'number' ); // If enabled log debugging information to browser console.
	allcolumns = config( 'settings', 'allcolumns', 'number' ); // If enabled show all columns regardless of what options are specified.

	// Set up page here.

	// Make first request for data.
	qstatistics_request();
}

var qstatistics_request = function() {
	// Get current timestamp
	if ( ! Date.now ) {
		// For IE.
		Date.now = function() { return new Date().getTime(); }
	}
	var now = Math.floor( Date.now() / 1000 );

	// Start timestamp
	if ( start == null ) {
		start = now;

		var startday = option( 'startday', true );
		
		if ( startday == 1 ) {
			var start_year = option( 'start_year', true );
			var start_month = option( 'start_month', true );
			var start_day = option( 'start_day', true );
			start = new Date( start_year + '.' + start_month + '.' + start_day ).getTime() / 1000;
		
		} else {
			start = now - ( now % 86400 ) - ( startday * 86400 );
		}
		
		start = start + ( option( 'start_hour', true ) * 3600 ) + ( option( 'start_minute', true ) * 60 ) + option( 'start_second', true );
	}

	// End timestamp
	if ( end == null ) {
		end = now;

		var endday = option( 'endday', true );
		
		if ( endday == 1 ) {
			var end_year = option( 'end_year', true );
			var end_month = option( 'end_month', true );
			var end_day = option( 'end_day', true );
			end = new Date( end_year + '.' + end_month + '.' + end_day ).getTime() / 1000;
		
		} else {
			end = now - ( now % 86400 ) - ( endday * 86400 );
		}
		
		end = end + ( option( 'end_hour', true ) * 3600 ) + ( option( 'end_minute', true ) * 60 ) + option( 'end_second', true );
	}

	// Make request	for data
	var request = '/local/qstatistics/update/?_username=' + username + ';_password=' + password + ';start=' + start + ';end=' + end;
	if ( debug ) console.log( 'Requesting: ' + request );

	ajax_get( request, qstatistics_update );

	if ( timeout_handle ) {
		clearTimeout( timeout_handle );
	}
}

function qstatistics_update( response ) {
	// Process update
	var update = response.getElementsByTagName( 'update' )[ 0 ];

	if ( ! update ) {
		var error = response.getElementsByTagName( 'errors' )[ 0 ];
		if ( error && error_alerted == 0 ) {
			alert( error.getElementsByTagName( 'error' )[ 0 ].getAttribute( 'message' ) );
			error_alerted = 1;
		}
		return;
	}

	error_alerted = 0;

	// Update start time for next request to server.
	start = update.getAttribute( 'timestamp' );

	// Main functionality here...

	var calls = update.getElementsByTagName( 'cdrs' )[ 0 ].getElementsByTagName( 'call' );
	console.log( 'Got ' + calls.length + ' CDRs' );

	// Don't forget to handle the change of day at midnight. If the start or end day is not a specific date then the report period will change every day.

	// Next request for update
	timeout_handle = window.setTimeout( 'qstatistics_request()', refresh_current );
}

function qstatistics_visible_change ( e ) {
	var body = document.body;
	e = e || window.event;

	if ( e.type == 'focus' || e.type == 'focusin' ) {
		if ( debug ) console.log( 'Focus in' );
		refresh_current = refresh_visible;
		qstatistics_request();

	} else if ( e.type == 'blur' || e.type == 'focusout' ) {
		if ( debug ) console.log( 'Focus out' );
		refresh_current = refresh_hidden;

	} else if ( this[ hidden_property ] ) {
		if ( debug ) console.log( 'Hidden' );
		refresh_current = refresh_hidden;

	} else {
		if ( debug ) console.log( 'Visible' );
		refresh_current = refresh_visible;
		qstatistics_request();
	}
}

function config ( form, field, type ) {
	if ( document[ form ][ field ] == undefined ) console.log( 'No config for ' + form + '.' + field );
	var value = document[ form ][ field ].value;

	if ( type == 'number' ) {
		return Number( value );
	} else {
		return value;
	}
}

function option ( id, number ) {
	var element = document.getElementById( id );
	if ( element == undefined ) console.log( 'No option for ' + id );
	var value = element.value;

	if ( number ) {
		return Number( value );
	} else {
		return value;
	}
}

