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

function getConditionMods(tokenId, code){
    // look at conditions in turnActions[tokenId].conditions
    // calculate mods for each condition
    // summ all mods and return in object

    conditions = state.HandoutSpellsNS.turnActions[tokenId].conditions
    var rollAdd = 0;
    var rollDie = 0;
    var rollCount = 0;
    var critThres = state.HandoutSpellsNS.coreValues.CritThres;
    var pierce = 0;

    var digit = 2;
    if(code[0] === "1"){
        digit = 4;
    }

    _.each(conditions, function(condition){
        condition_code = replaceDigit(code, -1, condition.id) // change the condition digit from condition id number

        rollCount += getMods(charid, replaceDigit(condition_code, digit, "1"))[0].reduce((a, b) => a + b, 0)
        rollDie += getMods(charid, replaceDigit(condition_code, digit, "2"))[0].reduce((a, b) => a + b, 0)
        rollAdd += getMods(charid, replaceDigit(condition_code, digit, "3"))[0].reduce((a, b) => a + b, 0)
        critThres -= getMods(charid, replaceDigit(condition_code, digit, "5"))[0].reduce((a, b) => a + b, 0)
        pierce += getMods(charid, replaceDigit(condition_code, digit, "6"))[0].reduce((a, b) => a + b, 0)
    });

    return {
        "rollAdd": rollAdd,
        "rollCount": rollCount,
        "rollDie": rollDie,
        "critThres": critThres,
        "pierce": pierce
    }
}

function graphicMoveDistance(tokenId){
    points = getObj("graphic", obj.weilder).get("lastmove")
    points = points.split(",")
    end_point = [getObj("graphic", obj.weilder).get("left"), getObj("graphic", obj.weilder).get("top")]

    var dist = 0
    if(points.length > 2){
        for (var i = points.length - 1; i >= 0; i-=2) {
            x1 = parseFloat(points[i - 1])
            y1 = parseFloat(points[i])
            x2 = parseFloat(points[i - 3])
            y2 = parseFloat(points[i - 2])

            dist += Math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
        }
    }

    x1 = parseFloat(points[-2])
    y1 = parseFloat(points[-1])
    x2 = parseFloat(end_point[0])
    y2 = parseFloat(end_point[1])

    dist += Math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

    pageid = moveObj.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));

    return dist / gridSize;
}

async function setBonusDamage(obj){
    // based on a scale 
    // calculate the bonus value as either proportion to scale or 1.0x 
    // create code with condition code and bonus value

    switch(obj.scale){
        case "move":
            // distance moved by weilder. Could be last turn or this turn
            scale = Array(obj.targets.length).fill(graphicMoveDistance(obj.weilder))
            attr_name = obj.bonusCode + "_weapon_move_bonus"
            break;
        case "distance":
            // check for all targets, keep shortest range
            // can I do this per target?
            scale = []
            _.each(obj.targets, function(target){
                scale.push(getRadiusRange(obj.weilder, target))
            })

            attr_name = obj.bonusCode + "_weapon_dist_bonus"
            
            break;
        case "targets":
            // number of targets attacked
            scale = Array(obj.targets.length).fill(obj.targets.length)
            attr_name = obj.bonusCode + "_weapon_targets_bonus"
            break;
        case "reaction":
            // if reacting this turn
            scale = Array(obj.targets.length).fill(0.0)
            if(state.HandoutSpellsNS.OnInit[obj.weilder]["type"] == "Reaction"){
                scale = 1.0
            }
            attr_name = obj.bonusCode + "_weapon_reaction_bonus"
            break;
        case "parry":
            // check if selected reaction is parry. Need to decide if still using counter as selction
            break;
        case "vision":
            // check if within vision cone of target
            // how to handle multi-target?
            scale = []
            _.each(obj.targets, function(target){
                if(inView(target, obj.weilder)){
                    scale.push(1.0)
                }
                else {
                    scale.push(0.0)
                }
            })
            break;
    }

    // value = parseFloat(obj.scaleMod) * scale
    value = scale.map(function(e){e * parseFloat(obj.scaleMod)})
    let bonusObj = await getAttrObj(getCharFromToken(obj.weilder), attr_name)
    // bonusObj.set("current", value)
    obj["targetDamages"] = value

    return attr_name
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

        // rolling damage individually? Make an option
        // how to roll crits?

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