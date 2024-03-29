function centerToken(tokenId){
	if(typeof tokenId == 'object'){return tokenId;}

	token = getObj("graphic", tokenId)

	x = parseInt(token.get("left")) //+ parseInt(token.get("width")) / 2
	y = parseInt(token.get("top")) //+ parseInt(token.get("height")) / 2

	return [x, y]
}

function onSegment(p, q, r){
	// check if q is on segment pq
	if((q[0] <= Math.max(p[0], r[0])) & (q[0] >= Math.min(p[0], r[0])) & 
		(q[1] <= Math.max(p[1], r[1])) & (q[1] >= Math.min(p[1], r[1]))){
		return true
	}
	return false
}

function tripletOrientation(p, q, r){
	// orientation of ordered triplet p, q, r
	// 0: colinear
	// 1: clockwise points
	// 2: counterclockise

	val = ((q[1] - p[1]) * (r[0] - q[0])) - ((q[0] - p[0]) * (r[1] - q[1]))
	if(val > 0){
		// clockwise
		return 1;
	}
	else if(val < 0){
		// counter clockwise
		return 2;
	}
	else {
		// colinear
		return 0
	}
}

function checkLineBlock(tokenId1, tokenId2, line){
	log("checkLineBlock")

	linePoints = JSON.parse(line.get("path"))

	log(linePoints)
	for (var i = linePoints.length - 1; i > 0; i--) {
		var p1 = [...linePoints[i]]
		var q1 = [...linePoints[i - 1]]
		log(p1)
		log(q1)

		if((p1[0] == "M" | p1[0] == "L") & (q1[0] == "M" | q1[0] == "L")){
			p1 = p1.splice(1)
			q1 = q1.splice(1)
			// need to get these when rotated!!!!!
			angle = parseFloat(line.get("rotation")) * (Math.PI / 180) 
			
			l1 = p1[0]
			p1 = [Math.cos(angle) * l1, Math.sin(angle) * l1]
			log(p1)

			l1 = q1[0]
			q1 = [Math.cos(angle) * l1, Math.sin(angle) * l1]
			log(q1)

			//NEED TO ADD TOP AND LEFT
			p1 = [p1[0] + parseFloat(line.get("left") - parseFloat(line.get("width")) / 2), 
				p1[1] + parseFloat(line.get("top")) - parseFloat(line.get("height")) / 2]
			q1 = [q1[0] + parseFloat(line.get("left") - parseFloat(line.get("width")) / 2), 
				q1[1] + parseFloat(line.get("top")) - parseFloat(line.get("height")) / 2]

		}
			
		else {return false;}

		// check line from token centers
		var p2 = centerToken(tokenId1)

		var q2 = centerToken(tokenId2)

		o1 = tripletOrientation(p1, q1, p2)
	    o2 = tripletOrientation(p1, q1, q2)
	    o3 = tripletOrientation(p2, q2, p1)
	    o4 = tripletOrientation(p2, q2, q1)

	    // # General case
	    if ((o1 != o2) & (o3 != o4)) {
	    	return true
	  	}
	    // # Special Cases
	  
	    // # p1 , q1 and p2 are colinear and p2 lies on segment p1q1
	    if ((o1 == 0) & onSegment(p1, p2, q1)) {
	    	return true
	    }
	  
	    // # p1 , q1 and q2 are colinear and q2 lies on segment p1q1
	    if ((o2 == 0) & onSegment(p1, q2, q1)){
	    	return true
	    }
	  
	    // # p2 , q2 and p1 are colinear and p1 lies on segment p2q2
	    if ((o3 == 0) & onSegment(p2, p1, q2)){
	    	return true
	    }
	  
	    // # p2 , q2 and q1 are colinear and q1 lies on segment p2q2
	    if ((o4 == 0) & onSegment(p2, q1, q2)){
	    	return true
	    }
	  
	}
	// # If none of the cases
	return false
}

function getLineToken(lineId){
	log("getlineToken")
	// loop through characters
	for(var tokenId in state.HandoutSpellsNS.OnInit){
		// check current attack in current spell
		// assume barrier is a spell
		spell = state.HandoutSpellsNS.OnInit[tokenId].currentSpell
		
		if(!_.isEmpty(spell) && spell.type == "Barrier"){
			// check Channel for line
			log(spell.attacks.Channel.line)
			log(lineId)
			if(spell.attacks.Channel.line == lineId){return spell.attacks.Base.targetType.shape.targetToken}
		}
	}

	// loop through static effects
	return false
}

function getBarrierSpell(lineId){
	// loop through characters
	for(var tokenId in state.HandoutSpellsNS.OnInit){
		// check current attack in current spell
		// assume barrier is a spell
		spell = state.HandoutSpellsNS.OnInit[tokenId].currentSpell
		
		if(!_.isEmpty(spell) && spell.type == "Barrier"){
			// check Channel for line
			if(spell.attacks.Channel.line == lineId){return spell}
		}
	}

	// loop through static effects
	return false
}

