function knockback(obj){
	log("knockback")
	moveObj = getObj('graphic', obj.target);
	pageid = moveObj.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));

    x1 = parseFloat(moveObj.get("left"))
    y1 = parseFloat(moveObj.get("top"))
    if(Array.isArray(obj.position)){
    	x2 = obj.position[0]
    	y2 = obj.position[1]
    }
    else {
    	x2 = parseFloat(getObj(obj.position).get("left"))
    	y2 = parseFloat(getObj(obj.position).get("top"))
    }

    dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    vecx = (x2 - x1) / dist
    vecy = (y2 - y1) / dist

    newLeft = x1 + vecx * obj.distance / 5 * gridSize
    newTop = y1 + vecy * obj.distance / 5 * gridSize

    moveObj.set({
    	"left": newLeft,
    	"top": newTop
    })

    // manually run function for on:change graphic
    collision = bshields.Collision.changeGraphic(moveObj, {"top": y1, "left": x1})
    if(collision){
    	log("splat")
    }
}

function movement(obj){
	log("movement")
	moveObj = getObj('graphic', obj.target);

	if(Array.isArray(obj.position)){
    	left = obj.position[0]
    	top = obj.position[1]
    }
    else {
    	left = parseFloat(getObj(obj.position).get("left"))
    	top = parseFloat(getObj(obj.position).get("top"))
    }

    x1 = parseFloat(moveObj.get("left"))
    y1 = parseFloat(moveObj.get("top")) 

    moveObj.set({
    	"left": left,
    	"top": top
    })   

    bshields.Collision.changeGraphic(moveObj, {"top": y1, "left": x1})
}


async function dealDamage(obj){
    log("deal damage")
    let critMagObj = await getAttrObj(getCharFromToken(obj.weilder), "13ZZ1Z_crit_weapon_mag")
    let critPierceObj = await getAttrObj(getCharFromToken(obj.weilder), "13ZZ6Z_crit_weapon_pierce")

    if(obj.crit){
        log("crit")
        baseMag = obj.magnitude
        critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        
        critMagObj.set("current", critMag)
        critPierceObj.set("current", state.HandoutSpellsNS.coreValues.CritPierce)
        log(critPierceObj)
    }

    rollCount = 0 + getMods(getCharFromToken(obj.weilder), replaceDigit(obj.code, 4, "1"))[0].reduce((a, b) => a + b, 0)
    rollDie = 0 + getMods(getCharFromToken(obj.weilder), replaceDigit(obj.code, 4, "2"))[0].reduce((a, b) => a + b, 0)
    rollAdd = 0 + getMods(getCharFromToken(obj.weilder), replaceDigit(obj.code, 4, "3"))[0].reduce((a, b) => a + b, 0)
    pierce = 0 + getMods(getCharFromToken(obj.weilder), replaceDigit(obj.code, 4, "6"))[0].reduce((a, b) => a + b, 0)
    normal = 1.0 - pierce
    let damage = await attackRoller("[[(" + obj.magnitude + "+" + rollCount + ")d(" + obj.baseDamage + "+" + rollDie + ")+" + rollAdd + "]]")
    log(damage)

    _.each(obj.targets, function(target){
        blocking = checkBarriers(obj.weilder, target)
        reductions = barrierReduce(obj.weilder, target, damage[1], blocking)
        damage[1] = reductions[0]
    })
    
    log(damage)

    replacements = {
        "WEAPON": obj.weaponName,
        "TARGETS": obj.targets.join(" | "),
        "NORMALD": "ceil((" + damage[0] + ")*" + normal + ")",
        "PIERCED": "floor((" + damage[0] + ")*" + pierce + ")",
        "TARGETCOUNT": obj.targets.length,
        "ROLLCOUNT": rollCount
    }


    setReplaceMods(getCharFromToken(obj.weilder), obj.code) // is this still needed?
    let spellString = await getSpellString("DamageEffect", replacements)
    log(spellString)
    name = getCharName(obj.weilder)
    sendChat(name, "!power " + spellString)

    // is there a better way to reset all these?
    critMagObj.set("current", 0)
    critPierceObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(obj.weilder), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)

    // deal auto damage
    var idx = 0;
    _.each(obj.targets, function(target){
        applyDamage(target, Math.ceil(damage[1] * normal), obj.damageType, obj.bodyPart[idx], obj.hitType[idx])
        applyDamage(target, Math.floor(damage[1] * pierce), "Pierce", obj.bodyPart[idx], obj.hitType[idx])
        idx = idx + 1
    })
    
    return damage
}


on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(/\s+/);
    
    if (msg.type == "api" && msg.content.indexOf("!KnockTest") === 0) {
    	tokenId = args[1]
    	top = parseFloat(getObj('graphic', tokenId).get("top"))
    	left = parseFloat(getObj('graphic', tokenId).get("left"))

    	knockback({
    		"target": tokenId,
    		"position": [left, top - 200],
    		"distance": 15
    	})
    }

    if (msg.type == "api" && msg.content.indexOf("!DamageTest") === 0) {
        tokenId = args[1]
        targetId = args[2]

        dealDamage({
            "weilder": tokenId, 
            "targets": [targetId],
            "weaponName": "Test Weapon",
            "crit": false,
            "magnitude": 3,
            "baseDamage": 6,
            "code": "138900",
            "damageType": "Impact",
            "bodyPart": ["head"],
            "hitType": [0]
        })
    }

});