
function snapGrid(vecx, vecy, x, y, pageid){

    const page = getObj("page", pageid)
    const gridSize = 70 * parseFloat(page.get("snapping_increment"));
    remainder = P(vecx % gridSize, vecy % gridSize)

    // if remainder < 1/2 gridsize, subtract remainder
    // else add difference of gridsize and remainder

    square = P(0, 0)
    if(Math.abs(remainder.x) < gridSize/2){square.x = vecx - remainder.x}
    else {square.x = vecx + (gridSize - remainder.x)}
    if(Math.abs(remainder.y) < gridSize/2){square.y = vecy - remainder.y}
    else {square.y = vecy + (gridSize - remainder.y)}

    return {
        "left": x - square.x,
        "top": y - square.y
    }
}

function knockback(obj){
    log("knockback")
    var sourceToken = getObj("graphic", obj.tokenId)
    if("shape" in obj.currentAttack.targetType){
        sourceToken = getObj("graphic", obj.currentAttack.targetType.shape.targetToken)
    }
    pageid = sourceToken.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    
    x2 = parseFloat(sourceToken.get("left"))
    y2 = parseFloat(sourceToken.get("top"))

    moveDist = obj.currentAttack.effects[obj.currentEffect].distance
    splatTargets = []
    
    for(var i in obj.currentAttack.targets){
        effectTarget = obj.currentAttack.targetType.effectTargets[obj.currentEffect]
        if(!(effectTarget.includes(obj.currentAttack.targets[i].type))){continue}
        var target = obj.currentAttack.targets[i].token
        if(target == sourceToken.get("id")){
            // can't knockback epicenter
            continue;
        }
        var moveObj = getObj('graphic', target);
        x1 = parseFloat(moveObj.get("left"))
        y1 = parseFloat(moveObj.get("top"))
        
        dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        vecx = (x2 - x1) / dist
        vecy = (y2 - y1) / dist
    
        newLeft = vecx * moveDist / 5 * gridSize
        newTop = vecy * moveDist / 5 * gridSize
    
        snapPos = snapGrid(newLeft, newTop, x1, y1, moveObj.get("pageid"))

        moveObj.set(snapPos)
    
        // manually run function for on:change graphic
        collision = changeGraphic(moveObj, {"top": y1, "left": x1})
        if(collision){
            splatTargets.push(target)
        }
    }

    // print a knockback message with splat damage 
    var damageString = ""
    if(splatTargets.length > 0){
        damageString = "[TTB 'width=100%'][TRB][TDB width=60%]** Splat Target **[TDE][TDB 'width=40%' 'align=center']** Splat Damage **[TDE][TRE]"
        _.each(splatTargets, function(target){
            damageString += "[TRB][TDB width=60%]" + getCharName(target) + "[TDE][TDB 'width=40%' 'align=center'][[" + moveDist + "]][TDE][TRE]"
        }) 
        damageString += "[TTE]"
    }
    log(damageString)

    replacements = {
        "KNOCKBACK": "[[" + moveDist.toString() + "]] ft",
        "SPLAT": damageString
    }

    for (var attr in replacements){obj.outputs[attr] = replacements[attr]}

    // deal auto damage
    _.each(splatTargets, function(target){
        applyDamage(target, moveDist, "Impact", "Torso", 0)
    })
}

function angleToAdjacent(token, angle){
    // from facing angle, determine the adjacent tile coords 
    quadrants = {
        0: [0, 1],
        1: [-1, 1],
        2: [-1, 1],
        3: [-1, 0],
        4: [-1, 0],
        5: [-1, -1],
        6: [-1, -1],
        7: [0, -1],
        8: [0, -1],
        9: [1, -1],
        10: [1, -1],
        11: [1, 0],
        12: [1, 0],
        13: [1, 1],
        14: [1, 1],
        15: [0, 1]
    }

    const pageid = getObj("graphic", token).get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));

    // var facing = findObjs({
    //     _type: "graphic",
    //     _pageid: pageid,
    //     name: token + "_facing",
    // })[0];

    // if(facing){
    // var angle = ParseFloat(facing.get("rotation"))
    // angle = angle % 360.0

    // get bin value
    var bin = Math.round(angle / 22.5)
    // negative numbers are in opposite direction, so add 16
    if(bin < 0){bin += 16}

    return {
        x: quadrants[bin][0] * gridSize,
        y: quadrants[bin][1] * gridSize
    }
    // }
    // else{
    //     log("facing token not found!")
    // }
}

