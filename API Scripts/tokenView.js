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

function stealthSpiritView(tokenId){
	token = getObj("graphic", tokenId)

	// make token emit wide dim light
	token.set({
		emits_low_light: true,
		low_light_distance: 100});

	var allTokens = findObjs({
		_type: "graphic",
		pageid: token.get("pageid")
	});

	_.each(allTokens, function(obj){
		if(obj.get("name").includes("_facing") & !obj.get("name").includes(tokenId)){
			// move facings to objects and make light emitting
			log(obj.get("limit_field_of_night_vision_total"))
			obj.set({
				layer: "objects",
				emits_bright_light: true,
				bright_light_distance: obj.get("night_vision_distance"),
				has_directional_bright_light: true,
				directional_bright_light_total: obj.get("limit_field_of_night_vision_total")
			})
		}
	});

	page = getObj("page", token.get("_pageid"))
	page.set("daylight_mode_enabled", false)
}

function cancelStealthView(tokenId){
	token = getObj("graphic", tokenId)

	// make token emit wide dim light
	token.set({
		emits_low_light: false,
		low_light_distance: 0});

	var allTokens = findObjs({
		_type: "graphic",
		pageid: token.get("pageid")
	});

	_.each(allTokens, function(obj){
		if(obj.get("name").includes("_facing")){
			// move facings to objects and make light emitting
			obj.set({
				layer: "gmlayer",
				emits_bright_light: false,
				has_direction_bright_light: false,
			})
		}
	});

	page = getObj("page", token.get("_pageid"))

	if(page.get("explorer_mode") == "off"){
		//asuming that daylight explorer mode is off when using daylight mode
		page.set("daylight_mode_enabled", true)
	}
}

async function effectStealth(tokenId){
	log("effectStealth")
	var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
	var channeled = false

	if(_.isEmpty(casting)){
		casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
		channeled = true
		log("channeled")
	}
	let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "BaseDamage"]);

	var token = getObj("graphic", tokenId)
	let critMagObj = await getAttrObj(getCharFromToken(tokenId), "371_crit_stealth_mag")


	var baseRoll = "1d20"
    if(state.HandoutSpellsNS.crit[tokenId] >= 1){
        baseMag = parseInt(spellStats["Magnitude"])
        critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        
        critMagObj.set("current", critMag)
        state.HandoutSpellsNS.crit[tokenId] -= 1
        baseRoll = "20" 
    }

	// roll for stealth
	rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 2, "1"))[0].reduce((a, b) => a + b, 0)
    rollDie = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 2, "2"))[0].reduce((a, b) => a + b, 0)
    rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 2, "3"))[0].reduce((a, b) => a + b, 0)
    log("[[" + baseRoll + "+(" + spellStats["Magnitude"] + "+" + rollCount + ")d(" + spellStats["BaseDamage"] + "+" + rollDie + ")+" + rollAdd + "]]")
    let stealthRoll = await attackRoller("[[" + baseRoll + "+(" + spellStats["Magnitude"] + "+" + rollCount + ")d(" + spellStats["BaseDamage"] + "+" + rollDie + ")+" + rollAdd + "]]")
    log(stealthRoll)

    if(!channeled){
    	var facing = findObjs({
			_type: "graphic",
			name: token.get("id") + "_facing"
		})[0];

		state.HandoutSpellsNS.stealth[tokenId] = {
			imgsrc: token.get("imgsrc"),
		}

		log(state.HandoutSpellsNS.stealth[tokenId])

		if(facing){
			state.HandoutSpellsNS.stealth[tokenId]["range"] = facing.get("night_vision_distance")
			state.HandoutSpellsNS.stealth[tokenId]["angle"] = facing.get("limit_field_of_night_vision_total")

			facing.set({
				night_vision_distance: 0,
				limit_field_of_night_vision_total: 0
			})
		}

		// change token image to transparent and set aura for editor only
		token.set({
			imgsrc: "https://s3.amazonaws.com/files.d20.io/images/199532447/Q_os8m3DmtbXdi09P0lw6A/thumb.png?1612817286",
			aura2_radius: "0",
			show_players_aura2: false,
			players_edit_aura2: true
		})

		state.HandoutSpellsNS.turnActions[tokenId].channel = casting;
		state.HandoutSpellsNS.turnActions[tokenId].casting = {};
		cancelStealthView(tokenId)
	}

	state.HandoutSpellsNS.stealth[tokenId]["roll"] = stealthRoll[1]
	state.HandoutSpellsNS.stealth[tokenId]["magnitude"] = parseInt(spellStats["Magnitude"]) + rollCount

	// output power card

	replacements = {
		"PLACEHOLDER": casting.spellName,
		"ROLL": stealthRoll[0]
	}

	setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
    let spellString = await getSpellString("StealthEffect", replacements)
    sendChat(name, "!power " + spellString)

    critMagObj.set("current", 0)

}

function removeStealth(tokenId){
	log("remove stealth")
	token = getObj("graphic", tokenId)
	tokenValues = state.HandoutSpellsNS.stealth[tokenId]

	token.set({
		imgsrc: tokenValues.imgsrc.replace("max", "thumb"),
		aura2_radius: "",
		players_edit_aura2: false
	})

	var facing = findObjs({
		_type: "graphic",
		name: token.get("id") + "_facing"
	})[0];

	if(facing){
		facing.set({
			night_vision_distance: tokenValues.range,
			limit_field_of_night_vision_total: tokenValues.angle
		})
	}

	delete state.HandoutSpellsNS.stealth[tokenId]
	state.HandoutSpellsNS.turnActions[tokenId].channel = {}
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

    if (msg.type == "api" && msg.content.indexOf("!RemoveStealth") !== -1) {
    	log("stealth")
    	tokenId = args[1]
    	removeStealth(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!StealthView") !== -1) {
    	log("stealth")
    	tokenId = args[1]
    	stealthSpiritView(tokenId)

    	WSendChat("System", tokenId, "[Cast Spell](!Stealth;;" + tokenId + ") [Cancel](!CancelStealthView " + tokenId + ")")
    }

    if (msg.type == "api" && msg.content.indexOf("!CancelStealthView") === 0) {
    	log("no stealth")
    	tokenId = args[1]
    	cancelStealthView(tokenId)
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