function barrierReduce(tokenId, targetId, damage, blockingLines){
	log(damage)
	// var blockingLines = checkBarriers(tokenId, targetId)

	if(blockingLines.length < 1) {return [damage,{}]}

	pageid = getObj("graphic", targetId).get("_pageid")
	var remainingDamage = damage
	var damageReduced = {}
	_.each(blockingLines, function(blockingLine){
		// get the token for the line
		// lineToken = findObjs({
		// 	_type: "graphic",
		// 	_pageid: pageid,
		// 	name: blockingLine
		// })[0]
		lineTokenId = getLineToken(blockingLine)
		log(lineTokenId)

		if(lineTokenId){
			lineToken = getObj("graphic", lineTokenId)
			damageReduced[lineToken.get("id")] = Math.min(lineToken.get("bar1_value"), remainingDamage)
			newLineHealth = Math.max(parseInt(lineToken.get("bar1_value")) - remainingDamage, 0)
			remainingDamage = Math.max(remainingDamage - parseInt(lineToken.get("bar1_value")), 0)

			if(newLineHealth == 0){
				// barrier destroyed
				// get spell
				lineSpell = getBarrierSpell(blockingLine)
				removeBarrier(lineSpell)
				removeStatic(lineSpell)
				// state.HandoutSpellsNS.OnInit[tokenId].currentSpell = {}
			}
			else {
				// barrier remains, adjust current
				lineToken.set("bar1_value", newLineHealth)
			}

			if(remainingDamage == 0){return [remainingDamage, damageReduced]}
		}
	})

	return [remainingDamage, damageReduced];
}

function checkBarriers(tokenId, targetId){
	log("check barriers")

	pageid = getObj("graphic", tokenId).get("_pageid")

	var lines = findObjs({
		_type: "path",
		_pageid: pageid,
		layer: "objects",
		stroke: "#9900ff"
	})

	var blocking = []
	_.each(lines, function(line){
		if(checkLineBlock(tokenId, targetId, line)){
			// barrier is blocking the attack!!
			blocking.push(line.get("_id"))
		}
	})
	log(blocking)
	return blocking
}

function lineLength(pathId, drawingArgs){
	log("line length")
	line = getObj("path", pathId)
	points = JSON.parse(line.get("_path"))

	tokenId = drawingArgs[1]
	maxLength = drawingArgs[0]

	obj = getObj("graphic", tokenId)
	page = getObj("page", obj.get("pageid"))
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));

	var totalDistance = 0;
	var x = 0;
	var y = 0;
	var newLine = []

	for (var i = 0; i < points.length - 1; i++) {
		var p1 = points[i]
		var q1 = points[i + 1]

		x = parseFloat(q1[1]) - parseFloat(p1[1])
		y = parseFloat(q1[2]) - parseFloat(p1[2])
		newDistance = Math.sqrt(x**2 + y**2) / gridSize * 5.0
		newLine.push(p1)

		if((totalDistance + newDistance) > maxLength){
			// trim line to max length
			log("trim")
			x = x / newDistance * (maxLength - totalDistance);
			y = y / newDistance * (maxLength - totalDistance);

			newLine.push([q1[0], parseInt(p1[1]) + x, parseInt(p1[2]) + y])
			break;
		}

		totalDistance += newDistance
		
	}

	// create new line
	createObj("path", {
		_path: JSON.stringify(newLine),
		_pageid: line.get("_pageid"),
		stroke: "#9900ff",
		layer: "objects",
		width: line.get("width"),
		height: line.get("height"),
		top: line.get("top"),
		left: line.get("left"),
		controlledby: tokenId
	})

	newPath = findObjs({
		_type: "path",
		_pageid: line.get("_pageid"),
		_path: JSON.stringify(newLine)
	})[0]

	var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
	casting["line"] = newPath.get("_id")
}

async function lineTarget(tokenId){
	log("lineTarget")

	var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
	let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType"]);

	var maxLength = spellStats["TargetType"].split(" ")[1]
	maxLength = parseInt(maxLength)

	// add token to watch list for drawing
	charId = getCharFromToken(tokenId)
	playerIds = getObj("character", charId).get("controlledby").split(",")

	_.each(playerIds, function(playerId){
		state.HandoutSpellsNS.Drawing[playerId] = [maxLength, tokenId]		
	})
	log(state.HandoutSpellsNS.Drawing)
}

