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


async function dealDamage(obj, attackName){
    log("deal damage")
    attack = obj.attacks[attackName]
    effect = attack.effects.damage
    
    // input is the attack attackect
    let critMagObj = await getAttrObj(getCharFromToken(attack.weilder), "13ZZ1Z_crit_weapon_mag")
    let critPierceObj = await getAttrObj(getCharFromToken(attack.weilder), "13ZZ6Z_crit_weapon_pierce")

    mods = getConditionMods(attack.weilder, effect.code)
    var critString = ""
    if(randomInteger(20) >= mods.critThres){
        log("crit")
        baseMag = obj.rarity
        critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        
        critMagObj.set("current", critMag)
        critPierceObj.set("current", state.HandoutSpellsNS.coreValues.CritPierce)
        critString = "✅"
    }

    let damage = await attackRoller("[[(" + obj.rarity + "+" + mods.rollCount + ")d(" + effect.baseDamage + "+" + mods.rollDie + ")+" + mods.rollAdd + "]]")
    log(damage)

    var targetDamage = Array(attack.targets.length)
    var bonusDamage = Array(attack.targets.length).fill(0)
    if("bonusDamage" in attack.effects){
        bonusDamage = attack.effects.bonusDamage.targetDamages
    }

    damageString = "[TTB 'width=100%'][TRB][TDB width=60%]** Target **[TDE][TDB 'width=20%' 'align=center']** ND **[TDE][TDB 'width=20%' 'align=center']** PD **[TDE][TRE]"
    normal = 1.0 - mods.pierce

    for (var i = attack.targets.length - 1; i >= 0; i--) {
        blocking = checkBarriers(attack.weilder, attack.targets[i])
        reductions = barrierReduce(attack.weilder, attack.targets[i], damage[1] + bonusDamage[i], blocking)
        targetDamage[i] = reductions[0]

        damageString += "[TRB][TDB width=60%]" + getCharName(attack.targets[i]) + "[TDE][TDB 'width=20%' 'align=center'][[ceil((" + damage[0] + "+" + bonusDamage[i].toString() + ")*" + normal + 
                        ")]][TDE][TDB 'width=20%' 'align=center'][[floor((" + damage[0] + "+" + bonusDamage[i].toString() + ")*" + mods.pierce + ")]][TDE][TRE]"
    }

    damageString += "[TTE]"
    
    log(targetDamage)

    replacements = {
        "WEAPON": attackName,
        "TYPE": obj.weaponType,
        "ELEMENT": effect.damageType,
        "MAGNITUDE": obj.rarity,
        "DAMAGETABLE": damageString,
        "ROLLCOUNT": mods.rollCount,
        "CRIT": critString
    }

    let spellString = await getSpellString("DamageEffect", replacements)
    // log(spellString)
    name = getCharName(attack.weilder)
    log(name)
    sendChat(name, "!power" + spellString)

    // is there a better way to reset all these?
    critMagObj.set("current", 0)
    critPierceObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(attack.weilder), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)

    // deal auto damage
    for (var i = attack.targets.length - 1; i >= 0; i--){
        applyDamage(attack.targets[i], Math.ceil(targetDamage[i] * normal), effect.damageType, attack.bodyPart[i], attack.hitType[i])
        applyDamage(attack.targets[i], Math.floor(targetDamage[i] * mods.pierce), "Pierce", attack.bodyPart[i], attack.hitType[i])
    }
    
    return damage
}

