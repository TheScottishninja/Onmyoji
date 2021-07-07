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
            bonusDamage = attack.targets[target.bonusDamage]
        }

        targetDamage[target] = barrierReduce(obj.tokenId, target, damage[1] + bonusDamage, blocking)[0]

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

    let spellString = await getSpellString("DamageEffect", replacements)
    // log(spellString)
    sendChat(obj.tokenName, "!power" + spellString)

    // is there a better way to reset all these?
    critMagObj.set("current", 0)
    critPierceObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(obj.tokenId), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)

    // deal auto damage
    for (target in attack.targets){
        applyDamage(target, Math.ceil(targetDamage[target] * normal), effect.damageType, attack.targets[target].bodyPart, attack.targets[target].hitType)
        applyDamage(target, Math.ceil(targetDamage[target] * mod.pierce), effect.damageType, attack.targets[target].bodyPart, attack.targets[target].hitType)
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
                attack.targets[target]["bonusDamage"] = scale * attack.effects.bonusDamage.scaleMod
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_move_bonus"
            break;
        case "distance":
            // check for all targets
            for(target in attack.targets){
                scale = getRadiusRange(obj.tokenId, target)
                attack.targets[target]["bonusDamage"] = scale * attack.effects.bonusDamage.scaleMod
            }

            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_dist_bonus"
            
            break;
        case "targets":
            // number of targets attacked
            scale = attack.targets.length
            for(target in attack.targets){
                attack.targets[target]["bonusDamage"] = scale * attack.effects.bonusDamage.scaleMod
            }
            attr_name = attack.effects.bonusDamage.bonusCode + "_weapon_targets_bonus"
            break;
        case "reaction":
            // if reacting this turn
            
            for(target in attack.targets){
                if(state.HandoutSpellsNS.OnInit[obj.tokenId]["type"] == "Reaction"){
                    attack.targets[target]["bonusDamage"] =  1.0 * attack.effects.bonusDamage.scaleMod                
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
                    attack.targets[target]["bonusDamage"] =  1.0 * attack.effects.bonusDamage.scaleMod   
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
        // applying effects of the current attack to the targets
        // check that targets have been assigned
        if(this.currentAttack.targets.length > 0){
            if("bonusDamage" in this.currentAttack.effects){
                // calculate bonus damage for each target
                setBonusDamage(this)                
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
        }
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

    if (msg.type == "api" && msg.content.indexOf("!LastMoveTest") === 0) {
        log("last move test")

        dist = graphicMoveDistance(args[1])
        log(dist)
    }   
});