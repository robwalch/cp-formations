var ec = ec || {};
ec.version = '0.1.0';
ec.debug = 0;

(function(window) {
	'use strict';

	var document = window.document;
	var cancelAnimationFrame = window.cancelAnimationFrame;
	var requestAnimationFrame = window.requestAnimationFrame;

	var ec = window.ec;
	var cp = window.cp;
	var v = cp.v;

	var space;
	var cpDebugView;
	var formations;

	var rafId;

	function init() {
		console.log('init');

		resize();
		window.addEventListener('resize', resize, false);

		ec.space =
		space = new cp.Space();
		space.gravity = v(0, 0);
		space.iterations = 10;
		space.sleepTimeThreshold = 3/60;//Infinity;//
		space.idleSpeedThreshold = 1;//5;//0.01;//
		space.collisionSlop = 0.025;
		space.collisionBias = Math.pow(1 - 0.75, 60);
		space.damping = 0.5;//0.99;//
		//space.addCollisionHandler(1, 2, null, null, pushHandler, null);

		cpDebugView = new ec.ChipmunkDebugView(space);
		cpDebugView.show();
		window.addEventListener('resize', function(){
			cpDebugView.resize();
		}, false);

		formations = new ec.Formations(space, cpDebugView);

		cpDebugView.canvas.addEventListener('mousedown', function(){
			formations.changeFormation();
		}, false);

		cpDebugView.canvas.addEventListener('mousemove', function(){
			formations.update();
		}, false);

		ec.run();
	}

	function step(time) {
		rafId = requestAnimationFrame(step);
		formations.step(time);
		space.step(1/60);
		cpDebugView.step();
	}

	function term() {
		if (space) {
			space.locked = 0;
			//space.removeCollisionHandler(1, 2);
			space.bodies.length = 0;
			space.sleepingComponents.length = 0;
			space.constraints.length = 0;
			space.arbiters.length = 0;
			space = null;
		}
	}

	function resize() {
		ec.pixelRatio = window.devicePixelRatio;
		ec.width  = window.innerWidth;
		ec.height = window.innerHeight;

		document.body.style.left =
		document.body.style.top  = '0px';
		document.body.style.width  = ec.width + 'px';
	    document.body.style.height = ec.height + 'px';
	}

	ec.pixelRatio = window.devicePixelRatio;
	ec.width  = window.innerWidth;
	ec.height = window.innerHeight;

	ec.pause = function() {
		cancelAnimationFrame(rafId);
	};

	ec.run = function() {
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(step);
	};

	//document ready
	function docReadyHandler() {
		document.removeEventListener( 'DOMContentLoaded', docReadyHandler, false );
		window.removeEventListener( 'load', docReadyHandler, false );
		document.readyState = 'complete';
		init();
	}
	document.addEventListener( 'DOMContentLoaded', docReadyHandler, false );
	window.addEventListener( 'load', docReadyHandler, false );
	

})(window);