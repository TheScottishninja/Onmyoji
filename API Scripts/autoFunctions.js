
function getCharFromToken(tokenId){
    var obj = getObj("graphic", tokenId);
    var currChar = getObj("character", obj.get("represents")) || "";
    var charID = currChar.get("_id");
    return charID;
}

async function getAttrObj(charId, name){
    var obj = {};
    obj = findObjs({
        _type: "attribute",
        _characterid: charId,
        name: name
    })[0];
    if(!obj){
        // log(getAttrByName(charId, name))
        max_value = getAttrByName(charId, name, "max")
        current_value = getAttrByName(charId, name)
        if (max_value === undefined) { 
            log(max_value)
            max_value = ""
        }
        if (current_value === undefined){
            log(current_value)
            current_value = ""
        }
        createObj("attribute", {
            characterid: charId,
            name: name,
            current: current_value,
            max: max_value
        })
        while(true){
            obj = findObjs({
                _type: "attribute",
                _characterid: charId,
                name: name
            })[0];
            log(obj)
            if(obj) break;
        }
        
    }
    return obj
}

function cancelSpells(tokenId){
	log("cancel spells")
	var ongoing = state.HandoutSpellsNS.turnActions[tokenId]
	ongoing.casting = {};
	ongoing.channel = {};
	sendChat("System", "Spirit is depleted! No longer able to cast spells")
}

async function getBarValues(tokenId, type){
	if(type == "spirit"){
		if(getObj(tokenId).get("bar1_link") != ""){
			//player 
			let spirit = await getAttrObj(getCharFromToken(tokenId), "spirit")
			return [spirit.get("current"), spirit.get("max")];
		}
		else {
			return [getObj(tokenId).get("bar1_value"), getObj(tokenId).get("bar1_max")];
		}
	}
	else if(type == "Binding") {
		if(getObj(tokenId).get("bar2_link") != ""){
			//player 
			let bind = await getAttrObj(getCharFromToken(tokenId), "Binding")
			return [bind.get("current"), bind.get("max")];
		}
		else {
			return [getObj(tokenId).get("bar2_value"), getObj(tokenId).get("bar2_max")];
		}
	}
	else {
		if(getObj(tokenId).get("bar1_link") != ""){
			//player 
			let health = await getAttrObj(getCharFromToken(tokenId), "health_" + part)
			return [health.get("current"), health.get("max")];
		}
		else {
			return [getObj(tokenId).get("bar1_value"), getObj(tokenId).get("bar1_max")];
		}
	}
}

async function setBarValues(tokenId, type, value, valueType){
	if(type == "spirit"){
		if(getObj(tokenId).get("bar1_link") != ""){
			//player 
			let spirit = await getAttrObj(getCharFromToken(tokenId), "spirit")
			spirit.set(valueType, value)
		}
		else {
			if(valueType == "current") getObj(tokenId).set("bar1_value", value)
			else getObj(tokenId).set("bar1_max", value);
		}
	}
	else if(type == "Binding") {
		if(getObj(tokenId).get("bar2_link") != ""){
			//player 
			let bind = await getAttrObj(getCharFromToken(tokenId), "Binding")
			bind.set(valueType, value)
		}
		else {
			if(valueType == "current") getObj(tokenId).set("bar2_value", value)
			else getObj(tokenId).set("bar2_max", value);
		}
	}
	else {
		if(getObj(tokenId).get("bar1_link") != ""){
			//player 
			let health = await getAttrObj(getCharFromToken(tokenId), "health_" + part)
			health.set(valueType, value)
		}
		else {
			if(valueType == "current") getObj(tokenId).set("bar1_value", value)
			else getObj(tokenId).set("bar1_max", value);
		}
	}
}

