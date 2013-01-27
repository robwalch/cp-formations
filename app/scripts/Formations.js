(function(window) {
	'use strict';

	var ec = window.ec;
	var cp = window.cp;
	var v = cp.v;

	var GRABABLE_MASK_BIT = 1<<31;
	var NOT_GRABABLE_MASK = ~GRABABLE_MASK_BIT;
	var RADIUS = 32;

	var Formations = ec.Formations = function(space, view) {
		this.space = space;
		this.view = view;
		this.target = null;
		this.units = [];
		this.positions = [];
		this.start();
	};

	var proto = Formations.prototype;

	proto.start = function() {
		this.add(getSegmentShape(v(-1000,  1000), v(-1000, -1000)));
		this.add(getSegmentShape(v(-1000,  1000), v( 1000,  1000)));
		this.add(getSegmentShape(v( 1000,  1000), v( 1000, -1000)));
		this.add(getSegmentShape(v(-1000, -1000), v( 1000, -1000)));
		this.target = this.addUnitBody();
		this.head = this.addSensor();
		this.radialMove = 0;
		this.formation = this.lineup;
		this.formationLength = 5;
		this.updateUnits = this.updateUnitsHungarian;
		this.solution = null;
	};

	proto.step = function(time) {
		//this.update();
		
		for (var i=0, length=this.units.length; i<length; i++) {
			var body = this.units[i];
			var userData = body.userData;
			if (userData.target) {
				var targetPos = userData.target.getPos();
				var movingTo = v.add(targetPos, userData.formationVect);
				setBodyPos(userData.moveToSensor, movingTo);
				setBodyPos(body, v.lerpconst(body.p, movingTo, userData.speed));

				var vector = movingTo.sub(body.p);
				if (setAngleForVector(body, vector) === null) {
					body.a = lerpconst(body.a, userData.moveToSensor.a, 0.1);
				}
			}
		}
	};

	proto.update = function() {
		setBodyPos(this.head, this.view.mouse);
		setAngleForVector(this.head, v.sub(this.targetPos(), this.headPos()));

		this.formation(this.formationLength);
		this.updateUnits(this.positions, this.formationLength);
		//this.updateUnits = this.updateUnitsInOrder;
	};

	proto.changeFormation = function() {
		if (this.formation === this.lineup) {
			this.formation = this.circle;
		} else {
			this.formation = this.lineup;
			this.formationLength++;
		}
		this.solution = null;
		//this.updateUnits = this.updateUnitsHungarian;
		this.update();
	};

	// FORMATIONS

	proto.lineup = function(length, spacing) {
		spacing = spacing || 100;
		
		var mousePos = this.headPos();
		var targetPos = this.targetPos();

		var vector = v.sub(mousePos, targetPos);
		var distance = v.len(vector);
		if (distance < 64) {
			vector.y = 64;
			distance = 64;
		}

		var pos = v.mult(vector, 0.5);
		var perp = v.normalize(v.perp(vector)).mult(spacing);
		pos.sub(v.mult(perp, Math.floor(length/2)));

		var pi = Math.PI;
		var angle = (v.toangle(vector) + pi) % (2*pi);

		// populate positions, compare body positions to formation and assign based on distance
		var positions = this.getFormationVectors(length);
		for (var i=0; i<length; i++) {
			positions[i].x = pos.x;
			positions[i].y = pos.y;
			positions[i].angle = angle;

			pos.add(perp);
		}
	};

	proto.circle = function(length) {
		var mousePos = this.headPos();
		var targetPos = this.targetPos();

		var radius = Math.max(v.len(v.sub(mousePos, targetPos)), 64);//radius
		var pi = Math.PI;
		var pi2 = 2 * pi;
		var circumference = pi2 * radius;
		this.radialMove += 20 / circumference;

		var positions = this.getFormationVectors(length);
		for (var i=0; i<length; i++) {
			var radian = pi2 * i / length;
			radian += this.radialMove;
			var pos = v.forangle(radian).mult(radius);
			positions[i].x = pos.x;
			positions[i].y = pos.y;
			positions[i].angle = (v.toangle(pos) + pi) % pi2;
		}
	};

	// UNIT FORMATION PATH FINDING

	proto.updateUnitsFill = function(positions, length) {
		// TODO: Hungarian algorithm
		positions = positions.slice(0);
		var positionLen = positions.length;
		length = length || positionLen;
		var bodies = this.getUnits(length);
		for (var i=0; i<length; i++) {
			var body = bodies[i];
			var userData = body.userData;
			var formationVect = userData.formationVect;
			userData.target = this.target;

			var index = 0;
			var minDistanceSq = Infinity;
			var bPos = body.getPos();
			for (var j=0; j<positionLen; j++) {
				var distanceSq = v.lengthsq(v.sub(bPos, positions[j]));
				if (distanceSq < minDistanceSq) {
					minDistanceSq = distanceSq;
					index = j;
				}
			}
			formationVect.x = positions[index].x;
			formationVect.y = positions[index].y;
			userData.moveToSensor.setAngle(positions[index].angle);
			positions.splice(index, 1);
			positionLen--;
		}
	};

	proto.updateUnitsInOrder = function(positions, length) {
		length = length || positions.length;
		var bodies = this.getUnits(length);
		for (var i=0; i<length; i++) {
			var body = bodies[i];
			var userData = body.userData;
			var formationVect = userData.formationVect;
			userData.target = this.target;

			formationVect.x = positions[i].x;
			formationVect.y = positions[i].y;
			userData.moveToSensor.setAngle(positions[i].angle);
		}
	};

	proto.updateUnitsHungarian = function(positions, length) {
		positions = positions.slice(0);
		var positionLen = positions.length;
		length = length || positionLen;
		var bodies = this.getUnits(length);

		//quick test to see if we need to reindex positions
		var testIndex = 0;
		var bPos = bodies[testIndex].getPos();
		var distanceSq = v.lengthsq(v.sub(bPos, positions[testIndex]));
		for (var j=1; j<positionLen; j++) {
			if (v.lengthsq(v.sub(bPos, positions[j])) < distanceSq) {
				this.solution = null;
				break;
			}
		}

		var HG = window.Hungarian;
		var solution = this.solution;
		if (!solution) {
			solution = this.solution = HG.hungarianAlgortithm(positions, bodies);
			console.log(solution.join(','));
		}

		for (var i=0; i<solution.length; i++) {
			var pos = positions[solution[i][0]];
			var body = bodies[solution[i][1]];
			var userData = body.userData;
			var formationVect = userData.formationVect;
			userData.target = this.target;

			formationVect.x = pos.x;
			formationVect.y = pos.y;
			userData.moveToSensor.setAngle(pos.angle);
		}
	};

	// FORMATION UTILS

	proto.addUnitBody = function() {
		var shape =  this.add(getCircleShape(RADIUS, 1));
		var body = shape.body;
		body.a = -1.57;
		body.setAngVel(1);
		return body;
	};

	proto.addSensor = function() {
		var shape = this.add(getCircleShape(RADIUS, 1));
		shape.sensor = true;
		return shape.body;
	};

	proto.targetPos = function() {
		return this.target.p;
	};

	proto.headPos = function() {
		return this.head.p;
	};

	proto.getUnits = function(length) {
		var bodies = [];
		for (var i=0; i<length; i++) {
			var body = this.units[i];
			if (!body) {
				body = this.addUnitBody();
				body.userData = {
					target: null,
					formationVect: v(0, 0),
					moveToSensor: this.addSensor(),
					speed: 10
				};
				this.units[i] = body;
			}
			bodies.push(body);
		}
		return bodies;
	};

	proto.getFormationVectors = function(length) {
		for (var i=0; i<length; i++) {
			this.positions[i] = this.positions[i] || v(0, 0);
		}
		return this.positions;
	};

	// WORLD

	proto.add = function(shape) {
		if (!shape.body.isStatic()) {
			this.space.addBody(shape.body);
		}
		this.space.addShape(shape);
		return shape;
	};

	// MATH UTILS

	var min = Math.min;
	var max = Math.max;
	function clamp(f, minv, maxv) {
		return min(max(f, minv), maxv);
	}

	function lerpconst(f1, f2, d) {
		return f1 + clamp(f2 - f1, -d, d);
	}

	// CP UTILS

	function setBodyPos(body, vect) {
		body.activate();
		body.p.x = vect.x;
		body.p.y = vect.y;
	}

	function setAngleForVector(body, vect) {
		if (vect.x || vect.y) {
			//body.setAngle(v.toangle(vect), 0);
			body.rot.x = vect.x;
			body.rot.y = vect.y;
			return body.a = Math.atan2(vect.y, vect.x);
		}
		return null;
	}

	function getBody(mass, moment) {
		// to create a static body specify a mass of zero
		var body;
		if (!mass) {
			// same as world create static body
			body = new cp.Body(Infinity, Infinity);
			body.nodeIdleTime = Infinity;
		} else {
			body = new cp.Body(mass, moment);
		}
		return body;
	}

	function getCircleShape(radius, mass, moment, body) {
		moment = moment || cp.momentForCircle(mass, 0, radius, v(0, 0));//cp.vzero);
		body = body || getBody(mass, moment);
		var shape = new cp.CircleShape(body, radius, v(0, 0));
		shape.setElasticity(0);
		shape.setFriction(1);
		if (mass === 0) {
			shape.setLayers(NOT_GRABABLE_MASK);
		}
		return shape;
	}

	function getBoxShape(width, height, mass, moment, body) {
		moment = moment || cp.momentForBox(mass, width, height);
		body = body || getBody(mass, moment);
		var shape = new cp.BoxShape(body, width, height);
		shape.setElasticity(0);
		shape.setFriction(1);
		if (mass === 0) {
			shape.setLayers(NOT_GRABABLE_MASK);
		}
		return shape;
	}

	function getPolyShape(verts, offset, mass, moment, body) {
		offset = offset || v(0,0);
		moment = moment || cp.momentForPoly(mass, verts, offset);
		body = body || getBody(mass, moment);
		body.nodeIdleTime = Infinity;
		var shape = new cp.PolyShape(body, verts, offset);
		shape.setElasticity(0);
		shape.setFriction(1);
		if (mass === 0) {
			shape.setLayers(NOT_GRABABLE_MASK);
		}
		return shape;
	}

	function getSegmentShape(v1, v2) {
		var shape = new cp.SegmentShape(getBody(0), v1, v2, 0);
		shape.setElasticity(0);
		shape.setFriction(1);
		shape.setLayers(NOT_GRABABLE_MASK);
		return shape;
	}

})(window);
