
function getCharFromToken(tokenId){
    var obj = getObj("graphic", tokenId);
    var currChar = getObj("character", obj.get("represents")) || "";
    if(currChar != "") {var charID = currChar.get("_id");}
    else {var charID = ""}
    return charID;
}

function cancelSpells(tokenId){
	log("cancel spells TODO")
	// var ongoing = state.HandoutSpellsNS.turnActions[tokenId]
	// ongoing.casting = {};
	// ongoing.channel = {};
	sendChat("System", "Spirit is depleted! No longer able to cast spells")
}

async function getBarValues(tokenId, type){
	// log("get bar values")
	if(type == "spirit"){
		// log(getObj("graphic", tokenId).get("bar1_link"))
		if(getObj("graphic", tokenId).get("bar1_link") != ""){
			//player 
			let spirit = await getAttrObj(getCharFromToken(tokenId), "spirit")
			return [spirit.get("current"), spirit.get("max")];
		}
		else {
			return [getObj("graphic", tokenId).get("bar1_value"), getObj("graphic", tokenId).get("bar1_max")];
		}
	}
	else if(type == "Binding") {
		if(getObj("graphic", tokenId).get("bar2_link") != ""){
			//player 
			let bind = await getAttrObj(getCharFromToken(tokenId), "Binding")
			return [bind.get("current"), bind.get("max")];
		}
		else {
			return [getObj("graphic", tokenId).get("bar2_value"), getObj("graphic", tokenId).get("bar2_max")];
		}
	}
	else {
		if(getObj("graphic", tokenId).get("bar1_link") != ""){
			//player 
			let health = await getAttrObj(getCharFromToken(tokenId), "health_" + part)
			return [health.get("current"), health.get("max")];
		}
		else {
			return [getObj("graphic", tokenId).get("bar1_value"), getObj("graphic", tokenId).get("bar1_max")];
		}
	}
}

async function setBarValues(tokenId, type, value, valueType){
	// log("set bar values")
	if(type == "spirit"){
		if(getObj("graphic", tokenId).get("bar1_link") != ""){
			//player 
			let spirit = await getAttrObj(getCharFromToken(tokenId), "spirit")
			spirit.set(valueType, value)
		}
		else {
			if(valueType == "current") getObj("graphic", tokenId).set("bar1_value", value)
			else getObj("graphic", tokenId).set("bar1_max", value);
		}
	}
	else if(type == "Binding") {
		if(getObj("graphic", tokenId).get("bar2_link") != ""){
			//player 
			let bind = await getAttrObj(getCharFromToken(tokenId), "Binding")
			bind.set(valueType, value)
		}
		else {
			if(valueType == "current") getObj("graphic", tokenId).set("bar2_value", value)
			else getObj("graphic", tokenId).set("bar2_max", value);
		}
	}
	else {
		if(getObj("graphic", tokenId).get("bar1_link") != ""){
			//player 
			let health = await getAttrObj(getCharFromToken(tokenId), "health_" + part)
			health.set(valueType, value)
		}
		else {
			if(valueType == "current") getObj("graphic", tokenId).set("bar1_value", value)
			else getObj("graphic", tokenId).set("bar1_max", value);
		}
	}
}