async function applyDamage(tokenId, damageAmount, damageType, bodyPart, dodge){
	log('applyDamage')
	const charId = getCharFromToken(tokenId)
	bodyPart = bodyPart.split(",")

	if(bodyPart.length > 1) {
		bodyPart = bodyPart[Math.floor(Math.random() * bodyPart.length)];
	}
	else {
		bodyPart = bodyPart[0]
	}

	dodgeMod = 1
	if(dodge == 1) dodgeMod = 0.5;

	if(damageType != "Bind"){
		let spirit = await getAttrObj(charId, "spirit")
		if(parseInt(spirit.get("current")) > 0 & damageType != "Pierce" & dodge != 2){
			//replace with get resists later
			const resist = 0.0;
			const spiritArmor = getAttrByName(charId, "SpiritArmor")

			var damage = (1 - resist) * parseInt(damageAmount) * dodgeMod - parseInt(spiritArmor)
			sendChat("System", "**" + getObj("graphic", tokenId).get("name") + "** takes [[" + damage + "]] " + damageType + " damage")
			spirit.set("current", Math.max(0, parseInt(spirit.get("current")) - damage))

			// change the spirit bar
			let spiritBar = await getAttrObj(charId, "spirit_orb")
			spiritBar.set("current", parseFloat(spirit.get("current")) / parseFloat(spirit.get("max")) * 100)

			if(parseInt(spirit.get("current")) == 0){
				// cancel spellcasting when spirit hits 0
				cancelSpells(tokenId)
			}
		}
		else{
			// damage dealt to body part
			part = bodyPart.toLowerCase()
			part = part.replace(" ", "_")
			let health = await getAttrObj(charId, "health_" + part)
			const physicalArmor = getAttrByName(charId, "PhysicalArmor")

			var damage = parseInt(damageAmount) * dodgeMod - parseInt(physicalArmor)
			sendChat("System", "**" + getObj("graphic", tokenId).get("name") + "'s " + bodyPart + "** takes [[" + damage + "]] " + damageType + " damage")
			health.set("current", Math.max(0, parseInt(health.get("current")) - damage))

			// change the health bar
			let healthBar = await getAttrObj(charId, "health_" + part + "_percent")
			healthBar.set("current", parseFloat(health.get("current")) / parseFloat(health.get("max")) * 100)

			// roll for an injury
		}
	}
	else {
		// bind damage dealt
		let binding = await getAttrObj(charId, "Binding")
		binding.set("current", parseInt(binding.get("current")) + parseInt(damageAmount))
	}

	maxBinding(tokenId)
}

async function reduceSpeed(tokenId){
	log("reduce speed")
	const charId = getCharFromToken(tokenId)

    let binding = await getAttrObj(charId, "Binding")

    if(parseInt(binding.get("max")) > 0) speedReduce = parseFloat(binding.get("current")) / parseFloat(binding.get("max"));
    else if(parseInt(binding.get("current")) > 0) speedReduce = 1.0;
    else speedReduce = 0.0

	
	log(speedReduce)

    // update movement speed
    let movement = await getAttrObj(charId, "Move_reduce")
    
    movement.set("current", speedReduce)
}

async function maxBinding(tokenId){
	log("max binding")
	const charId = getCharFromToken(tokenId)
    // on damage or healing to spirit
    currentSpirit = getAttrByName(charId, "spirit")

    let binding = await getAttrObj(charId, "Binding")
    binding.set("max", parseInt(currentSpirit))

    reduceSpeed(tokenId)
}

on("change:graphic:bar1_value", async function(obj){
	maxBinding(obj.get("id"))
});

on("change:graphic:bar2_value", async function(obj) {
	reduceSpeed(obj.get("id"))
});

on("change:graphic:bar2_max", async function(obj){
	reduceSpeed(obj.get("id"))
});

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    // var args = msg.content.split(/\s+/);
    var args = msg.content.split(";;");
    
    if (msg.type == "api" && msg.content.indexOf("!ApplyDamage") !== -1 && msg.who.indexOf("(GM)")){
    	log(args)
   		var tokenId = args[1];
   		var damageAmount = args[2];
   		var damageType = args[3];
   		var bodyPart = args[4];
   		var dodge = args[5];
   		applyDamage(tokenId, damageAmount, damageType, bodyPart, dodge)
    }
});
