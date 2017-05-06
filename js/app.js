var connection = null,
BH = null,
winTools = null,
prevBlock = null,
lastBlock = null,
points = [],
copiedBlocks = [],
tool = 0,
enabled = true;

function check() {
	var Email = document.getElementById("email").value;
	if ((Email == "guest") || (Email == "guest@lol.dk")) {
		document.getElementById("email").value = "";
		document.getElementById("password").value = "";
	}
	else {
		if (connection === null) connect();
		else disconnect();
	}
}

function connect() {
	loginButton("pending");
	$("#msgError").innerHTML = "";
	var RoomID = $("#roomID").val();
	var Email = $("#email").val();
	var Password = $("#password").val();
	
	PlayerIO.useSecureApiRequests = true;

	PlayerIO.authenticate("everybody-edits-su9rn58o40itdbnw69plyw", "simpleUsers", { email: Email, password: Password }, {}, function(client) {
		console.log("Authenticated to PlayerIO as: " + client.connectUserId);		
		client.multiplayer.useSecureConnections = true;
		
		client.bigDB.load("config", "config", function(config) {
			client.multiplayer.createJoinRoom(RoomID, "Everybodyedits" + config.version, true, null, null, function(connection) {
				window.connection = connection;
				connection.send("init");
				
				connection.addMessageCallback("*", function (m) {
					if (m.type == "init") {
						if (m.getString(0) != m.getString(17)) {
							$("#msgError").html("Account must be World Owner");
							disconnect();
						}
						else {
							BH = new BlockHandler(connection, m.getInt(5), m.getInt(22), m.getInt(23), 20, m);
							tool = 0;
							openWinTools();
							loginButton("connected");
						}
					}
					else if (m.type == "b" || m.type == "br" || m.type == "bc" || m.type == "bs" || m.type == "lb" || m.type == "pt" || m.type == "ts" || m.type == "wp") {
						if (m.type == "b") {
							BH.message(m, "block", 0);
						}
						else if (m.type == "br") {
							BH.message(m, "block", 4);
						}
						else {
							BH.message(m, "block");
						}
						if(BH.placerID != BH.botID)
						{
							runTool();
						}
					}
				});
			}, callbackError);
		}, callbackError);
	}, callbackError);
}

function disconnect() {
	if (connection && connection.connected) { 
		connection.disconnect();
	}
	connection = null;
	BH = null;
	closeWinTools();
	loginButton("disconnected");
}

function callbackError(error) {
	console.log("ERROR: " + error.code + ": " + error.message);
	$("#msgError").html(error.code);
	disconnect();
}

function runTool() {
	if (winTools && enabled) {
	switch(tool) {
		case 0:
		break;
		case 1:
			fill(lastBlock.l, lastBlock.x, lastBlock.y, lastBlock);
		break;
		case 2:
			rectangle();
		break;
		case 3:
			drawPoints();
		break;
		default:
		console.log("failed");
		break;
	}
	}
}

function fill(l, x, y, newValue) {
	winTools.toolsEnabled(false);
	var target = BH.world[x][y][l];
	var queue = [{x:x, y:y}], item;

	while (queue.length) {
		item = queue.shift();
		x = item.x;
		y = item.y;
		if (BH.world[x][y][l].id == target.id && arraysEqual(BH.world[x][y][l].args, target.args)) {
			BH.placeBlock(l, x, y, newValue.id, ...newValue.args);
			BH.world[x][y][l] = {id:newValue.id, args:newValue.args};
			if (x > 0) {
			queue.push({x:x-1, y:y})
			}
			if (x + 1 < BH.width) {
			queue.push({x:x+1, y:y})
			}
			if (y > 0) {
			queue.push({x:x, y:y-1});
			}
			if (y + 1 < BH.height) {
			queue.push({x:x, y:y+1});
			}
		}
	};
	awaitBlockPlacing();
}

function rectangle() {
	if (prevBlock !== null && prevBlock.id == lastBlock.id) {
		winTools.toolsEnabled(false);
		var p1 = prevBlock;
		var p2 = lastBlock;
		var left = Math.min(p1.x, p2.x);
		var right = Math.max(p1.x, p2.x);
		var top = Math.min(p1.y, p2.y);
		var bottom = Math.max(p1.y, p2.y);

		for (var x = left; x <= right; x++)
			for (var y = top; y <= bottom; y++)
				BH.placeBlock(p2.l, x, y, p2.id, ...p2.args);

		prevBlock = null;
		awaitBlockPlacing();
	}
	else prevBlock = jQuery.extend(true, {}, lastBlock);
}

