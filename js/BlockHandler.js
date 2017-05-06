BlockHandler = function(con, botID, width, height, BPS, msg) {
	// Constants
	const PIOtypes = {
		Int: 0,
		UInt: 1,
		Long: 2,
		ULong: 3,
		Double: 4,
		Float: 5,
		String: 6,
		ByteArray: 7,
		Bool: 8
	};
	const delay = 10;
	
	// Properties
	this.con = con;
	this.botID = botID;
	this.BPS = (typeof BPS !== 'undefined') ? BPS : 100;
	this.width = width;
	this.height = height;
	this.world = [];
	for (var x = 0; x < this.width; x++) {
		this.world[x] = [];
		for (var y = 0; y < this.height; y++) {
			this.world[x][y] = [{id:0, args:[]}, {id:0, args:[]}];
		}
	}
	this.blockQueue = [];
	this.placingBlocks = false;
	this.stopping = false;
	this.paused = false;
	this.lastBlockPlace = 0;
	this.placerID = 0;
	
	// Private functions
	var blockPlaceTick = function(BH) {
		if (BH.stopping) { BH.stopping = false; return; }
		while (new Date().getTime() > BH.lastBlockPlace + (1000 / BH.BPS)) {
			BH.lastBlockPlace += (1000 / BH.BPS);
			if (BH.blockQueue.length == 0) { 
				BH.placingBlocks = false; 
				return; 
			}
			var args = BH.blockQueue.shift()
			BH.con.send.apply(BH.con, ["b"].concat(args));
		}
		
		setTimeout(function() { blockPlaceTick(BH) }, delay);
	}
	var arraysEqual = function(arr1, arr2) {
		if (arr1.length !== arr2.length) return false;
		for (var i = 0; i < arr1.length; i++) {
			if (arr1[i] !== arr2[i]) return false;
		}
		return true;
	}
	
	// Public Functions
	this.message = function(msg, type, arg3) {
		if (type == "serialised") {
			for (var x = 0; x < this.width; x++) {
				for (var y = 0; y < this.height; y++) {
					this.world[x][y] = [{id:0, args:[]}, {id:0, args:[]}];
				}
			}
			
			var objects = msg._internal_('get-objects');
			var types = msg._internal_('get-types');
			
			var i = 0;
			while (objects[i++] !== "ws") { }
			while (objects[i] !== "we") {
				var id = objects[i++];
				var l = objects[i++];
				var xs = objects[i++];
				var ys = objects[i++];
				var args = [];
				
				while(objects[i] !== "we" &&
					!(types[i  ] == PIOtypes.UInt &&
						types[i+1] == PIOtypes.Int &&
						types[i+2] == PIOtypes.ByteArray &&
						types[i+3] == PIOtypes.ByteArray)) {
					args.push(objects[i++]);
				}
				
				for (var p = 0; p+1 < xs.length; p+=2)
				{
					this.world[(xs[p]<<8) + xs[p+1]][(ys[p]<<8) + ys[p+1]][l] = {id:id, args:args};
				}
			}
		}
		else if (type == "block") {
			var objects = msg._internal_('get-objects');
			
			var args = [];
			var id = 0;
			var l = 0;
			var x = 0;
			var y = 0;
			var pid = 0;
			
			var i1 = -3;
			for (var i2 = 0; i2 < msg.length; i2++) {
				if (i2 === arg3) {
					l = objects[i2];
					continue;
				}
				
				if (i1 == -3) {
					x = objects[i2];
				} else if (i1 == -2) {
					y = objects[i2];
				} else if (i1 == -1) {
					id = objects[i2];
				} else if (i2 == msg.length - 1) {
					pid = objects[i2];
				} else {
					args[i1] = objects[i2];
				}
				
				i1++;
			}
			
			this.placerID = pid;
			if ((tool != 3 && tool != 1) || !enabled) {
				this.world[x][y][l] = {id:id, args:args};
			}
			if (pid != this.botID) {
				lastBlock = {l:l, x:x, y:y, id:id, args:args};
			}
		}
	}
	this.placeBlock = function(l, x, y, id) {
		if (this.world[x][y][l].id != id || !arraysEqual(this.world[x][y][l].args, Array.from(arguments).slice(4)) || tool == 3) {
			this.blockQueue.push(Array.from(arguments));
			if (!this.placingBlocks) {
				this.placingBlocks = true;
				this.lastBlockPlace = new Date().getTime() + delay;
				var BH = this;
				setTimeout(function() { blockPlaceTick(BH) }, delay);
			}
		}
	}
	this.pause = function() {
		if (!this.paused) {
			this.stopping = true;
			this.paused = true;
		}
	}
	this.resume = function() {
		if (this.paused) {
			this.paused = false;
			this.lastBlockPlace = new Date().getTime() + 100;
			var BH = this;
			setTimeout(function() { blockPlaceTick(BH) }, 100);
		}
	}
	
	// Deserialise world
	if (typeof msg !== 'undefined') {
		this.message(msg, "serialised");
	}
}