async function applyDamage(tokenId, damageAmount, damageType, bodyPart, dodge){
	log('applyDamage')

	const charId = getCharFromToken(tokenId)

	// check for leg and arm to pick one or the other
	legs = ["Right Leg", "Left Leg"]
	arms = ["Right Arm", "Left Arm"]
	if(bodyPart == "Leg"){
		bodyPart = legs[Math.floor(Math.random() * 2)];
	}
	if(bodyPart == "Arm"){
		bodyPart = arms[Math.floor(Math.random() * 2)];
	}

	dodgeMod = 1
	// if(dodge == 1) dodgeMod = 0.5;
	// log("dodge")
	// log(dodge)

	let spirit = await getBarValues(tokenId, "spirit")
	var damage = 0;
	if(damageType == "Bind"){
		log("bind damage")
		// bind damage dealt
		let binding = await getBarValues(tokenId, "Binding")
		damage = parseInt(damageAmount)
		setBarValues(tokenId, "Binding", parseInt(binding[0]) + parseInt(damageAmount), "current")
		// binding.set("current", parseInt(binding.get("current")) + parseInt(damageAmount))
		// sendChat("System", "**" + getObj("graphic", tokenId).get("name") + "** takes [[" + damageAmount + "]] " + damageType + " damage")
	}

	else if(damageType == "Drain"){
		log("drain damage")
		//replace with get resists later
		const resist = 0.0;

		Math.floor(damage = (1 - resist) * parseInt(damageAmount) * dodgeMod)
		// sendChat("System", "**" + getObj("graphic", tokenId).get("name") + "** takes [[" + damage + "]] " + damageType + " damage")
		// spirit.set("current", Math.max(0, parseInt(spirit.get("current")) - damage))
		await setBarValues(tokenId, "spirit", Math.max(0, parseInt(spirit[0]) - damage), "current")

		// change the spirit bar
		let spiritBar = await getAttrObj(charId, "spirit_orb")
		new_spirit = await getBarValues(tokenId, "spirit")
		spiritBar.set("current", parseFloat(new_spirit[0]) / parseFloat(new_spirit[1]) * 100)

		if(parseInt(new_spirit[0]) == 0){
			// cancel spellcasting when spirit hits 0
			if(!(_.isEmpty(state.HandoutSpellsNS.OnInit[tokenId].currentSpell))){
				state.HandoutSpellsNS.OnInit[tokenId].currentSpell.dismissSpell(tokenId)
			}
		}
	}

	else if(damageType == "Heal"){
		log("heal")
		//replace with get resists later
		const resist = 0.0;

		Math.floor(damage = (1 - resist) * parseInt(damageAmount) * dodgeMod)
		// sendChat("System", "**" + getObj("graphic", tokenId).get("name") + "** takes [[" + damage + "]] " + damageType + " damage")
		// spirit.set("current", Math.max(0, parseInt(spirit.get("current")) - damage))
		await setBarValues(tokenId, "spirit", Math.min(spirit[1], parseInt(spirit[0]) + damage), "current")

		// change the spirit bar
		let spiritBar = await getAttrObj(charId, "spirit_orb")
		spiritBar.set("current", parseFloat(spirit[0]) / parseFloat(spirit[1]) * 100)
	}

	else if(parseInt(spirit[0]) > 0 & damageType != "Pierce" & dodge != 2){
		log("normal damage")
		//replace with get resists later
		const resist = 0.0;
		var spiritArmor = 0.0
		if(charId != "") {spiritArmor = getAttrByName(charId, "SpiritArmor")}
		// else {
		// 	log("here")
		// 	const spiritArmor = 0}
		log(spiritArmor)

		damage = Math.floor((1 - resist) * parseInt(damageAmount) * dodgeMod - spiritArmor)

		// spirit.set("current", Math.max(0, parseInt(spirit.get("current")) - damage))
		await setBarValues(tokenId, "spirit", Math.max(0, parseInt(spirit[0]) - damage), "current")

		// change the spirit bar
		let spiritBar = await getAttrObj(charId, "spirit_orb")
		new_spirit = await getBarValues(tokenId, "spirit")
		spiritBar.set("current", parseFloat(new_spirit[0]) / parseFloat(new_spirit[1]) * 100)

		log(new_spirit)
		if(new_spirit[0] == 0){
			log("I'm here")
			// cancel spellcasting when spirit hits 0
			log(state.HandoutSpellsNS.OnInit[tokenId].currentSpell)
			if(!(_.isEmpty(state.HandoutSpellsNS.OnInit[tokenId].currentSpell))){
				state.HandoutSpellsNS.OnInit[tokenId].currentSpell.dismissSpell(tokenId)
			}
		}
	}
	else {
		log("pierce damage")
		// damage dealt to body part
		part = bodyPart.toLowerCase()
		part = part.replace(" ", "_")
		let health = await getBarValues(tokenId, part)
		if(charId != ""){
			physicalArmor = getAttrByName(charId, "PhysicalArmor")
		}
		else {physicalArmor = 0}
		log(physicalArmor)

		Math.floor(damage = parseInt(damageAmount) * dodgeMod - parseInt(physicalArmor))
		
		// health.set("current", Math.max(0, parseInt(health.get("current")) - damage))
		await setBarValues(tokenId, part, Math.max(0, parseInt(health[0]) - damage), "current")

		// change the health bar
		let healthBar = await getAttrObj(charId, "health_" + part + "_percent")
		let health_new = await getBarValues(tokenId, part)
		healthBar.set("current", parseFloat(health_new[0]) / parseFloat(health_new[1]) * 100)

		// roll for an injury
	}
	

	if(charId != ""){maxBinding(tokenId)}
	// return await new Promise(function(resolve,reject){
	// 	log("promise")
	if(parseInt(spirit[0]) > 0 & damageType != "Pierce" & dodge != 2){
		txt = "**" + getObj("graphic", tokenId).get("name") + "** takes [[" + damage + "]] " + damageType + " damage"
	}
	else {
		txt = "**" + getObj("graphic", tokenId).get("name") + "'s " + bodyPart + "** takes [[" + damage + "]] " + damageType + " damage"
	}
	sendChat('',"/w GM " + txt)
}

async function reduceSpeed(tokenId){
	// log("reduce speed")
	const charId = getCharFromToken(tokenId)

    let binding = await getBarValues(tokenId, "Binding")

    if(parseInt(binding[1]) > 0) speedReduce = parseFloat(binding[0]) / parseFloat(binding[1]);
    else if(parseInt(binding[0]) > 0) speedReduce = 1.0;
    else speedReduce = 0.0

	
	log(speedReduce)

    // update movement speed
    let movement = await getAttrObj(charId, "Move")
	movement.set("max", 20) // eventually need to remove this!!!
	log(movement)
	var move_reduce = parseFloat(movement.get("max")) * speedReduce
	log(move_reduce)
    
    movement.set("current", Math.ceil(movement.get("max") - move_reduce))
}

async function maxBinding(tokenId){
	// log("max binding")
	if(getObj("graphic", tokenId).get("name").includes("_facing")) {return}
	const charId = getCharFromToken(tokenId)
    // on damage or healing to spirit
    let currentSpirit = await getBarValues(tokenId, "spirit")

    setBarValues(tokenId, "Binding", currentSpirit[0], "max")
    // binding.set("max", parseInt(currentSpirit))

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