function getConditionMods(tokenId, code){
    log("get conditions")
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

    for(condition in conditions){
        condition_code = replaceDigit(code, -1, condition.id) // change the condition digit from condition id number

        rollCount += getMods(charid, replaceDigit(condition_code, digit, "1"))[0].reduce((a, b) => a + b, 0)
        rollDie += getMods(charid, replaceDigit(condition_code, digit, "2"))[0].reduce((a, b) => a + b, 0)
        rollAdd += getMods(charid, replaceDigit(condition_code, digit, "3"))[0].reduce((a, b) => a + b, 0)
        critThres -= getMods(charid, replaceDigit(condition_code, digit, "5"))[0].reduce((a, b) => a + b, 0)
        pierce += getMods(charid, replaceDigit(condition_code, digit, "6"))[0].reduce((a, b) => a + b, 0)
    }

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

async function setBonusDamage(obj, attackName){
    log("bonus damage")
    attack = obj.attacks[attackName].effects.bonusDamage
    // based on a scale 
    // calculate the bonus value as either proportion to scale or 1.0x 
    // create code with condition code and bonus value

    switch(attack.scale){
        case "move":
            // distance moved by weilder. Could be last turn or this turn
            scale = Array(obj.attacks[attackName].targets.length).fill(graphicMoveDistance(obj.attacks[attackName].weilder))
            attr_name = attack.bonusCode + "_weapon_move_bonus"
            break;
        case "distance":
            // check for all targets, keep shortest range
            // can I do this per target?
            scale = []
            _.each(obj.attacks[attackName].targets, function(target){
                scale.push(getRadiusRange(obj.attacks[attackName].weilder, target))
            })

            attr_name = attack.bonusCode + "_weapon_dist_bonus"
            
            break;
        case "targets":
            // number of targets attacked
            scale = Array(obj.attacks[attackName].targets.length).fill(obj.attacks[attackName].targets.length)
            attr_name = attack.bonusCode + "_weapon_targets_bonus"
            break;
        case "reaction":
            // if reacting this turn
            scale = Array(obj.attacks[attackName].targets.length).fill(0.0)
            if(state.HandoutSpellsNS.OnInit[obj.attacks[attackName].weilder]["type"] == "Reaction"){
                scale = 1.0
            }
            attr_name = attack.bonusCode + "_weapon_reaction_bonus"
            break;
        case "parry":
            // check if selected reaction is parry. Need to decide if still using counter as selction
            break;
        case "vision":
            // check if within vision cone of target
            // how to handle multi-target?
            scale = []
            _.each(obj.attacks[attackName].targets, function(target){
                if(inView(target, obj.attacks[attackName].weilder)){
                    scale.push(1.0)
                }
                else {
                    scale.push(0.0)
                }
            })
            break;
    }

    // value = parseFloat(obj.scaleMod) * scale
    value = scale.map(function(e){return e * attack.scaleMod;})
    log(value)
    // let bonusObj = await getAttrObj(getCharFromToken(obj.attacks[attackName].weilder), attr_name)
    // bonusObj.set("current", value)
    attack["targetDamages"] = value

    return attr_name
}

async function weaponAttack(tokenId, weaponName, attackName, contId){
    log("weapon attack")

    if(_.isEmpty(state.HandoutSpellsNS.turnActions[tokenId].weapon)){
        var weaponObj = {}
        let handout = findObjs({_type: "handout", name: weaponName})[0]
        if(handout){
            handout.get("notes", function(currentNotes){
                log(currentNotes)
                weaponObj = JSON.parse(currentNotes);
            });
        }
        else {
            log("Weapon handout not found!")
            return;
        }
        log(weaponObj)
        state.HandoutSpellsNS.turnActions[tokenId].weapon = weaponObj            
    }
    else {
        weaponObj = state.HandoutSpellsNS.turnActions[tokenId].weapon
        log(weaponObj)
    }

    attackObj = weaponObj.attacks[attackName]
    attackObj.weilder = tokenId

    switch(contId){
        case "":
            // start of attack. select targets
            log("select targets")
            name = getCharName(tokenId)
            sendChat("System", '!power --whisper|"' + name + '" --!target|~C[Select Target](!TargetTest ' + tokenId + " " + attackName + " &#64;{target|token_id})~C")
            break;

        case "gotTargets":
            log("got targets")
            // targets obtained. parse attack effects
            // also set bodypart and hit type
            // change directly in targetting function by adding to obj
            effects = attackObj.effects

            if("bonusDamage" in effects){
                // calculate bonus damage for each target
                setBonusDamage(weaponObj, attackName)                
            }

            for(effect in effects){
                if(effect == "attack"){
                    effectFunctions[effect](tokenId, weaponName, effects.attack, "")
                    // attacks can be daisy chained by putting the next attackName in the attack effect
                    // prevent all following attacks from trigering at once
                    // must be last effect
                }
                else if(effect == "bonusDamage"){
                    continue;
                }
                else {
                    await effectFunctions[effect](weaponObj, attackName)
                }
            }

            state.HandoutSpellsNS.turnActions[tokenId].weapon = {}
            break;
    }
}   

effectFunctions = {
    "damage": function(obj, attackName) {return dealDamage(obj, attackName);},
    "knockback": function(obj) {return knockback(obj);},
    "attack": function(tokenId, weaponName, attackName, contId) {return weaponAttack(tokenId, weaponName, attackName, contId);}
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

    	effectFunctions["knockback"]({
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

        dealDamage({"weaponName": "Test Weapon", 
            "rarity": 1, 
            "weaponType": "Sword", 
            "attacks": {
                "attack_name1": {
                    "weilder": tokenId, 
                    "targetType": "Single", 
                    "desc": "Attack description", 
                    "targets": [targetId], 
                    "bodyPart": ["torso"], 
                    "hitType": [0], 
                    "effects": {
                        "damage": {
                            "damageType": "Impact", 
                            "code": "138900", 
                            "baseDamage": 6
                        }, 
                        // "bonusDamage": {
                        //     "scale": "move", 
                        //     "bonusCode": "12345", 
                        //     "scaleMod": 1, 
                        //     "targetDamages": []
                        // }, 
                        "knockback": {
                            "targets": [], 
                            "positions": [], 
                            "distance": 15
                        }, 
                        "attack": "second attack name"
                    }
                }
            }
        }, "attack_name1")
    }

    if (msg.type == "api" && msg.content.indexOf("!AttackTest") === 0) {
        log("attack test")
        tokenId = args[1]
        // weaponName = args[2]
        // attackName = args[3]
        // contId = args[4]

        weaponAttack(tokenId, "Test Weapon", "Swipe", "")
    }    

    if (msg.type == "api" && msg.content.indexOf("!TargetTest") === 0) {
        log("target test")

        tokenId = args[1]
        attackName = args[2]
        targetId = args[3]

        state.HandoutSpellsNS.turnActions[tokenId].weapon.attacks[attackName].targets = [targetId]
        state.HandoutSpellsNS.turnActions[tokenId].weapon.attacks[attackName].bodyPart = ["torso"]
        state.HandoutSpellsNS.turnActions[tokenId].weapon.attacks[attackName].hitType = [0]
        weaponAttack(tokenId, state.HandoutSpellsNS.turnActions[tokenId].weapon.weaponName, attackName, "gotTargets")
    }
});