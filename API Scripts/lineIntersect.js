function centerToken(tokenId){
	token = getObj("graphic", tokenId)

	x = parseInt(token.get("left")) + parseInt(token.get("width")) / 2
	y = parseInt(token.get("top")) + parseInt(token.get("height")) / 2

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

function checkLineBlock(tokenId1, tokenId2, lineId){
	line = getObj("path", lineId)

	linePoints = JSON.parse(line.get("path"))

	for (var i = linePoints.length - 1; i > 0; i--) {
		var p1 = linePoints[i]
		var q1 = linePoints[i - 1]

		if((p1[0] == "M" | p1[0] == "L") & (q1[0] == "M" | q[0] == "L")){
			p1 = p1.splice(1)
			q1 = q1.splice(1)
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
	  
	    // # If none of the cases
	    return false
	}
}

function checkBarriers(tokenId, targetId){
	log("check barriers")

	pageid = getObj("graphic", tokenId).get("_pageid")

	var lines = findObjs({
		_type: "path",
		_pageid: pageid,
		layer: "objects"
	})

	_.each(lines, function(line){
		if(checkLineBlock(tokenId, targetId, line)){
			// barrier is blocking the attack!!
		}
	})
}

// on("ready", function(){
// 	on("add:path", function(obj){
// 		log("path has added")
// 	});

// 	// on("change:path:_path", function(obj){
// 	// 	log("path has changed")
// 	// });
// });

on("ready", function() {
	on("change:path:_path", function(obj){
		log("path has changed")
	})
})

"use strict";
function displayEvents(eventNames) {
    for (const eventName of eventNames) {
        on(eventName, function (object, previous) {
            const info = [
                ["Event Name", eventName],
                ["Object Type", object.get("_type")],
                ["Object Id", object.id]
            ];
            if (previous) {
                for (const key in previous) {
                    const oldValue = previous[key];
                    const newValue = object.get(key);
                    if (newValue != oldValue) {
                        info.push([`Old ${key}`, oldValue], [`New ${key}`, newValue]);
                    }
                }
            }
            info.forEach(row => log(row.join(": ")));
        });
    }
}
on("ready", function main() {
    displayEvents([
        "add:path",
        "change:path",
        "change:path:_path",
        "change:path:path"
    ]);
    createObj("path", {
        _pageid: findObjs({ _type: "page" })[0].id,
        _path: `"[["M",0,0],["L",700,700]]"`,
        layer: "objects",
        stroke: "#000000",
        top: 350,
        left: 350,
        width: 700,
        height: 700
    });
});