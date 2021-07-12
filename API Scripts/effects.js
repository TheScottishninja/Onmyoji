
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
    const sourceToken = getObj("graphic", obj.tokenId)
    pageid = sourceToken.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    
    x2 = parseFloat(sourceToken.get("left"))
    y2 = parseFloat(sourceToken.get("top"))

    moveDist = obj.currentEffect.distance
    splatTargets = []
    for(var target in obj.currentAttack.targets){
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
        damageString = "[TTB 'width=100%'][TRB][TDB width=60%]** Target **[TDE][TDB 'width=40%' 'align=center']** Splat Damage **[TDE][TRE]"
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
        1: [1, 1],
        2: [1, 1],
        3: [1, 0],
        4: [1, 0],
        5: [1, -1],
        6: [1, -1],
        7: [0, -1],
        8: [0, -1],
        9: [-1, -1],
        10: [-1, -1],
        11: [-1, 0],
        12: [-1, 0],
        13: [-1, 1],
        14: [-1, 1],
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
    angle = angle % 360.0

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
    // move: {"moveTargets": ("self", "target#"), "moveType":("upTo, behind, tile")}
    // upTo and behind use attack targets, tile use targetTile property

    var moveTargets = []
    if(obj.currentEffect.moveTargets == "self"){moveTargets = [obj.tokenId]}
    // add other move target types

    _.each(moveTargets, function(moveTarget){
        // assume always moving to one target?
        var movePos = {}
        var token = getObj("graphic", moveTarget)
        if(obj.currentEffect.moveType == "upTo"){
            firstTarget = Object.keys(obj.currentAttack.targets)[0]
            target = getObj("graphic", firstTarget) //first target
            
            var x = parseFloat(target.get("left")) - parseFloat(token.get("left"))
            var y = parseFloat(target.get("top")) - parseFloat(token.get("top"))
            var angle = Math.atan2(y, x) * 180 / Math.PI
            angle = (angle + 450) % 360

            offset = angleToAdjacent(obj.tokenId, angle)
            log(offset)
            movePos = {
                "left": parseFloat(target.get("left")) + offset.x,
                "top": parseFloat(target.get("top")) + offset.y
            }
        }
        log(movePos)
    
        x1 = parseFloat(token.get("left"))
        y1 = parseFloat(token.get("top"))

        token.set(movePos)   
    
        // manually run function for on:change graphic
        collision = changeGraphic(token, {"top": y1, "left": x1})
        if(collision){
            // ignore collisions for move
        }

    })
}


async function dealDamage(obj){
    log("deal damage")
    attack = obj.currentAttack
    effect = obj.currentEffect
    
    // input is the attack attackect
    let critMagObj = await getAttrObj(getCharFromToken(obj.tokenId), "13ZZ1Z_crit_weapon_mag")
    let critPierceObj = await getAttrObj(getCharFromToken(obj.tokenId), "13ZZ6Z_crit_weapon_pierce")

    mods = getConditionMods(obj.tokenId, effect.code)
    var critString = ""
    if(randomInteger(20) >= mods.critThres){
        log("crit")
        baseMag = obj.magnitude
        critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        
        critMagObj.set("current", critMag)
        critPierceObj.set("current", state.HandoutSpellsNS.coreValues.CritPierce)
        critString = "✅"
    }

    let damage = await attackRoller("[[(" + obj.magnitude + "+" + mods.rollCount + ")d(" + effect.baseDamage + "+" + mods.rollDie + ")+" + mods.rollAdd + "]]")
    log(damage)

    damageString = "[TTB 'width=100%'][TRB][TDB width=60%]** Target **[TDE][TDB 'width=20%' 'align=center']** ND **[TDE][TDB 'width=20%' 'align=center']** PD **[TDE][TRE]"
    normal = 1.0 - mods.pierce

    targetDamage = {}
    for (target in attack.targets) {
        blocking = checkBarriers(obj.tokenId, target)
        bonusDamage = 0
        if("bonusDamage" in attack.targets[target]){
            bonusDamage = attack.targets[target].bonusDamage
        }

        reduction = barrierReduce(obj.tokenId, target, damage[1] + bonusDamage, blocking)
        targetDamage[target] = reduction[0]

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
    // let spellString = await getSpellString("DamageEffect", replacements)
    // log(spellString)
    // sendChat(obj.tokenName, "!power" + spellString)

    // is there a better way to reset all these?
    critMagObj.set("current", 0)
    critPierceObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(obj.tokenId), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)

    // deal auto damage
    for (target in attack.targets){
        applyDamage(target, Math.ceil(targetDamage[target] * normal), effect.damageType, attack.targets[target].bodyPart, attack.targets[target].hitType)
        applyDamage(target, Math.ceil(targetDamage[target] * mods.pierce), "Pierce", attack.targets[target].bodyPart, attack.targets[target].hitType)
    }
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
    points = getObj("graphic", tokenId).get("lastmove")
    points = points.split(",")
    end_point = [getObj("graphic", tokenId).get("left"), getObj("graphic", tokenId).get("top")]

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

    x1 = parseFloat(points[points.length-2])
    y1 = parseFloat(points[points.length-1])
    x2 = parseFloat(end_point[0])
    y2 = parseFloat(end_point[1])

    dist += Math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

    pageid = getObj("graphic", tokenId).get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));

    return Math.round(dist / gridSize) * parseInt(page.get("scale_number"));
}