function drawPoints() {
	var x = lastBlock.x;
	var y = lastBlock.y;
	points.push({x:x, y:y});
	BH.placeBlock(0, x, y, 5);
	
	if (points.length == 2) {
		winTools.$("#copy").prop('disabled', false);
		winTools.$("#cut").prop('disabled', false);
	}
	else if (points.length > 2) {
		var item = points.shift();
		x = item.x;
        	y = item.y;
		var block = BH.world[x][y][0];
		BH.placeBlock(0, x, y, block.id, ...block.args);
	}
}

function erasePoints() {
	while (points.length) {
		var item = points.shift();
		var x = item.x;
		var y = item.y;
		var block = BH.world[x][y][0];
		BH.placeBlock(0, x, y, block.id, ...block.args);
	}
	copiedBlocks = [];
}

function copy(cut) {
	if (cut) winTools.toolsEnabled(false);
	var p1 = points[0];
	var p2 = points[1];
	var left = Math.min(p1.x, p2.x);
	var right = Math.max(p1.x, p2.x);
	var top = Math.min(p1.y, p2.y);
	var bottom = Math.max(p1.y, p2.y);
	copiedBlocks = [];

	for (var x = left + 1; x < right; x++) {
		copiedBlocks[x-left-1] = [];
		
		for (var y = top + 1; y < bottom; y++) {
			copiedBlocks[x-left-1][y-top-1] = [{id:0, args:[]}, {id:0, args:[]}];
			copiedBlocks[x-left-1][y-top-1][0] = { id:BH.world[x][y][0].id, args:BH.world[x][y][0].args };
			copiedBlocks[x-left-1][y-top-1][1] = { id:BH.world[x][y][1].id, args:BH.world[x][y][1].args };
			
			if (cut) {
				BH.placeBlock(0, x, y, 0);
				BH.placeBlock(1, x, y, 0);
			}
		}
	}
	if (cut) awaitBlockPlacing();
	winTools.$("#paste").prop('disabled', false);
}

function paste() {
	winTools.toolsEnabled(false);
	var p = points[points.length-1];
	for (var x = 0; x < copiedBlocks.length; x++) {
		if (x + p.x >= BH.width) break;
		for (var y = 0; y < copiedBlocks[x].length; y++) {
			if (y + p.y >= BH.height) break;
			var fg = copiedBlocks[x][y][0];
			var bg = copiedBlocks[x][y][1];
			BH.placeBlock(0, x + p.x, y + p.y, fg.id, ...fg.args);
			BH.placeBlock(1, x + p.x, y + p.y, bg.id, ...bg.args);
		}
	}
	awaitBlockPlacing();
}

function awaitBlockPlacing() {
	var blockTimer = window.setInterval(function () {
		if (!BH.placingBlocks) {
			window.clearInterval(blockTimer);
			winTools.toolsEnabled(true);
		}
	}, 200);
}

function openWinTools() {
	winTools = window.open("toolbar.html", "windowTools", "toolbar=no, scrollbar=no, resizable=no, width=370, height=100");

	var pollTimer = window.setInterval(function () {
		if (winTools && winTools.closed !== false) {
			window.clearInterval(pollTimer);
			disconnect();
		}
	}, 200);
}

function closeWinTools() {
	if (winTools && !winTools.closed) winTools.close();
}

window.onunload = function () {
	closeWinTools();
};

function loginButton(status) {
	switch (status) {
	case "disconnected":
		$("#loginBtn").prop("disabled", false);
		$("#loginBtn").css("background-color", "#e74c3c");
		$("#loginBtn").attr("class", "fa fa-sign-in");
		break;
	case "pending":
		$("#loginBtn").prop("disabled", true);
		$("#loginBtn").css("background-color", "#aaaaaa");
		break;
	case "connected":
		$("#loginBtn").prop("disabled", false);
		$("#loginBtn").css("background-color", "#8ee002");
		$("#loginBtn").attr("class", "fa fa-sign-out fa-flip-horizontal");
		break;
	}
}

var arraysEqual = function(arr1, arr2) {
	if (arr1.length !== arr2.length) return false;
	for (var i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}