async function effectBarrier(tokenId){
	log("effect barrier")

	var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
	var channeled = false
	if(_.isEmpty(casting)){
		channeled = true
		casting = state.HandoutSpellsNS.turnActions[tokenId].channel
	}
	let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType", "BaseDamage", "Magnitude", "Code"]);

	// check for crit
	var critMag = 0
	let critMagObj = await getAttrObj(getCharFromToken(tokenId), "251_crit_barrier_mag")
	var baseMag = parseInt(spellStats["Magnitude"])
	if(state.HandoutSpellsNS.crit[tokenId] > 0){
		critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
		critMagObj.set("current", critMag)
		state.HandoutSpellsNS.crit[tokenId] -= 1
	}

	// calculate barrier health
	rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 2, "1"))[0].reduce((a, b) => a + b, 0)
	rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 2, "3"))[0].reduce((a, b) => a + b, 0)
	let shield = await attackRoller("[[(" + baseMag + "+" + rollCount + ")*" + spellStats["BaseDamage"] + "+" + rollAdd + "]]")
	log(shield)

	if(channeled){
		log("channeled")
		// reset on channel

		lineToken = getObj("graphic", casting.lineToken)

		lineToken.set({
			bar1_value: shield[1],
			bar1_max: shield[1]
		})

		// get status damage
		statusList = state.HandoutSpellsNS.turnActions[lineToken.get("id")].statuses
		damage = 0
		for (var status in statusList) {
	        damage += (statusList[status].damageTurn * statusList[status].magnitude)
	    }

	    // apply status damage
	    lineToken.set("bar1_value", Math.max(0, parseInt(lineToken.get("bar1_value")) - damage))
		
		// decrement the statuses
        statusChange(lineToken.get("id"));
	}
	else {
		playerToken = getObj("graphic", tokenId)
		line = getObj("path", casting.line)

		//position for token
		top = parseFloat(line.get("top"))
		left = parseFloat(line.get("left"))
		page = getObj("page", playerToken.get("pageid"))
        var gridSize = 70 * parseFloat(page.get("snapping_increment"));

		// create a token representing the barrier
		createObj("graphic",{
	        controlledby: playerToken.get("controlledby"),
	        left: left,
	        top: top,
	        width: gridSize,
	        height: gridSize,
	        name: casting.line,
	        pageid: playerToken.get("pageid"),
	        imgsrc: "https://s3.amazonaws.com/files.d20.io/images/199532447/Q_os8m3DmtbXdi09P0lw6A/thumb.png?1612817286",
	        layer: "gmlayer",
	        bar1_value: shield[1],
	        bar1_max: shield[1]
		})

		newToken = findObjs({
			_type: "graphic",
			_pageid: playerToken.get("pageid"),
			name: casting.line
		})[0]

		casting["lineToken"] = newToken.get("id")

		state.HandoutSpellsNS.turnActions[casting.lineToken] = {
                channel: {},
                statuses: {},
                casting: {}, 
                castCount: 0,
        }

		state.HandoutSpellsNS.turnActions[tokenId].channel = state.HandoutSpellsNS.turnActions[tokenId].casting
	    state.HandoutSpellsNS.turnActions[tokenId].casting = {}	
	}

	// spell output
	replacements = {
		"SHIELD": shield[0],
		"PLACEHOLDER": casting.spellName,
	}

	setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
    let spellString = await getSpellString("BarrierEffect", replacements)
    sendChat(name, "!power " + spellString)

    critMagObj.set("current", 0)
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    
    var args = msg.content.split(/\s+/);

    if (msg.type == "api" && msg.content.indexOf("!CheckBlock") !== -1) {
    	log("check block")
    	tokenId = args[1]
    	targetId = args[2]
    	checkBarriers(tokenId, targetId)
    }

});

// on("ready", function(){
// 	on("add:path", function(obj){
// 		log("path has added")
// 		playerIds = obj.get("controlledby").split(",") // player that drew line

// 		var target = false
// 		_.each(playerIds, function(playerId){
// 			if(playerIsGM(playerId) & "" in state.HandoutSpellsNS.Drawing){
// 				lineLength(obj.get("id"), state.HandoutSpellsNS.Drawing[""])
// 				target = true
// 			}

// 			if(playerId in state.HandoutSpellsNS.Drawing){
// 				lineLength(obj.get("id"), state.HandoutSpellsNS.Drawing[playerId])
// 				target = true
// 			}
// 		})

// 		if(target) {obj.remove();}
// 	});
// });

// on("destroy:path", function(obj){
// 	playerIds = obj.get("controlledby").split(",")

// 	_.each(playerIds, function(playerId){
// 		if(playerId in state.HandoutSpellsNS.Drawing){
// 			tokenId = state.HandoutSpellsNS.Drawing[playerId][1]
// 			var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
// 			if(casting.line == obj.get("_id")) {casting["line"] = ""}
// 		}
// 	})
// })