function movement(obj){
    log("movement")
    // target locations for movement: on target, up to target, behind target (based on facing)
    // move: {"moveTargets": ("self", "target#"), "moveType":("upTo, behind, tile, distance")}
    // upTo and behind use attack targets, tile use targetTile property
    
    // search for token with target type
    attack = obj.currentAttack
    
    var targetId = ""
    for (i in attack.targets){
        if(attack.targets[i].type == obj.currentAttack.effects[obj.currentEffect].target){
            targetId = attack.targets[i].token
            break
        }
    }
    if(targetId == "" && "token" in obj.currentAttack.effects[obj.currentEffect]){
        targetId = obj.currentAttack.effects[obj.currentEffect].token
    }
    else if(targetId == ""){
        return
    }
    
    log(attack.targets)
    
    for (i in attack.targets) {
        effectTarget = attack.targetType.effectTargets[obj.currentEffect]
        if(!(effectTarget.includes(attack.targets[i].type))){continue}
        moveTarget = attack.targets[i].token
        
        var movePos = {}
        var token = getObj("graphic", moveTarget)
        x1 = parseFloat(token.get("left"))
        y1 = parseFloat(token.get("top"))
        if(obj.currentAttack.effects[obj.currentEffect].moveType == "upTo"){
            target = getObj("graphic", targetId) //first target
            
            var x = parseFloat(target.get("left")) - parseFloat(token.get("left"))
            var y = parseFloat(target.get("top")) - parseFloat(token.get("top"))
            var angle = Math.atan2(y, x) * 180 / Math.PI
            angle = (angle + 450) % 360

            offset = angleToAdjacent(obj.tokenId, angle)
            movePos = {
                "left": parseFloat(target.get("left")) + offset.x,
                "top": parseFloat(target.get("top")) + offset.y
            }
        }
        else if(obj.currentAttack.effects[obj.currentEffect].moveType == "behind"){

            target = getObj("graphic", targetId) //first target
            var facing = findObjs({
                _type: "graphic",
                _pageid: token.get("pageid"),
                name: targetId + "_facing",
            })[0];

            if(facing){
                var angle = facing.get("rotation")
                angle = (angle % 360)
                
                offset = angleToAdjacent(obj.tokenId, angle)
                movePos = {
                    "left": parseFloat(target.get("left")) + offset.x,
                    "top": parseFloat(target.get("top")) + offset.y
                }
            }
            else {
                log("facing not found")
                return;
            }
        }
        else if(obj.currentAttack.effects[obj.currentEffect].moveType == "tile"){
            // not tested yet
            if("targetTile" in obj){
                target = getObj("graphic", obj.targetTile)
                movePos = {
                    "left": parseFloat(target.get("left")),
                    "top": parseFloat(target.get("top"))
                }
            }
            else {
                log("weapon obj doesn't have targetTile")
            }
        }
        else if(obj.currentAttack.effects[obj.currentEffect].moveType == "dist"){
            pageid = token.get("pageid")
            page = getObj("page", pageid)
            var gridSize = 70 * parseFloat(page.get("snapping_increment"));
            
            x2 = -obj.currentAttack.effects[obj.currentEffect].x
            y2 = -obj.currentAttack.effects[obj.currentEffect].y
            
            dist = Math.sqrt(x2 ** 2 + y2 ** 2)
            log(obj.currentAttack.effects[obj.currentEffect])
            vecx = x2 / dist
            vecy = y2 / dist
            
            log(vecx)
            log(vecy)
            newLeft = vecx * obj.currentAttack.effects[obj.currentEffect].dist / 5 * gridSize
            newTop = vecy * obj.currentAttack.effects[obj.currentEffect].dist / 5 * gridSize
        
            movePos = snapGrid(newLeft, newTop, x1, y1, token.get("pageid"))

        }
        log(movePos)
    

        token.set(movePos)   
    
        // manually run function for on:change graphic
        collision = changeGraphic(token, {"top": y1, "left": x1})
        if(collision){
            // no splat for move
        }

    }
}

async function addCondition(obj){
    log("add condition")
    attack = obj.currentAttack
    effect = obj.currentAttack.effects[obj.currentEffect]

    damageString = obj.outputs.CONDITION + "[TTB 'width=100%'][TRB][TDB width=60%]** Target **[TDE][TDB 'width=40%' 'align=center']** Condition **[TDE][TRE]"
    for(i in attack.targets){
        target = attack.targets[i].token
        type = effect.type

        // set condition with id
        state.HandoutSpellsNS.OnInit[target].conditions[type] = {"id": condition_ids[type]}
        damageString += "[TRB][TDB width=60%]" + getCharName(target) + "[TDE][TDB 'width=40%' 'align=center']" + type + "[TDE][TRE]"
    }

    damageString += "[TTE]"

    replacements = {
        "WEAPON": attack.attackName,
        "TYPE": obj.weaponType,
        "ELEMENT": "Condition",
        "MAGNITUDE": obj.magnitude,
        "CONDITION": damageString,
        "ROLLCOUNT": 0
    }
    log(replacements)

    for (var attr in replacements){obj.outputs[attr] = replacements[attr]}
}

