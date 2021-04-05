function faceTarget(tokenId, targetId){
	token = getObj("graphic", tokenId)
	target = getObj("graphic", targetId)

	var x = parseFloat(target.get("left")) - parseFloat(token.get("left"))
	var y = parseFloat(target.get("top")) - parseFloat(token.get("top"))

	var angle = Math.atan2(y, x) * 180 / Math.PI
	angle = (angle + 450) % 360

	var facing = findObjs({
        _type: "graphic",
        _pageid: token.get("pageid"),
        name: token.get("id") + "_facing",
    })[0];

    if(facing){
    	facing.set("rotation", angle)
    	flipToken(facing.get("id"))
    }

}

function flipToken(facingId){
	log("flip token")
	obj = getObj("graphic", facingId)
	token = getObj("graphic", obj.get("name").substring(0, obj.get("name").indexOf("_")))

	if((obj.get("rotation") % 360) < 180){
		//face right
		token.set("fliph", true)
	}
	else{
		//face left
		token.set("fliph", false)
	}
}

function tokenSpiritView(tokenId){
	var facing = findObjs({
		_type: "graphic",
		name: tokenId + "_facing"
  	})[0];

  	if(!facing) {return;}

	current = facing.get("layer")
	pageid = facing.get("_pageid")
	page = getObj("page", pageid)

	if(current === "gmlayer"){
		facing.set("layer", "objects")
		if(page.get("daylight_mode_enabled")){
			page.set("daylight_mode_enabled", false)
		}
	}
	else{
		facing.set("layer", "gmlayer")
		if(page.get("explorer_mode") == "off"){
			//asuming that daylight explorer mode is off when using daylight mode
			page.set("daylight_mode_enabled", true)
		}
	}
  	
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    
    var args = msg.content.split(/\s+/);

    if (msg.type == "api" && msg.content.indexOf("!FaceTarget") !== -1) {
    	log("face target")
    	tokenId = args[1]
    	targetId = args[2]
    	faceTarget(tokenId, targetId)
    }

    if (msg.type == "api" && msg.content.indexOf("!SpiritView") !== -1) {
    	log("spirit view")
    	tokenId = args[1]
    	tokenSpiritView(tokenId)
    }
});


on("change:graphic", _.debounce((obj,prev)=>{
	log("view change")
    if(obj.get('left')==prev['left'] && obj.get('top')==prev['top'] && obj.get('rotation')==prev['rotation']) return;

    if(obj.get("name").includes("_facing")){
    	//position must match original token
    	token = getObj("graphic", obj.get("name").substring(0, obj.get("name").indexOf("_")));
    	obj.set("left", token.get("left"))
    	obj.set("top", token.get("top"))

    	//change direction of token to match facing
    	//assume left facing to start

    	// log(obj.get("rotation"))
    	flipToken(obj.get("id"))
    }
    else {
    	var facing = findObjs({
            _type: "graphic",
            _pageid: obj.get("pageid"),
            name: obj.get("id") + "_facing",
        })[0];

        if(facing){
        	facing.set("top", obj.get("top"))
        	facing.set("left", obj.get("left"))
        }
    }

}));

on("destroy:graphic", function(obj){
    log('remove facing')

    var facing = findObjs({
        _type: "graphic",
        _pageid: obj.get("pageid"),
        name: obj.get("id") + "_facing",
    })[0];

    if(facing){
    	facing.remove()
    }
});