async function setBonusDamage(obj){
    log("bonus damage")
    attack = obj.currentAttack
    log(attack.effects.bonusDamage)
    // based on a scale 
    // calculate the bonus value as either proportion to scale or 1.0x 
    // create code with condition code and bonus value

    switch(attack.effects.bonusDamage.scale){
        case "move":
            // distance moved by weilder. Could be last turn or this turn
            scale = graphicMoveDistance(obj.tokenId)
            for(target in attack.targets){
                attack.targets[target]["bonusDamage"] = Math.round(scale * attack.effects.bonusDamage.scaleMod)
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_move_bonus"
            break;
        case "distance":
            // check for all targets
            for(target in attack.targets){
                scale = getRadiusRange(obj.tokenId, target)
                attack.targets[target]["bonusDamage"] = Math.round(scale * attack.effects.bonusDamage.scaleMod)
            }

            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_dist_bonus"
            
            break;
        case "targets":
            // number of targets attacked
            scale = attack.targets.length
            for(target in attack.targets){
                attack.targets[target]["bonusDamage"] = Math.round(scale * attack.effects.bonusDamage.scaleMod)
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_targets_bonus"
            break;
        case "reaction":
            // if reacting this turn
            
            for(target in attack.targets){
                if(state.HandoutSpellsNS.OnInit[obj.tokenId]["type"] == "Reaction"){
                    attack.targets[target]["bonusDamage"] =  Math.round(1.0 * attack.effects.bonusDamage.scaleMod)                
                }
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_reaction_bonus"
            break;
        case "parry":
            // check if selected reaction is parry. Need to decide if still using counter as selction
            break;
        case "vision":
            // check if within vision cone of target
            // how to handle multi-target?
            scale = []
            for(target in attack.targets){
                if(inView(target, obj.tokenId)){
                    attack.targets[target]["bonusDamage"] =  Math.round(1.0 * attack.effects.bonusDamage.scaleMod)   
                }
            }
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
    outputs = {
        "KNOCKBACK": "",
        "SPLAT": "",
        "WEAPON": "",
        "TYPE": "",
        "ELEMENT": "",
        "MAGNITUDE": "",
        "DAMAGETABLE": "",
        "ROLLCOUNT": "",
        "CRIT": ""   
    };

    // optional attack properties: targetTile, targetAngle
    
    constructor(tokenId){
        // log("construct")

        this.tokenId = tokenId;
        this.tokenName = getCharName(tokenId);
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
            log("Weapon handout not found!")
            return;
        }
        // log(weaponObj)

        this.weaponName = weaponName;
        this.attacks = weaponObj.attacks;
        this.weaponType = weaponObj.weaponType;
        this.magnitude = weaponObj.magnitude;
        // log(this.attacks)
    }

    setCurrentAttack(attackName){
        log("set attack")
        // set the current attack object
        if(attackName in this.attacks){
            this.currentAttack = this.attacks[attackName]
        }
        else{
            log("Weapon does not have an attack with name: " + attackName)
        }
    }

    selectTargets(){
        log("select targets")
        // from current attack, select targets
        // temp target button
        sendChat("System", '!power --whisper|"' + this.tokenName + '" --!target|~C[Select Target](!TargetTest ' + this.tokenId + " &#64;{target|token_id})~C")
    }

    async applyEffects(){
        log("effects")
        // applying effects of the current attack to the targets
        // check that targets have been assigned
    
        if("bonusDamage" in this.currentAttack.effects){
            // calculate bonus damage for each target
            await setBonusDamage(this)                
        }
        log(this.currentAttack.effects)

        for(const effect in this.currentAttack.effects){
            log(effect)
            this.currentEffect = this.currentAttack.effects[effect]
            if(effect == "attack"){

                let altWeapon = new Weapon(this.tokenId, this.weaponName)
                altWeapon.setCurrentAttack(this.currentAttack.effects[effect].attack)
                altWeapon.currentAttack.targets = this.currentAttack.targets
                altWeapon.applyEffects()

            }
            else if(effect == "bonusDamage"){
                // bonus damage is calculated first. skip in loop
                continue;
            }
            else {
                await effectFunctions[effect](this)
            }
        }
        
        // output message
        let spellString = await getSpellString("DamageEffect", this.outputs)
        // log(spellString)
        sendChat(this.tokenName, "!power" + spellString)
    }
}

effectFunctions = {
    "damage": function(obj) {return dealDamage(obj);},
    "knockback": function(obj) {return knockback(obj);},
    "move": function(obj) {return movement(obj);},
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

    if (msg.type == "api" && msg.content.indexOf("!AttackTest") === 0) {
        log("attack test")
        tokenId = args[1]

        let weapon = new Weapon(tokenId)
        await weapon.init("Test Weapon")
        await weapon.setCurrentAttack("Swipe")
        // log("After")
        weapon.selectTargets()

        state.HandoutSpellsNS.turnActions[tokenId].weapon = weapon
    }    

    if (msg.type == "api" && msg.content.indexOf("!TargetTest") === 0) {
        log("target test")

        tokenId = args[1]
        targetId = args[2]

        testTurn = new Turn(tokenId)
        testTurn.attack("weapon", "Test Weapon:Swipe", "")

        state.HandoutSpellsNS.turnActions[tokenId].weapon = testTurn
        // weapon = state.HandoutSpellsNS.turnActions[tokenId].weapon

        // weapon.currentAttack.targets = {targetId: {"bodyPart": "torso", "hitType": 0}}
        // weaponAttack(tokenId, state.HandoutSpellsNS.turnActions[tokenId].weapon.weaponName, attackName, "gotTargets")
        // weapon.applyEffects()
    }

    if (msg.type == "api" && msg.content.indexOf("!AdjacentTest") === 0) {
        log("adjacent test")

        pageid = getObj("graphic", args[1]).get("pageid")
        var facing = findObjs({
            _type: "graphic",
            _pageid: pageid,
            name: args[1] + "_facing",
        })[0];

        // if(facing){
        log(facing.get("rotation"))
        var angle = facing.get("rotation")

        dist = angleToAdjacent(args[1], angle)
        log(dist)
    }   
});