async function addDoT(obj){
    log("add dot")
    attack = obj.currentAttack
    effect = obj.currentAttack.effects[obj.currentEffect]
    
    let critMagObj = await getAttrObj(getCharFromToken(obj.tokenId), "13ZZ1Z_crit_weapon_mag")
    let critPierceObj = await getAttrObj(getCharFromToken(obj.tokenId), "13ZZ6Z_crit_weapon_pierce")

    mods = getConditionMods(obj.tokenId, effect.code)
    var critString = ""
    var applyCount = 1

    const attackRoll = randomInteger(20)
    if(attackRoll >= mods.critThres){
        log("crit")
        applyCount += 1
        // on crit apply twice
        // baseMag = obj.magnitude
        // critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        
        // critMagObj.set("current", critMag)
        // critPierceObj.set("current", state.HandoutSpellsNS.coreValues.CritPierce)
        critString = "✅"
    }

    damageString = obj.outputs.DURATION + "[TTB 'width=100%'][TRB][TDB width=60%]** Status Target **[TDE][TDB 'width=40%' 'align=center']** Duration **[TDE][TRE]"
    
    mag = obj.magnitude + mods.rollCount
    // damage = effect.damagePerTurn + mods.rollDie
    for (let i = 0; i < applyCount; i++) {
        
        let duration = await attackRoller("[[" + effect.duration + "+" + mods.rollAdd + "]]")

        // add modifiers to the damage parts
        
        targetDamage = {}
        source = obj.tokenId
        if("shape" in attack.targetType){
            source = attack.targetType.shape.targetToken
        }
        log(attack.targets)
        for (i in attack.targets) {
            effectTarget = attack.targetType.effectTargets[obj.currentEffect]
            if(!(effectTarget.includes(attack.targets[i].type))){continue}
            target = attack.targets[i].token
            blocking = checkBarriers(source, target)
            // bonusDamage = 0
            // if("bonusDamage" in attack.targets[i]){
            //     bonusDamage = attack.targets[i].bonusDamage
            // }
            
            if(blocking.length > 0){
                // deal full damage to barrier
                // barrierReduce(obj.tokenId, target, (mag * damage + bonusDamage) * duration[1], blocking)
            }
            else{
                // apply status to target
                targetTurn = state.HandoutSpellsNS.OnInit[target] // assumes the target has a turn

                // create a weapon with the damaging attack
                let weapon = new Weapon(obj.tokenId)
                await weapon.init(obj.weaponName)
                weapon.setCurrentAttack(effect.attackName)
                weapon.currentAttack.targets = {"0": attack.targets[i]}

                targetTurn.statuses.push({
                    "attack": weapon,
                    "remainingTurns": duration[1],
                    "icon": effect.icon
                })
                
                // targetTurn.statuses.push({
                //     "damageType": effect.damageType,
                //     "damageTurn": damage + bonusDamage,
                //     "magnitude": mag,
                //     "remainingTurns": duration[1],
                //     "bodyPart": attack.targets[i].bodyPart,
                //     "icon": effect.icon
                // })

                token = getObj("graphic", target)
                currentMarkers = token.get("statusmarkers").split(",")
                const allMarkers = JSON.parse(Campaign().get("token_markers"));
                for(marker in allMarkers){
                    if(allMarkers[marker].name == effect.icon){
                        log("marker found")
                        const markerString = allMarkers[marker].tag + "@" + duration[1]
                        currentMarkers.push(markerString)
                        break;
                    }
                }

                token.set("statusmarkers", currentMarkers.join(","))
            }
            
            damageString += "[TRB][TDB width=60%]" + getCharName(target) + "[TDE][TDB 'width=40%' 'align=center'][[" + duration[0] + "]][TDE][TRE]"
        }
    }

    damageString += "[TTE]"

    log(damageString)

    replacements = {
        "WEAPON": attack.attackName,
        "TYPE": obj.weaponType,
        "ELEMENT": effect.damageType,
        "MAGNITUDE": mag,
        "DURATION": damageString,
        "ROLLCOUNT": 0,
        "CRIT": critString
    }
    // log(replacements)

    for (var attr in replacements){obj.outputs[attr] = replacements[attr]}
    // let spellString = await getSpellString("DamageEffect", replacements)
    // log(spellString)
    // sendChat(obj.tokenName, "!power" + spellString)

    // is there a better way to reset all these?
    critMagObj.set("current", 0)
    critPierceObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(obj.tokenId), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)

}


async function dealDamage(obj){
    log("deal damage")
    attack = obj.currentAttack
    effect = obj.currentAttack.effects[obj.currentEffect]
    
    var damage
    var mods = getConditionMods(obj.tokenId, effect.code)
    var critString = ""
    
    if("flatDamage" in effect){
        let roll_damage = await attackRoller("[[" + effect.flatDamage + "+" + mods.rollDie + "+" + mods.rollAdd + "]]")
        damage = roll_damage
    }
    else {
        // input is the attack attackect
        let critMagObj = await getAttrObj(getCharFromToken(obj.tokenId), "13ZZ1B_crit_mag")
    
        if(randomInteger(20) >= mods.critThres){
            log("crit")
            baseMag = obj.magnitude
            critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
            critMagObj.set("current", critMag)
            critString = "✅"
            state.HandoutSpellsNS.OnInit[obj.tokenId].conditions["critical"] = {"id": "B"}
            mods = getConditionMods(obj.tokenId, effect.code)
        }

        let roll_damage = await attackRoller("[[(" + obj.magnitude + "+" + mods.rollCount + ")d(" + effect.baseDamage + "+" + mods.rollDie + ")+" + mods.rollAdd + "]]")
        damage = roll_damage
    }
    log(damage)

    log(obj.outputs.DAMAGETABLE)
    damageString = obj.outputs.DAMAGETABLE + "[TTB 'width=100%'][TRB][TDB width=60%]** Damage Target **[TDE][TDB 'width=20%' 'align=center']** ND **[TDE][TDB 'width=20%' 'align=center']** PD **[TDE][TRE]"
    normal = 1.0 - mods.pierce

    targetDamage = {}
    source = obj.tokenId
    if("shape" in attack.targetType){
        source = attack.targetType.shape.targetToken
    }
    for (i in attack.targets) {
        effectTarget = attack.targetType.effectTargets[obj.currentEffect]
        if(!(effectTarget.includes(attack.targets[i].type))){continue}
        target = attack.targets[i].token
        blocking = checkBarriers(source, target)
        bonusDamage = 0
        for(var property in attack.targets[i]){
            if(property.includes("bonusDamage")){
                bonusDamage += attack.targets[i][property]
            }
        }
        // if("bonusDamage" in attack.targets[i]){
        //     bonusDamage = attack.targets[i].bonusDamage
        // }

        reduction = barrierReduce(obj.tokenId, target, damage[1] + bonusDamage, blocking)
        targetDamage[i] = reduction[0]

        damageString += "[TRB][TDB width=60%]" + getCharName(target) + "[TDE][TDB 'width=20%' 'align=center'][[ceil((" + damage[0] + "+" + bonusDamage.toString() + ")*" + normal + 
                        ")]][TDE][TDB 'width=20%' 'align=center'][[floor((" + damage[0] + "+" + bonusDamage.toString() + ")*" + mods.pierce + ")]][TDE][TRE]"
    }

    damageString += "[TTE]"
    
    log(targetDamage)

    replacements = {
        "WEAPON": attack.attackName,
        "TYPE": obj.weaponType,
        "ELEMENT": effect.damageType,
        "MAGNITUDE": obj.magnitude,
        "DAMAGETABLE": damageString,
        "ROLLCOUNT": mods.rollCount,
        "CRIT": critString
    }

    for (var attr in replacements){obj.outputs[attr] = replacements[attr]}

    // is there a better way to reset all these?
    // critMagObj.set("current", 0)
    // critPierceObj.set("current", 0)
    // let counterMagObj = await getAttrObj(getCharFromToken(obj.tokenId), "1ZZZ1Z_temp_counterspell")
    // counterMagObj.set("current", 0)
    delete state.HandoutSpellsNS.OnInit[obj.tokenId].conditions.critical

    // deal auto damage
    for (i in attack.targets){
        effectTarget = attack.targetType.effectTargets[obj.currentEffect]
        if(!(effectTarget.includes(attack.targets[i].type))){continue}
        applyDamage(attack.targets[i].token, Math.ceil(targetDamage[i] * normal), effect.damageType, attack.targets[i].bodyPart, attack.targets[i].hitType)
        applyDamage(attack.targets[i].token, Math.ceil(targetDamage[i] * mods.pierce), "Pierce", attack.targets[i].bodyPart, attack.targets[i].hitType)
    }
}

async function bonusStat(obj){
    log("add bonusStat")
    attack = obj.currentAttack
    effect = obj.currentAttack.effects[obj.currentEffect]
    log(attack)
    // if an attack is not ongoing, the stat is applied to self
    // if applying to self, then effect is from toggle and also includes damage per turn
    targets = {}
    targets[0] = {"token": obj.tokenId, "type": "primary", "bodyPart": "Torso", "hitType": 0}
    toggled = true
    if(!_.isEmpty(attack.targets)){
        targets = attack.targets
        toggled = false
    }
    log(effectTarget = attack.targetType)
    // for each target
    for(i in targets){
        effectTarget = attack.targetType.effectTargets[obj.currentEffect]
        log(effectTarget)
        if(!(effectTarget.includes(targets[i].type))){continue}
        target = targets[i].token
        // create attribute for stat
        let statObj = await getAttrObj(getCharFromToken(target), effect.code + "_" + effect.name)

        // assign value
        statObj.set("current", effect.value)
        status = {
            "name": effect.code + "_" + effect.name,
            "icon": effect.icon
        }
        
        // add icon to token
        token = getObj("graphic", target)
        currentMarkers = token.get("statusmarkers").split(",")
        const allMarkers = JSON.parse(Campaign().get("token_markers"));
        for(marker in allMarkers){
            if(allMarkers[marker].name == effect.icon){
                log("marker found")
                // roll duration if needed
                var markerString = allMarkers[marker].tag
                if("duration" in effect){
                    let duration = await attackRoller("[[" + effect.duration + "]]")
                    log(duration)
                    markerString = markerString + "@" + duration[1]
                    status["remainingTurns"] = duration[1]
                }
                currentMarkers.push(markerString)
                break;
            }
        }
        token.set("statusmarkers", currentMarkers.join(","))

        // if a toggled ability, add damage to the status
        if(toggled){

            let weapon = new Weapon(obj.tokenId)
            await weapon.init(obj.weaponName)

            weapon.setCurrentAttack(effect.damagePerTurn)
            weapon.currentAttack.targets = {"0": targets[i]}

            status["attack"] = weapon
        }
        log(status)

        // add status to target turn
        if(Campaign().get("turnorder") != ""){
            targetTurn = state.HandoutSpellsNS.OnInit[target]
            targetTurn.statuses.push(status)
        }
    }
}

function getConditionMods(tokenId, code){
    log("get conditions")
    // look at conditions in turnActions[tokenId].conditions
    // calculate mods for each condition
    // summ all mods and return in object

    conditions = state.HandoutSpellsNS.OnInit[tokenId].conditions
    var rollAdd = 0;
    var rollDie = 0;
    var rollCount = 0;
    var critThres = state.HandoutSpellsNS.coreValues.CritThres;
    var pierce = 0;
    charid = getCharFromToken(tokenId)

    var digit = 2;
    if(code[0] === "1"){
        digit = 4;
    }

    for(condition in conditions){
        condition_code = replaceDigit(code, code.length-1, conditions[condition].id) // change the condition digit from condition id number
        log(charid)
        
        rollCount += getMods(charid, replaceDigit(condition_code, digit, "1"))[0].reduce((a, b) => a + b, 0)
        rollDie += getMods(charid, replaceDigit(condition_code, digit, "2"))[0].reduce((a, b) => a + b, 0)
        rollAdd += getMods(charid, replaceDigit(condition_code, digit, "3"))[0].reduce((a, b) => a + b, 0)
        critThres += getMods(charid, replaceDigit(condition_code, digit, "5"))[0].reduce((a, b) => a + b, 0)
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

async function setBonusDamage(obj){
    log("bonus damage")
    attack = obj.currentAttack
    effect = obj.currentEffect
    log(attack.effects[effect])
    // based on a scale 
    // calculate the bonus value as either proportion to scale or 1.0x 
    // create code with condition code and bonus value

    switch(attack.effects[effect].scale){
        case "move":
            // distance moved by weilder. Could be last turn or this turn
            token = getObj("graphic", obj.tokenId)
            charId = getCharFromToken(obj.tokenId)
            moved = parseInt(token.get("bar3_value"))
            speed = getAttrByName(charId, "Move", "current")
            speed = parseInt(speed)
            var val = speed - moved
            for(i in attack.targets){
                effectTarget = attack.targetType.effectTargets[effect]
                if(!(effectTarget.includes(attack.targets[i].type))){continue}
                target = attack.targets[i].token
                attack.targets[i][effect] = Math.floor(val * attack.effects[effect].scaleMod)
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_move_bonus"
            break;
        case "distance":
            // check for all targets
            for(i in attack.targets){
                effectTarget = attack.targetType.effectTargets[effect]
                if(!(effectTarget.includes(attack.targets[i].type))){continue}
                target = attacks.targets[i].token
                val = getRadiusRange(obj.tokenId, target)
                attack.targets[i][effect] = Math.floor(val * attack.effects[effect].scaleMod)
            }

            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_dist_bonus"
            
            break;
        case "targets":
            // number of targets attacked
            val = Object.keys(attack.targets).length
            for(var i in attack.targets){
                effectTarget = attack.targetType.effectTargets[effect]
                if(!(effectTarget.includes(attack.targets[i].type))){continue}
                attack.targets[i][effect] = Math.floor(val * attack.effects[effect].scaleMod)
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_targets_bonus"
            break;
        case "reaction":
            // if reacting this turn
            if(state.HandoutSpellsNS.OnInit[obj.tokenId].turnType == "Reaction"){
                log("getting here")
                for(var i in attack.targets){
                    effectTarget = attack.targetType.effectTargets[effect]
                    if(!(effectTarget.includes(attack.targets[i].type))){continue}
                    attack.targets[i][effect] = Math.floor(1.0 * attack.effects[effect].scaleMod)
                }
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_reaction_bonus"

            break;
        case "parry":
            // check if selected reaction is parry. Need to decide if still using counter as selction
            break;
        case "vision":
            // check if outside vision cone of target
            // how to handle multi-target?
            for(var i in attack.targets){
                effectTarget = attack.targetType.effectTargets[effect]
                if(!(effectTarget.includes(attack.targets[i].type))){continue}
                target = attack.targets[i].token
                if(!inView(target, obj.tokenId)){
                    attack.targets[i][effect] =  Math.floor(1.0 * attack.effects[effect].scaleMod)   
                }
            }
            
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_vision_bonus"
            break;
    }

    return attr_name
}

class Weapon {
    tokenId;
    weaponName;
    weaponType;
    magnitude;
    currentAttack = {};
    currentEffect = {};
    attacks;
    tokenName = "";
    basicAttack = "default";
    burstAttack = "default"
    outputs = {
        "KNOCKBACK": "",
        "SPLAT": "",
        "WEAPON": "",
        "TYPE": "",
        "ELEMENT": "",
        "MAGNITUDE": "",
        "DAMAGETABLE": "",
        "ROLLCOUNT": "",
        "CRIT": "",
        "DURATION": "",
        "CONDITION": "",
        "COST": ""   
    };

    // optional attack properties: targetTile, targetAngle
    
    constructor(input){
        // log("construct")

        if(typeof input == "string"){
            this.tokenId = input
            this.tokenName = getCharName(input)  
        }
        else if(typeof input == "object"){
            for(var attr in input){
                this[attr] = input[attr]
            }
        }
        else {
            log("ERROR: unhandled constructor input")
        }
    }

    async init(weaponName){
        log("init weapon")
        var weaponObj = {};
        let handout = findObjs({_type: "handout", name: weaponName})[0]
        if(handout){
            weaponObj = await new Promise((resolve, reject) => {
                handout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Weapon handout '" + weaponName + "'not found!")
            return false;
        }
        // log(weaponObj)

        this.weaponName = weaponName;
        this.attacks = weaponObj.attacks;
        this.weaponType = weaponObj.weaponType;
        this.magnitude = weaponObj.magnitude;
        this.basicAttack = weaponObj.basicAttack;
        this.burstAttack = weaponObj.burstAttack;
        this.toggle = weaponObj.toggle;
        // log(this.attacks)

        return true;
    }

    setCurrentAttack(attackName){
        log("set attack")
        // set the current attack object
        if(attackName in this.attacks){
            this.currentAttack = this.attacks[attackName]

            // reset the output string
            this.outputs = {
                "KNOCKBACK": "",
                "SPLAT": "",
                "WEAPON": "",
                "TYPE": "",
                "ELEMENT": "",
                "MAGNITUDE": "",
                "DAMAGETABLE": "",
                "ROLLCOUNT": "",
                "CRIT": "",
                "DURATION": "",
                "CONDITION": "",
                "COST": ""   
            };

            return true
        }
        else{
            log("Weapon does not have an attack with name: " + attackName)
            return false
        }

    }

    selectTargets(){
        log("select targets")
        // from current attack, select targets
        // temp target button
        sendChat("System", '!power --whisper|"' + this.tokenName + '" --!target|~C[Select Target](!TargetTest ' + this.tokenId + " &#64;{target|token_id})~C")
    }

    makeBasicAttack(){
        // double check that toggle matches basic attack
        // but needs the toggle effect?
        return this.setCurrentAttack(this.basicAttack)
    }

    makeBurstAttack(){
        // double check that toggle matches basic attack
        // but needs the toggle effect?
        return this.setCurrentAttack(this.burstAttack)
    }

    async toggleOn(abilityName){
        log("toggle on")

        var token = getObj("graphic", this.tokenId)
        if(parseInt(token.get("bar1_value")) <= 0){
            // spirit is zero
            sendChat("System", "Cannot use toggle ability with 0 spirit")
            return;
        }
        
        if(abilityName in this.attacks){
            this.currentAttack = this.attacks[abilityName]
        }
        else {
            log("ERROR: No ability with the name " + abilityName)
            return;
        }


        this.currentEffect = "bonusStat"
        
        bonusStat(this)
        if("changeAttack" in this.currentAttack.effects){
            this.basicAttack = this.currentAttack.effects["changeAttack"].enhanced
        }
        if("changeBurst" in this.currentAttack.effects){
            this.burstAttack = this.currentAttack.effects["changeBurst"].enhanced
        }

        sendChat("System", abilityName + " toggled on")
    }

    async toggleOff(abilityName){
        log("toggle off")
        
        if(abilityName in this.attacks){
            this.currentAttack = this.attacks[abilityName]
        }
        else {
            log("ERROR: No ability with the name " + abilityName)
            return;
        }

        var effect = this.currentAttack.effects["bonusStat"]
        this.currentEffect = "bonusStat"
        let statObj = await getAttrObj(getCharFromToken(this.tokenId), effect.code + "_" + effect.name)
        
        statObj.set("current", 0)

        // remove icon
        var token = getObj("graphic", this.tokenId)
        var markers = token.get("statusmarkers").split(",")
        for (let j = 0; j < markers.length; j++) {
            if(markers[j].includes(effect.icon)){
                log("marker found")
                markers.splice(j, 1)
                break
            }
        }
        token.set("statusmarkers", markers.join(","))

        // remove status
        if(Campaign().get("turnorder") != ""){
            var turn = state.HandoutSpellsNS.OnInit[this.tokenId]
            log(turn.statuses)
            for (let i = 0; i < turn.statuses.length; i++) {
                if("name" in turn.statuses[i] && turn.statuses[i].name == effect.code + "_" + effect.name){
                    log("status found")

                    // remove status
                    turn.statuses.splice(i, 1)
                    break
                }
            }
        }

        if("changeAttack" in this.currentAttack.effects){
            this.basicAttack = this.currentAttack.effects["changeAttack"].normal
        }
        if("changeBurst" in this.currentAttack.effects){
            this.burstAttack = this.currentAttack.effects["changeBurst"].normal
        }

        sendChat("System", abilityName + " toggled off")
    }

    async toggleAbility(abilityName){
        log("toggle")

        // how to do this without using attack method in turn?
        // will toggle ability do anything besides bonusStat -> auto change to alternate attack?
        
        // toggle self targetted effect on or off
        // cannot perform while an attack is ongoing or if spirit is zero
        var token = getObj("graphic", this.tokenId)
        if(!_.isEmpty(this.currentAttack.targets)){
            // attack is ongoing
            sendChat("System", "Cannot use toggle ability after attacking")
            return;
        }
        else if(parseInt(token.get("bar1_value")) <= 0){
            // spirit is zero
            sendChat("System", "Cannot use toggle ability with 0 spirit")
            return;
        }
        
        if(abilityName in this.attacks){
            this.currentAttack = this.attacks[abilityName]
        }
        else {
            log("ERROR: No ability with the name " + abilityName)
            return;
        }

        // should this get changed to handle multiple bonusStats?
        if("bonusStat" in this.currentAttack.effects){
            // check if current value is zero, toggle off if not
            var effect = this.currentAttack.effects["bonusStat"]
            this.currentEffect = "bonusStat"
            let statObj = await getAttrObj(getCharFromToken(this.tokenId), effect.code + "_" + effect.name)

            if(statObj.get("current") == 0){
                // toggle ability on
                log("toggle on")
                bonusStat(this)
                if("changeAttack" in this.currentAttack.effects){
                    this.basicAttack = this.currentAttack.effects["changeAttack"].enhanced
                }
                if("changeBurst" in this.currentAttack.effects){
                    this.burstAttack = this.currentAttack.effects["changeBurst"].enhanced
                }
            }
            else{
                // toggle ability off
                log("toggle off")
                statObj.set("current", 0)

                var turn = state.HandoutSpellsNS.OnInit[this.tokenId]
                log(turn.statuses)
                for (let i = 0; i < turn.statuses.length; i++) {
                    if("name" in turn.statuses[i] && turn.statuses[i].name == effect.code + "_" + effect.name){
                        log("status found")
                        // remove icon
                        var markers = token.get("statusmarkers").split(",")
                        for (let j = 0; j < markers.length; j++) {
                            if(markers[j].includes(effect.icon)){
                                log("marker found")
                                markers.splice(j, 1)
                                break
                            }
                        }
                        token.set("statusmarkers", markers.join(","))

                        // remove status
                        turn.statuses.splice(i, 1)
                        break
                    }
                }

                if("changeAttack" in this.currentAttack.effects){
                    this.basicAttack = this.currentAttack.effects["changeAttack"].normal
                }
                if("changeBurst" in this.currentAttack.effects){
                    this.burstAttack = this.currentAttack.effects["changeBurst"].normal
                }
            }
        }

        // display message about toggle ability
        this.currentAttack = {}
    }

    async applyEffects(){
        log("effects")
        // applying effects of the current attack to the targets
        
        var extraAttack = ""
        for(const effect in this.currentAttack.effects){
            log(effect)
            this.currentEffect = effect
            if(effect == "attack"){
                // can only have one attack per effect list
                // daisy chain multi attacks together
                extraAttack = this.currentAttack.effects[effect].attack

            }
            else {
                // get the root effect name before the _
                await effectFunctions[effect.split("_")[0]](this)
            }
        }
        
        // output message
        let spellString = await getSpellString("DamageEffect", this.outputs)
        // log(spellString)
        sendChat(this.tokenName, "!power" + spellString)

        // handle multiple attacks after the output
        if(extraAttack != ""){
            await state.HandoutSpellsNS.currentTurn.attack("weapon", extraAttack, "")
        }
    }
}

effectFunctions = {
    "damage": function(obj) {return dealDamage(obj);},
    "knockback": function(obj) {return knockback(obj);},
    "move": function(obj) {return movement(obj);},
    "status": function(obj) {return addDoT(obj)},
    "statMod": function(obj) {return bonusStat(obj)},
    "attack": function(tokenId, weaponName, attackName, contId) {return weaponAttack(tokenId, weaponName, attackName, contId);},
    "condition": function(obj) {return addCondition(obj)},
    "bonusDamage": function(obj) {return setBonusDamage(obj)}
}

// state.HandoutSpellsNS.currentTurn = {};

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(";;");

    if (msg.type == "api" && msg.content.indexOf("!EquipWeapon") === 0) {
        log("equip weapon")
        log(args)
        // get current equip status
        let equipState = findObjs({_type: "attribute", name: "repeating_attacks_" + args[2] + "_WeaponEquip"})[0]
        if(!equipState){
            sendChat("System", "/w GM Attribute not found!")
            return
        }

        if(equipState.get("current") == "Equip"){
            // weapon is unequipped
            if(Campaign().get("turnorder") == ""){
                // equip out of combat
                equipState.set("current", "Unequip")
                sendChat("System", args[1] + " is equipped")
            }
            else {
                // equip during turn
                currentTurn = state.HandoutSpellsNS.currentTurn

                // check if current token matches equip character
                if(getCharFromToken(currentTurn.tokenId) != equipState.get("characterid")){
                    sendChat("System", 'Cannot change equipped items out of turn!')
                    return
                }
        
                weapon = new Weapon(currentTurn.tokenId)
                if(await weapon.init(args[1])){
                    currentTurn.ongoingAttack = weapon
                    equipState.set("current", "Unequip")
                    sendChat("System", args[1] + " is equipped")
                }
            }
        }
        else {
            // weapon is equipped
            if(Campaign().get("turnorder") == ""){
                // equip out of combat
                equipState.set("current", "Equip")
                sendChat("System", args[1] + " is unequipped")
            }
            else {
                // equip during turn
                currentTurn = state.HandoutSpellsNS.currentTurn

                // check if current token matches equip character
                if(getCharFromToken(currentTurn.tokenId) != equipState.get("characterid")){
                    sendChat("System", 'Cannot change equipped items out of turn!')
                    return
                }

                currentTurn.ongoingAttack = {}
                equipState.set("current", "Equip")
                sendChat("System", args[1] + " is unequipped")
            }
        }

    }

    if (msg.type == "api" && msg.content.indexOf("!WeaponAttack") === 0) {
        log("weapon attack")

        testTurn = state.HandoutSpellsNS.currentTurn
        log(args)

        if("weaponName" in testTurn.ongoingAttack){
            testTurn.attack("weapon", args[1], "")
        }
        else{
            sendChat("System", "No weapon is equipped")
        }
    }

    if (msg.type == "api" && msg.content.indexOf("!ToggleAbility") === 0) {
        log("toggle test")

        log(args)
        
        // check that weapon is equipped
        let equipState = findObjs({_type: "attribute", name: "repeating_attacks_" + args[2] + "_WeaponEquip"})[0]
        if(!equipState){
            sendChat("System", "/w GM Attribute not found!")
            return
        }
        else if(equipState.get("current") == "Equip"){
            sendChat("System", "Cannot use toggle ability for unequipped weapon!")
            return
        }
        
        // get toggle state
        let toggleState = findObjs({_type: "attribute", name: "repeating_attacks_" + args[2] + "_ToggleState"})[0] //assuming to get
        log(toggleState)
        if(toggleState.get("current") == "Toggle On"){
            // toggle on
            if(Campaign().get("turnorder") == ""){
                log("temp toggle on")
                // create a temporary weapon
                
                tokenId = getTokenId(msg)
                if(tokenId){
                    weapon = new Weapon(tokenId)
                    let weaponName = findObjs({_type: "attribute", name: "repeating_attacks_" + args[2] + "_WeaponName"})[0] //assuming to get
                    await weapon.init(weaponName.get("current"))
                    weapon.toggleOn(args[1])
                }
                else{
                    return
                }
            }
            else {
                currentTurn = state.HandoutSpellsNS.currentTurn
                if("weaponName" in currentTurn.ongoingAttack){
                    currentTurn.ongoingAttack.toggleOn(args[1])
                }
                else{
                    return
                }
            }

            toggleState.set("current", "Toggle Off")
        }
        else {
            // toggle off
            if(Campaign().get("turnorder") == ""){
                log("temp toggle off")
                // create a temporary weapon
                
                tokenId = getTokenId(msg)
                if(tokenId){
                    weapon = new Weapon(tokenId)
                    let weaponName = findObjs({_type: "attribute", name: "repeating_attacks_" + args[2] + "_WeaponName"})[0] //assuming to get
                    await weapon.init(weaponName.get("current"))
                    weapon.toggleOff(args[1])
                }
                else{
                    return
                }
            }
            else {
                currentTurn = state.HandoutSpellsNS.currentTurn
                if("weaponName" in currentTurn.ongoingAttack){
                    currentTurn.ongoingAttack.toggleOff(args[1])
                }
                else{
                    return
                }
            }

            toggleState.set("current", "Toggle On")
        }
    }

    if (msg.type == "api" && msg.content.indexOf("!AdjacentTest") === 0) {
        log("adjacent test")

        attacker = args[1]
        target = args[2]

        log(inView(attacker, target))
        log(getRadiusRange(attacker, target))

        tok = getObj("graphic", attacker)
    
        createObj("path", 
            {
                layer: "objects",
                // _path: "[[\"M\",0,0],[\"L\",0,210],[\"Q\",210,210,210,0],[\"L\",0,0]]",
                _path: "[[\"M\",0,0],[\"L\",148.5,-148.5],[\"Q\",0,-297,-148.5,-148.5],[\"L\",0,0]]",
                controlledby: tok.get("controlledby"),
                top: tok.get("top"),
                left: tok.get("left"),
                width: 297,
                height: 297,
                pageid: tok.get("_pageid"),
                fill: "#ffff00"
            });
    }   
});