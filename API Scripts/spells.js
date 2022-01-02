class HandSealSpell {
    tokenId;
    spellName = "Test";
    type;
    magnitude;
    currentAttack = {};
    currentEffect = {};
    tokenName = "";
    attacks; // need for adding counter to attacks
    id = "";
    currentSeal = 0;
    seals = [];
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

    async init(spellName){
        log("init spell")
        var spellObj = {};
        let handout = findObjs({_type: "handout", name: spellName})[0]
        if(handout){
            spellObj = await new Promise((resolve, reject) => {
                handout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Spell handout '" + spellName + "'not found!")
            return false;
        }
        // log(spellObj)

        this.spellName = spellObj.name;
        this.type = spellObj.type;
        this.magnitude = spellObj.magnitude;
        this.id = spellObj.id;
        this.currentAttack = spellObj.attacks.Base
        this.seals = spellObj.seals
        this.attacks = spellObj.attacks
        // log(this.attacks)

        return true;
    }

    setCurrentAttack(){
        log("set attack")        
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
        this.currentSeal = 0

        return true

    }

    async castSpell(tokenId){
        log("castSpell")
        // check remaining hand seals per turn, tracked in turn
        // check by tokenId since it could be bolster
        var currentTurn = state.HandoutSpellsNS.OnInit[this.tokenId]
        var castingTurn = state.HandoutSpellsNS.OnInit[tokenId]
        log(castingTurn.remainingHS)
        if(castingTurn.remainingHS < 1){
            WSendChat("System", tokenId, "No more hand seals this turn!")
            return
        }

        // get next seal
        var currentSealObj = this.seals[this.currentSeal]
        log(currentSealObj)

        // check number of hands for seals vs hands available

        // get hand seal mods for tokenId (could be different from this.tokenId)
        var mods = getConditionMods(tokenId, "360")
        var critString = ""
        // let critMagObj = await getAttrObj(getCharFromToken(this.tokenId), "11ZZ1B_crit_mag") // must be caster
        var contCast = ""
        var charName = getCharName(tokenId)

        // roll for success
        var roll = randomInteger(20)
        if(roll >= mods.critThres){
            // handle crit
            log("crit")
            
            // check how many seals are left to cast
            var remainingSeals = this.seals.length - this.currentSeal - 1

            if(remainingSeals < 2){
                // critically cast the spell

                // var baseMag = this.magnitude
                // var critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
                // critMagObj.set("current", critMag)
                critString = "✅ Critical Spellcast!"
                state.HandoutSpellsNS.OnInit[this.tokenId].conditions["critical"] = {"id": "B"}
                // mods = getConditionMods(this.tokenId, "360")
                await setCrit(this)
                this.outputs.CRIT = "✅"

                // decrement hand seals per turn
                castingTurn.remainingHS -= 1
                this.currentSeal += 2
            }
            else{
                // update current seal
                critString = "✅ Reduce Seals by 1"
                this.currentSeal += 2

                // decrement hand seals per turn
                castingTurn.remainingHS -= 1
                
                // check if casting can continue
                if(castingTurn.remainingHS > 0){
                    // continue casting
                    contCast = tokenId
                }
                else {
                    // check for bolster
                    for(var token in currentTurn.reactors){
                        if(currentTurn.reactors[token].type == "Bolster" && !currentTurn.reactors[token].attackMade){
                            // prompt bolster reactor to continue
                            currentTurn.reactors[token].attackMade = true
                            contCast = token
                            break
                        }
                    }
                }
            }

            // output success result
            const replacements = {
                "SEAL": currentSealObj.name,
                "SPELL": this.spellName,
                "NUM": this.currentSeal - 1,
                "TOTAL": this.seals.length,
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.HandSealDC,
                "CRIT": 1,
                "MESSAGE": critString
            }

            // output message
            let spellString = await getSpellString("FormHandSeal", replacements)
            log(spellString)
            sendChat(charName, "!power " + spellString)

            // check for cast complete
            if(this.currentSeal >= this.seals.length){
                log("seal cast complete")
                // if countering, no targetting needed
                if(this.tokenId in state.HandoutSpellsNS.currentTurn.reactors){ // maybe need to check reaction type too
                    this.counter(this.id)
                }
                else{
                    // start targetting
                    setTimeout(function(){
                        state.HandoutSpellsNS.currentTurn.attack("", "", "target")}, 250
                    )
                }
                return
            }
        }
        else if(roll + mods.rollAdd >= state.HandoutSpellsNS.coreValues.HandSealDC){
            log("success")
    
            // update current seal
            this.currentSeal += 1

            // decrement hand seals per turn
            castingTurn.remainingHS -= 1
            log(castingTurn.remainingHS)
            
            // check if casting can continue
            if(castingTurn.remainingHS > 0){
                // continue casting
                contCast = tokenId
            }
            else {
                // check for bolster
                for(var token in currentTurn.reactors){
                    if(currentTurn.reactors[token].type == "Bolster" && !currentTurn.reactors[token].attackMade){
                        // prompt bolster reactor to continue
                        currentTurn.reactors[token].attackMade = true
                        contCast = token
                        break
                    }
                }
            }

            // output success result
            const replacements = {
                "SEAL": currentSealObj.name,
                "SPELL": this.spellName,
                "NUM": this.currentSeal,
                "TOTAL": this.seals.length,
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.HandSealDC,
                "CRIT": 0,
                "MESSAGE": critString
            }

            // output message
            let spellString = await getSpellString("FormHandSeal", replacements)
            log(spellString)
            sendChat(charName, "!power " + spellString)    

            // check for cast complete
            if(this.currentSeal >= this.seals.length){
                log("seal cast complete")
                // if countering, no targetting needed
                if(this.tokenId in state.HandoutSpellsNS.currentTurn.reactors){ // maybe need to check reaction type too
                    this.counter(this.id)
                }
                else{
                    // start targetting
                    setTimeout(function(){
                        state.HandoutSpellsNS.currentTurn.attack("", "", "target")}, 250
                    )
                }
                return
            }
        }
        else {
            log("fail")
            // if fail, check for bolster
            for(var token in currentTurn.reactors){
                if(currentTurn.reactors[token].type == "Bolster" && !currentTurn.reactors[token].attackMade){
                    // prompt bolster reactor to continue
                    currentTurn.reactors[token].attackMade = true
                    contCast = token
                    break
                }
            }

            // output fail result
            const replacements = {
                "SEAL": currentSealObj.name,
                "SPELL": this.spellName,
                "NUM": this.currentSeal + 1,
                "TOTAL": this.seals.length,
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.HandSealDC,
                "CRIT": 0,
                "MESSAGE": critString
            }

            // output message
            let spellString = await getSpellString("FormHandSeal", replacements)
            log(spellString)
            sendChat(charName, "!power " + spellString)    

            if(contCast == ""){
                // failed with no bolster, spell fails
                log("spell failed")

                // check if casting a counter attack
                if("Counter" in state.HandoutSpellsNS.OnInit[this.tokenId].conditions){
                    // mark counter attack as made
                    state.HandoutSpellsNS.currentTurn.reactors[this.tokenId].attackMade = true

                    // check if all counters complete
                    var reactors = state.HandoutSpellsNS.currentTurn.reactors
                    for(var reactor in reactors){
                        if("attackMade" in reactors[reactor] && !reactors[reactor].attackMade){
                            // another counter to be complete, return early
                            return
                        }
                    }
                
                    // resume attack
                    setTimeout(function(){
                        state.HandoutSpellsNS.currentTurn.attack("counterComplete", "", "defense")}, 500
                    )
                }
                else {
                    // failed without bolster, remove from currentSpell
                    state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
                }

                return
            }
        }

        // continue button or continue next turn
        if(contCast != "" && this.currentSeal < this.seals.length){
            // continue casting this turn
            log("continue this turn")
            charName = getCharName(contCast)
            setTimeout(function(){
                sendChat("System", '!power --whisper|"' + charName + '" --!Seal|~C[Next Seal](!HSTest;;' + contCast + ")~C")}, 250
            )
        }
        else{
            // continue casting next turn
            log("continue next turn")
            setTimeout(function(){
                sendChat("System", '!power --whisper|"' + charName + '" --!Seal|**Continue casting next turn!**')}, 250
            )

        }
    }

    async channelSpell(tokenId){
        log("channel")

        // set Channeling condition
        state.HandoutSpellsNS.OnInit[tokenId].conditions["Channel"] = {"id": condition_ids["Channel"]}

        // set currentAttack to Channel attack
        this.currentAttack = this.attacks["Channel"]
        this.currentAttack.targets = this.attacks.Base.targets

        // get mods
        var code = this.getCode()
        var mods = getConditionMods(tokenId, code) // change this to be utility check

        // calculate difference between caster level and spell magnitude with scaling
        var charId = getCharFromToken(tokenId)
        var castLvl = this.magnitude - parseInt(getAttrByName(charId, "Level"))
        castLvl = Math.max(0, castLvl)
        
        // roll against cast DC
        var roll = randomInteger(20)
        var critString = ""
        // let critMagObj = await getAttrObj(getCharFromToken(this.tokenId), "11ZZ1B_crit_mag") // must be caster
        var charName = getCharName(tokenId)

        // handle critical
        if(roll >= mods.critThres){
            log("crit")
            critString = "✅ Critical!"
            state.HandoutSpellsNS.OnInit[this.tokenId].conditions["critical"] = {"id": "B"}
            // setCrit(this) // should crit channel do something?
            this.outputs.CRIT = "✅"
        }

        // handle success output
        if(roll + mods.rollAdd >= state.HandoutSpellsNS.coreValues.TalismanDC[castLvl]){
            log("success")
            
            // output result
            const replacements = {
                "SPELL": this.spellName,
                "TYPE": this.type,
                "DAMAGE": "Channel",
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
                "CRIT": mods.critThres,
                "MAGNITUDE": this.magnitude,
                "COST": "",
                "TOTAL": roll + mods.rollAdd
            }
    
            let spellString = await getSpellString("TalismanCast", replacements)
            sendChat(charName, "!power " + spellString)

            if(this.type == "Area"){
                // start targetting for area spells 
                setTimeout(function(){
                    state.HandoutSpellsNS.currentTurn.attack("", "", "target")}, 250
                )
            }
            else{
                // apply effects of channel spell 
                log(this.currentAttack)
                this.applyEffects()
            }
        }
        // handle fail output
        else{
            log("fail")

            // future check for bolster

            // output result
            const replacements = {
                "SPELL": this.spellName,
                "TYPE": this.type,
                "DAMAGE": "Channel",
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
                "CRIT": mods.critThres,
                "MAGNITUDE": this.magnitude,
                "COST": "",
                "TOTAL": roll + mods.rollAdd
            }
    
            let spellString = await getSpellString("TalismanCast", replacements)
            sendChat(charName, "!power " + spellString)

            // dismiss spell
            this.dismissSpell()
            delete state.HandoutSpellsNS.OnInit[this.tokenId].conditions.Channel
        }

    }

    async dismissSpell(tokenId){
        log("dismiss")
    
        // get target names
        var names = []
        for (var i in this.currentAttack.targets){
            names.push(getCharName(this.currentAttack.targets[i].token))
        }

        // remove spell effects
        if(this.type == "Binding"){
            await removeBind(this)
        }
        else if(this.type == "Barrier"){
            await removeBarrier(this)
        }
        
        // output result
        // const replacements = {
        // }
        
        // let spellString = await getSpellString("TalismanCast", replacements)

        // remove currentSpell
        state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
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
        log(spellString)
        sendChat(this.tokenName, "!power" + spellString)

        // handle multiple attacks after the output 
        if(extraAttack != ""){
            var targets = this.currentAttack.targets

            if("shape" in this.currentAttack.targetType){
                // need to pass the source token
                var targetToken = this.currentAttack.targetType.shape.targetToken
                this.setCurrentAttack(extraAttack)
                this.currentAttack.targets = targets
                this.currentAttack.targetType.shape.targetToken = targetToken
            }
            else{
                this.setCurrentAttack(extraAttack)
                this.currentAttack.targets = targets
            }
            if("bodyPart" in this.currentAttack.targetType){
                // set the bodypart for each target
                for(var i in this.currentAttack.targets){
                    this.currentAttack.targets[i].bodyPart = this.currentAttack.targetType.bodyPart
                }
            }
            setTimeout(function(){
                state.HandoutSpellsNS.currentTurn.attack("", "", "defense")}, 500
            )
        }
        else if(!(['Exorcism', 'Binding', 'Stealth', 'Barrier'].includes(this.type))){
            // if spell is not channel, clear currentSpell
            state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
        }
    }

    getCode(){
        if(this.id != "" && !_.isEmpty(this.currentAttack)){
            for(var attack in this.attacks){
                if("damage" in this.attacks[attack].effects){
                    return this.attacks[attack].effects.damage.code
                }
                else if("status" in this.attacks[attack].effects){
                    return this.attacks[attack].effects.status.code
                }
            }
                return "1ZZZ00"
        }
        else{
            log("Spell not initialized")
        }
    }

    getDamageType(){
        var damageType = ""
        for(var attack in this.attacks){
            if("damage" in this.attacks[attack].effects){
                damageType = this.attacks[attack].effects.damage.damageType
                break
            }
        }

        return damageType
    }

    async counter(){
        log("counter attack")
        // change this for using only barrier spells
    
        // roll for critical
        var attack = this.currentAttack
        // var effect = this.currentAttack.effects["damage"]
        
        var mods = getConditionMods(this.tokenId, "250")
        
        // get modded magnitude for attack
        let roll_mag = await attackRoller("[[(" + this.magnitude + "+" + mods.rollCount + ")]]")
        
        // set code for spell or weapon counter
        // how do hand seal counters work?
        var code = "1ZZZ10"
        var attackName = "Counter"
        
        // create a fake attack for counter
        var counterAttack = new HandSealSpell(this.tokenId)
        await counterAttack.init(this.id)
        var counterTarget = {"0":{
            "token": state.HandoutSpellsNS.OnInit[this.tokenId].turnTarget,
            "type": "primary",
            "hitType": 0
        }}
        counterAttack.attacks["Counter"] = {
            "attackName": attackName,
            "desc": "",
            "targets": counterTarget,
            "targetType": {"effectTargets":{"bonusStat": "primary", "damage": ""}},
            "effects": {
                "bonusStat": {
                    "code": code,
                    "name": "counter-" + this.tokenId,
                    "value": -roll_mag[1],
                    "icon": "interdiction",
                    "duration": 1
                }
            }
        }
        
        // apply effects of attack to add mod to target
        counterAttack.currentAttack = counterAttack.attacks.Counter
        state.HandoutSpellsNS.currentTurn.reactors[this.tokenId].attackMade = true
        
        // display counter results
        var replacements = {
            "WEAPON": attackName,
            "TYPE": this.spellName,
            "ELEMENT": attack.attackName,
            "MAGNITUDE": this.magnitude,
            // "DAMAGETABLE": damageString,
            "ROLLCOUNT": mods.rollCount,
            // "CRIT": critString
        }
        for (var attr in replacements){counterAttack.outputs[attr] = replacements[attr]}
        await counterAttack.applyEffects()
    
    
        // check if all counters complete
        var reactors = state.HandoutSpellsNS.currentTurn.reactors
        for(var reactor in reactors){
            if("attackMade" in reactors[reactor] && !reactors[reactor].attackMade){
                // another counter to be complete, return early
                return
            }
        }
    
        // resume attack
        setTimeout(function(){
            state.HandoutSpellsNS.currentTurn.attack("counterComplete", "", "defense")}, 500
        )
    }

    whatami(){
        log("I am Hand Seal")
    }
}

class TalismanSpell {
    tokenId;
    spellName = "Test";
    type;
    magnitude;
    attacks; // need for adding counter to attacks
    currentAttack = {};
    currentEffect = {};
    tokenName = "";
    id = "";
    scalingCost; //{"Fire": 1}
    scale = 0;
    costs = {
        "Fire": 0,
        "Water": 0,
        "Earth": 0,
        "Metal": 0,
        "Wood": 0
    }
    icons = {
        "Fire": "https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/candlebright_small.png",
        "Water": "https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/water-drop_small.png",
        "Earth": "https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/peaks_small.png",
        "Metal": "https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/anvil_small.png",
        "Wood": "https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/beech_small.png"
    }
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
    typeCodes = {
        "Fire": "1",
        "Water": "2",
        "Wood": "3",
        "Metal": "4",
        "Earth": "5"
    }

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

    async init(spellName){
        log("init spell")
        var spellObj = {};
        let handout = findObjs({_type: "handout", name: spellName})[0]
        if(handout){
            spellObj = await new Promise((resolve, reject) => {
                handout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Spell handout '" + spellName + "'not found!")
            return false;
        }
        // log(spellObj)

        this.spellName = spellObj.name;
        this.type = spellObj.type;
        this.magnitude = spellObj.magnitude;
        this.id = spellName;
        this.currentAttack = spellObj.attacks.Base
        this.scalingCost = spellObj.scalingCost
        for(var type in spellObj.costs){
            this.costs[type] = spellObj.costs[type]
        }
        this.attacks = spellObj.attacks
        // log(this.attacks)

        return true;
    }

    setCurrentAttack(attackName){
        log("set attack")        
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
        
        if(attackName in this.attacks){
            this.currentAttack = this.attacks[attackName]
        }
        else {
            log("invalid attackName")
        }

        return true

    }

    getDamageType(){
        var damageType = ""
        for(var attack in this.attacks){
            if("damage" in this.attacks[attack].effects){
                damageType = this.attacks[attack].effects.damage.damageType
                break
            }
        }

        return damageType
    }

    scalingOptions(){
        log("scalingOptions")

        // check if caster (currentTurn) can afford baseCost
        for (var type in this.costs){
            var currentInv = getAttrByName(getCharFromToken(this.tokenId), type.toLowerCase() + "_current")
            if(parseInt(currentInv) < this.costs[type]){
                sendChat("System", "Insufficient talismans to cast spell!")
                return
            }
        }

        // calculate difference between caster level and spell magnitude
        var castLvl = this.magnitude - parseInt(getAttrByName(getCharFromToken(this.tokenId), "Level"))
        castLvl = Math.max(0, castLvl)
        var optionString = ["[TTB 'width=100%'][TRB][TDB width=50%]** Casting Options **[TDE][TDB 'width=25%' 'align=center']** DC **[TDE][TDB 'width=25%' 'align=center']** Cost **[TDE][TRE][TTE]"]
        log(castLvl)
        // create buttons for each option
        for (let i = 0; i < 6; i++) {
            // calculate DC and cost for up to +5 from base scale
            var castDC = state.HandoutSpellsNS.coreValues.TalismanDC[castLvl + i];
            var castCost = {}
            var costString = ""
            for(var type in this.costs){
                if(this.costs[type] > 0){
                    castCost[type] = this.costs[type]
                    if(type in this.scalingCost){castCost[type] += this.scalingCost[type] * i}
                    costString = costString + castCost[type].toString() + '[x](' + this.icons[type] + ') '
                }
                else if(type in this.scalingCost){
                    castCost[type] = this.scalingCost[type] * i
                    costString = costString + castCost[type].toString() + '[x](' + this.icons[type] + ') '
                }
            }

            // create button and table row
            optionString.push("[TTB 'width=100%'][TRB][TDB 'width=50% align=center'] [ +" + i.toString() + " Magnitude](!CastTalisman,," + i.toString() + ") [TDE][TDB 'width=25% align=center']" + castDC.toString() + "[TDE][TDB 'width=25% align=center']" + costString + "[TDE][TRE][TTE]")
        }

        

        // send output
        sendChat("System", '!power --whisper|"' + this.tokenName + '" --template|Talisman|' + 
            this.spellName + ";" + this.getDamageType() + ";" + this.type + ";" + this.magnitude + ";" + optionString.join(";") + ";")
    }

    async castSpell(tokenId){
        log("castSpell")

        // consume talismans from caster (currentTurn)
        var costString = ""
        log(this.costs)
        for (var cost in this.costs){
            let currentInv = await getAttrObj(getCharFromToken(this.tokenId), cost.toLowerCase() + "_current")
            var newCurrent = this.costs[cost]
            if(cost in this.scalingCost){newCurrent += this.scale * this.scalingCost[cost]}
            currentInv.set("current", parseInt(currentInv.get("current")) - newCurrent)
            
            if(newCurrent > 0){
                costString = costString + newCurrent.toString() + "[x](" + this.icons[cost] + ") "
            }

        }
        log(costString)
        
        // get mods
        if(this.scale > 0){
            // add condition for scaling the talisman spell
            state.HandoutSpellsNS.OnInit[this.tokenId].conditions["Scale"] = {"id": condition_ids["Scale"]}
        }
        var mods = getConditionMods(tokenId, "380")

        // calculate difference between caster level and spell magnitude with scaling
        var charId = getCharFromToken(tokenId)
        var castLvl = this.magnitude - parseInt(getAttrByName(charId, "Level")) + this.scale
        castLvl = Math.max(0, castLvl)
        
        // roll against cast DC
        var roll = randomInteger(20)
        var critString = ""
        // let critMagObj = await getAttrObj(getCharFromToken(this.tokenId), "11ZZ1B_crit_mag") // must be caster
        var charName = getCharName(tokenId)
        
        if(roll >= mods.critThres){
            // handle crits
            log("crit")
            // var baseMag = this.magnitude
            // var critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
            // critMagObj.set("current", critMag)
            critString = "✅ Critical!"
            state.HandoutSpellsNS.OnInit[this.tokenId].conditions["critical"] = {"id": "B"}
            // mods = getConditionMods(this.tokenId, "380")
            setCrit(this)
            this.outputs.CRIT = "✅"
        }
        
        if(roll + mods.rollAdd >= state.HandoutSpellsNS.coreValues.TalismanDC[castLvl]){
            // succeed cast
            log("success")

            // output result
            const replacements = {
                "SPELL": this.spellName,
                "TYPE": this.type,
                "DAMAGE": this.getDamageType(),
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
                "CRIT": mods.critThres,
                "MAGNITUDE": this.magnitude + this.scale,
                "COST": costString,
                "TOTAL": roll + mods.rollAdd
            }
            log(replacements)

            let spellString = await getSpellString("TalismanCast", replacements)
            log(spellString)
            sendChat(charName, "!power " + spellString)   

            // set magnitude to magnitdue + scaling for apply effects
            // this is a problem in testing if I press twice
            this.magnitude += this.scale
            // critMagObj.set("current", 0)

            // if countering, no targetting needed
            if(this.tokenId in state.HandoutSpellsNS.currentTurn.reactors){ // maybe need to check reaction type too
                this.counter()
            }
            else{
                // start targetting
                setTimeout(function(){
                    state.HandoutSpellsNS.currentTurn.attack("", "", "target")}, 250
                )
            }
            

        }
        else {
            log("fail")
            // if fail, check for bolster
            // change this to handle non-current turn!!!!!
            var currentTurn = state.HandoutSpellsNS.OnInit[this.tokenId]
            var bolster = false
            for(var token in currentTurn.reactors){
                if(currentTurn.reactors[token].type == "Bolster" && !currentTurn.reactors[token].attackMade){
                    // prompt bolster reactor to continue
                    currentTurn.reactors[token].attackMade = true
                    WSendChat("System", token, "Aid " + charName + " casting " + this.spellName + ": [Bolster](!CastTalisman)")
                    bolster = true
                    break
                }
            }

            // output result
            const replacements = {
                "SPELL": this.spellName,
                "TYPE": this.type,
                "DAMAGE": this.getDamageType(),
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
                "CRIT": mods.critThres,
                "MAGNITUDE": this.magnitude + this.scale,
                "COST": costString,
                "TOTAL": roll + mods.rollAdd
            }

            let spellString = await getSpellString("TalismanCast", replacements)
            log(spellString)
            sendChat(charName, "!power " + spellString)   

            // if no bolster and countering, resume original spell
            if(!bolster && this.tokenId in state.HandoutSpellsNS.currentTurn.reactors){
                // set attackMade
                state.HandoutSpellsNS.currentTurn.reactors[this.tokenId].attackMade = true

                // check if all counters complete
                var reactors = state.HandoutSpellsNS.currentTurn.reactors
                for(var reactor in reactors){
                    if("attackMade" in reactors[reactor] && !reactors[reactor].attackMade){
                        // another counter to be complete, return early
                        return
                    }
                }
            
                // resume attack
                setTimeout(function(){
                    state.HandoutSpellsNS.currentTurn.attack("counterComplete", "", "defense")}, 500
                )
            }
            else if(!bolster){
                // spell fails with no bolster, remove from currentSpell
                state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
            }
        }

        delete state.HandoutSpellsNS.OnInit[this.tokenId].conditions["Scale"]
    }

    async channelSpell(tokenId){
        log("channel")

        // set Channeling condition
        state.HandoutSpellsNS.OnInit[tokenId].conditions["Channel"] = {"id": condition_ids["Channel"]}

        // set currentAttack to Channel attack
        this.currentAttack = this.attacks["Channel"]

        // get mods
        var code = this.getCode()
        var mods = getConditionMods(tokenId, code) // change this to be utility check

        // calculate difference between caster level and spell magnitude with scaling
        var charId = getCharFromToken(tokenId)
        var castLvl = this.magnitude - parseInt(getAttrByName(charId, "Level"))
        castLvl = Math.max(0, castLvl)
        
        // roll against cast DC
        var roll = randomInteger(20)
        var critString = ""
        // let critMagObj = await getAttrObj(getCharFromToken(this.tokenId), "11ZZ1B_crit_mag") // must be caster
        var charName = getCharName(tokenId)

        // handle critical
        if(roll >= mods.critThres){
            log("crit")
            critString = "✅ Critical!"
            state.HandoutSpellsNS.OnInit[this.tokenId].conditions["critical"] = {"id": "B"}
            // setCrit(this) // should crit channel do something?
            this.outputs.CRIT = "✅"
        }

        // handle success output
        if(roll + mods.rollAdd >= state.HandoutSpellsNS.coreValues.TalismanDC[castLvl]){
            log("success")

            // start targetting
            setTimeout(function(){
                state.HandoutSpellsNS.currentTurn.attack("", "", "target")}, 250
            )
        }
        // handle fail output
        else{
            log("fail")

            // future check for bolster

            // run cancelFail
            this.cancelFail()
            delete state.HandoutSpellsNS.OnInit[this.tokenId].conditions.Channel

        }

        // output result
        const replacements = {
            "SPELL": this.spellName,
            "TYPE": this.type,
            "DAMAGE": this.getDamageType(),
            "ROLL": roll,
            "MOD": mods.rollAdd,
            "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
            "CRIT": mods.critThres,
            "MAGNITUDE": this.magnitude,
            "COST": "",
            "TOTAL": roll + mods.rollAdd
        }

        let spellString = await getSpellString("TalismanCast", replacements)
        sendChat(charName, "!power " + spellString)
    }

    async deleteSpell(){
        // remove spell effects
        if(this.type == "Area"){
            await removeArea(this)
        }

        // remove currentSpell
        state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
    }

    async dismissSpell(tokenId){
        log("dismiss")

        // set Channeling condition
        state.HandoutSpellsNS.OnInit[tokenId].conditions["Dismiss"] = {"id": condition_ids["Dismiss"]}

        // get mods
        var code = this.getCode()
        var mods = getConditionMods(tokenId, code) // change this to be utility check

        // calculate difference between caster level and spell magnitude
        var charId = getCharFromToken(tokenId)
        var castLvl = this.magnitude - parseInt(getAttrByName(charId, "Level"))
        castLvl = Math.max(0, castLvl)
        
        // roll against cast DC
        var roll = randomInteger(20)
        var critString = ""
        // let critMagObj = await getAttrObj(getCharFromToken(this.tokenId), "11ZZ1B_crit_mag") // must be caster
        var charName = getCharName(tokenId)

        // handle critical
        if(roll >= mods.critThres){
            log("crit")
            critString = "✅ Critical!"
            // setCrit(this) // should crit dismiss do something?
        }

        // handle success output
        if(roll + mods.rollAdd >= state.HandoutSpellsNS.coreValues.TalismanDC[castLvl]){
            log("success")

            // remove spell effects
            if(this.type == "Area"){
                await removeArea(this)
            }

            // remove currentSpell
            state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
        }
        // handle fail output
        else{
            log("fail")

            // future check for bolster

            // run cancelFail
            this.cancelFail()
        }

        // output result
        const replacements = {
            "SPELL": this.spellName,
            "TYPE": this.type,
            "DAMAGE": this.getDamageType(),
            "ROLL": roll,
            "MOD": mods.rollAdd,
            "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
            "CRIT": mods.critThres,
            "MAGNITUDE": this.magnitude,
            "COST": "",
            "TOTAL": roll + mods.rollAdd
        }

        let spellString = await getSpellString("TalismanCast", replacements)
        sendChat(charName, "!power " + spellString)

        delete state.HandoutSpellsNS.OnInit[tokenId].conditions["Dismiss"]
    }

    async cancelFail(){
        log("cancel fail")

        // set table weights
        var table = findObjs({
            _type: "rollabletable",
            name: "Cancel-Fail"
        })[0]

        if(table){
            // loop through table items
            var rows = findObjs({
                _type: "tableitem",
                _rollabletableid: table.get("_id")
            })
            var weights = state.HandoutSpellsNS.Random.CancelFail[this.magnitude]

            _.each(rows, function(row){
                // convert item name to index and get new weight value
                var idx = parseInt(row.get("name")) - 1
                row.set("weight", weights[idx])
            })
        }
        else{
            log("Table is not found!")
        }

        // roll table 
        let result = await new Promise((resolve,reject)=>{
            sendChat('',"[[1t[Cancel-Fail]]]",(ops)=>{
                resolve(ops[0].inlinerolls[0].results);
            });
        });

        var buttonString = " [Make Static](!ConvertStatic;;" + this.tokenId + ")"
        // if(result.total == 1){
        //     // clear spell
        //     var buttonString = " [Clear Spell](!DisipateSpell;;" + this.tokenId + ")"
        // }

        // send GM outcome with effect button
        setTimeout(function(){
            sendChat("System", "/w GM " + state.HandoutSpellsNS.Random.ChannelStrings[result.total] + buttonString)}, 250
        )

    }

    async applyEffects(){
        
        log("effects")
        this.outputs.DAMAGETABLE = ""
        log(state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell)
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
        log(spellString)
        sendChat(this.tokenName, "!power" + spellString)

        delete state.HandoutSpellsNS.OnInit[this.tokenId].conditions["Channel"]

        // handle multiple attacks after the output 
        if(extraAttack != ""){
            var targets = this.currentAttack.targets

            if("shape" in this.currentAttack.targetType){
                // need to pass the source token
                var targetToken = this.currentAttack.targetType.shape.targetToken
                this.setCurrentAttack(extraAttack)
                this.currentAttack.targets = targets
                this.currentAttack.targetType.shape.targetToken = targetToken
            }
            else{
                this.setCurrentAttack(extraAttack)
                this.currentAttack.targets = targets
            }
            if("bodyPart" in this.currentAttack.targetType){
                // set the bodypart for each target
                for(var i in this.currentAttack.targets){
                    this.currentAttack.targets[i].bodyPart = this.currentAttack.targetType.bodyPart
                }
            }
            setTimeout(function(){
                state.HandoutSpellsNS.currentTurn.attack("", "", "defense")}, 500
            )
        }
        else {
            // check if spell is channeled
            if(this.type != "Area"){
                // not channeled, so do not continue casting next turn
                state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
            }
        }

    }

    getCode(){
        if(this.id != "" && !_.isEmpty(this.currentAttack)){
            if("damage" in this.currentAttack.effects){
                return this.currentAttack.effects.damage.code
            }
            else if("status" in this.currentAttack.effects){
                return this.currentAttack.effects.status.code
            }
            else {
                return "1ZZZ00"
            }
        }
        else{
            log("Spell not initialized")
        }
    }

    async counter(){
        log("counter attack")
    
        var attack = this.currentAttack
        var effect = this.currentAttack.effects["damage"]
        
        var mods = getConditionMods(this.tokenId, effect.code)
        
        // get modded magnitude for attack
        let roll_mag = await attackRoller("[[(" + this.magnitude + "+" + mods.rollCount + ")]]")
        
        // set code for spell or weapon counter
        // code based on element of spell
        var counterType = state.HandoutSpellsNS.coreValues.CancelTypes[effect.damageType]
        var code = "1ZZZ10"
        code = replaceDigit(code, 3, this.typeCodes[counterType])
        var attackName = "Counter"
        
        // create a fake attack for counter
        var counterAttack = new TalismanSpell(this.tokenId)
        await counterAttack.init(this.id)
        var counterTarget = {"0":{
            "token": state.HandoutSpellsNS.OnInit[this.tokenId].turnTarget,
            "type": "primary",
            "hitType": 0
        }}
        log(counterAttack)
        counterAttack.attacks["Counter"] = {
            "attackName": attackName,
            "desc": "",
            "targets": counterTarget,
            "targetType": {"effectTargets":{"bonusStat": "primary", "damage": ""}},
            "effects": {
                "bonusStat": {
                    "code": code,
                    "name": "counter-" + this.tokenId,
                    "value": -roll_mag[1],
                    "icon": "interdiction",
                    "duration": 1
                },
                "damage": effect
            }
        }
        
        // apply effects of attack to add mod to target
        counterAttack.currentAttack = counterAttack.attacks.Counter
        state.HandoutSpellsNS.currentTurn.reactors[this.tokenId].attackMade = true
        
        // display counter results
        var replacements = {
            "WEAPON": attackName,
            "TYPE": this.spellName,
            "ELEMENT": attack.attackName,
            "MAGNITUDE": this.magnitude,
            // "DAMAGETABLE": "Countering " + counterType + " spell.",
            "ROLLCOUNT": mods.rollCount,
            // "CRIT": critString
        }
        for (var attr in replacements){counterAttack.outputs[attr] = replacements[attr]}
        await counterAttack.applyEffects()
    
    
        // check if all counters complete
        var reactors = state.HandoutSpellsNS.currentTurn.reactors
        for(var reactor in reactors){
            if("attackMade" in reactors[reactor] && !reactors[reactor].attackMade){
                // another counter to be complete, return early
                return
            }
        }
    
        // resume attack
        setTimeout(function(){
            state.HandoutSpellsNS.currentTurn.attack("counterComplete", "", "defense")}, 500
        )
    }
}

class StaticSpell {
    tokenId = ""; // placeholder for effects
    spellName = "Test";
    type;
    magnitude;
    currentAttack = {};
    currentEffect = {};
    attacks; // need for adding counter to attacks
    id = "";
    listId = ""
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

        if(typeof input == "object"){
            for(var attr in input){
                this[attr] = input[attr]
            }
        }
        // else {
        //     log("ERROR: unhandled constructor input")
        // }
    }

    async init(spellName){
        log("init spell")
        var spellObj = {};
        let handout = findObjs({_type: "handout", name: spellName})[0]
        if(handout){
            spellObj = await new Promise((resolve, reject) => {
                handout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Spell handout '" + spellName + "'not found!")
            return false;
        }
        // log(spellObj)

        this.spellName = spellObj.name;
        this.type = spellObj.type;
        this.magnitude = spellObj.magnitude;
        this.id = spellObj.id;
        this.currentAttack = spellObj.attacks.Base
        this.attacks = spellObj.attacks
        // log(this.attacks)

        return true;
    }

    getCode(){
        if(this.id != "" && !_.isEmpty(this.currentAttack)){
            if("damage" in this.currentAttack.effects){
                return this.currentAttack.effects.damage.code
            }
            else if("status" in this.currentAttack.effects){
                return this.currentAttack.effects.status.code
            }
            else {
                return "1ZZZ00"
            }
        }
        else{
            log("Spell not initialized")
        }
    }

    whatami(){
        log("I am static")
    }

    convertSpell(spell, tokenId=""){
        log("convert spell")

        for (var attr in spell){
            if(attr in this){
                this[attr] = spell[attr]
            }
        }

        this.tokenId = tokenId
        this.listId = generateUUID()

        // rename targetToken
        targetToken = getObj("graphic", this.currentAttack.targetType.shape.targetToken)
        log(targetToken)
        targetToken.set("name", this.listId + "_target_facing")

        // change currentAttack to Channel
        this.attacks.Channel.targetType = spell.currentAttack.targetType
        this.currentAttack = this.attacks.Channel

        // add to staticEffects
        state.HandoutSpellsNS.staticEffects[this.listId] = this
    }

    setCurrentAttack(){
        log("set attack")        
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

    async castSpell(gmId){
        log("cast spell")
        // targetting for static effect
        var targetInfo = this.currentAttack.targetType
        var gm = getObj("player", gmId)
        log(gm)
        var pageid = gm.get("_lastpage")
        var page = getObj("page", pageid)
        var gridSize = 70 * parseFloat(page.get("snapping_increment"));
        var markerId = generateUUID()

        if(targetInfo.shape.type == "radius"){
            //------------------------------------ area casting -------------------------------------------
            if(targetInfo.shape.source == "tile"){
                // area casting with targeting rectical
                //create rectical token
                createObj("graphic", 
                {
                    controlledby: "",
                    left: parseFloat(page.get("width")) * gridSize / 2,
                    top: parseFloat(page.get("height")) * gridSize / 2,
                    width: gridSize,
                    height: gridSize,
                    name: markerId + "_tempMarker",
                    pageid: pageid,
                    imgsrc: "https://s3.amazonaws.com/files.d20.io/images/187401034/AjTMrQLnUHLv9HWlwBQzjg/thumb.png?16087542345",
                    layer: "objects",
                    aura1_radius: targetInfo.shape.width,
                    showplayers_aura1: true,
                });

                var target = findObjs({_type: "graphic", name: markerId + "_tempMarker"})[0];
                toFront(target);

                targetInfo.shape["targetToken"] = target.get("id")
            }
            else {
                log("invalid target type for static spell")
                return
            }
        }
        else if(targetInfo.shape.type == "cone"){
            //------------------------------------ cone casting ------------------------------------------
            if(targetInfo.shape.source == "tile"){
                // direction token                
                //create rectical token
                createObj("graphic", 
                {
                    controlledby: "",
                    left: parseFloat(page.get("width")) * gridSize / 2,
                    top: parseFloat(page.get("height")) * gridSize / 2,
                    width: gridSize,
                    height: gridSize,
                    name: markerId + "_tempMarker",
                    pageid: pageid,
                    imgsrc: "https://s3.amazonaws.com/files.d20.io/images/238043910/IzVPP4nx3tT2aDAFbEhB7w/thumb.png?16281180565",
                    layer: "objects"
                });

                var target = findObjs({_type: "graphic", name: markerId + "_tempMarker"})[0];
                toFront(target);
                targetInfo.shape["targetToken"] = target.get("id")
                createCone(this, target.get("id"))
            }
            else {
                log("invalid target type for static spell")
                return
            }
        }
        else if(targetInfo.shape.type == "beam"){
            // beam casting
            if(targetInfo.shape.source == "tile"){
                // beam comes from target and directed by rotation
                createObj("graphic", 
                {
                    controlledby: "",
                    left: parseFloat(page.get("width")) * gridSize / 2,
                    top: parseFloat(page.get("height")) * gridSize / 2,
                    width: gridSize,
                    height: gridSize,
                    name: markerId + "_tempMarker",
                    pageid: pageid,
                    imgsrc: "https://s3.amazonaws.com/files.d20.io/images/238043910/IzVPP4nx3tT2aDAFbEhB7w/thumb.png?16281180565",
                    layer: "objects"
                });

                var target = findObjs({_type: "graphic", name: markerId + "_tempMarker"})[0];
                toFront(target);
                targetInfo.shape["targetToken"] = target.get("id")
                createBeam(this, target.get("id"))
                
            }
            else {
                log("invalid target type for static spell")
                return
            }
        }
        else {
            log("ERROR: Unhandled target shape")
            return
            // unhandle target name
        }
        
        var targetString = '!power --whisper| --Confirm targeting| --!target|~C[Update](!UpdateStatic;;' + markerId + ')[Confirm](!AddStatic;;' + markerId + ')~C'
        sendChat("System", targetString)
        this.listId = markerId
        return markerId
    }

    async applyEffects(){
        log("effects")
        // applying effects of the current attack to the targets
        // should not have attack chains
        
        var extraAttack = ""
        for(const effect in this.currentAttack.effects){
            log(effect)
            this.currentEffect = effect
            // get the root effect name before the _
            await effectFunctions[effect.split("_")[0]](this)
        }
        
        // output message
        let spellString = await getSpellString("DamageEffect", this.outputs)
        log(spellString)
        sendChat("System", "!power" + spellString)
    }

    async channelSpell(tokenId){
        log("channel")

        // set Channeling condition
        state.HandoutSpellsNS.OnInit[tokenId].conditions["Channel"] = {"id": condition_ids["Channel"]}

        // set currentAttack to Channel attack
        // this.currentAttack = this.attacks["Channel"]
        // this.currentAttack.targets = this.attacks.Base.targets

        // get mods
        var code = this.getCode()
        var mods = getConditionMods(tokenId, code) // change this to be utility check

        // calculate difference between caster level and spell magnitude with scaling
        var charId = getCharFromToken(tokenId)
        var castLvl = this.magnitude - parseInt(getAttrByName(charId, "Level"))
        castLvl = Math.max(0, castLvl)
        
        // roll against cast DC
        var roll = randomInteger(20)
        var critString = ""
        // let critMagObj = await getAttrObj(getCharFromToken(this.tokenId), "11ZZ1B_crit_mag") // must be caster
        var charName = getCharName(tokenId)

        // handle critical
        if(roll >= mods.critThres){
            log("crit")
            critString = "✅ Critical!"
            state.HandoutSpellsNS.OnInit[this.tokenId].conditions["critical"] = {"id": "B"}
            // setCrit(this) // should crit channel do something?
            this.outputs.CRIT = "✅"
        }

        // handle success output
        if(roll + mods.rollAdd >= state.HandoutSpellsNS.coreValues.TalismanDC[castLvl]){
            log("success")
            
            // output result
            const replacements = {
                "SPELL": this.spellName,
                "TYPE": this.type,
                "DAMAGE": "Channel",
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
                "CRIT": mods.critThres,
                "MAGNITUDE": this.magnitude,
                "COST": "",
                "TOTAL": roll + mods.rollAdd
            }
    
            let spellString = await getSpellString("TalismanCast", replacements)
            sendChat(charName, "!power " + spellString)

            if(this.type == "Area"){
                // start targetting for area spells 
                setTimeout(function(){
                    state.HandoutSpellsNS.currentTurn.attack("", "", "target")}, 250
                )
            }
            else{
                // static effects aren't applied on channel
                log(this.currentAttack)
                // this.applyEffects()
            }
        }
        // handle fail output
        else{
            log("fail")

            // future check for bolster

            // output result
            const replacements = {
                "SPELL": this.spellName,
                "TYPE": this.type,
                "DAMAGE": "Channel",
                "ROLL": roll,
                "MOD": mods.rollAdd,
                "DIFFICULTY": state.HandoutSpellsNS.coreValues.TalismanDC[castLvl],
                "CRIT": mods.critThres,
                "MAGNITUDE": this.magnitude,
                "COST": "",
                "TOTAL": roll + mods.rollAdd
            }
    
            let spellString = await getSpellString("TalismanCast", replacements)
            sendChat(charName, "!power " + spellString)

            // dismiss spell
            this.dismissSpell()
            delete state.HandoutSpellsNS.OnInit[this.tokenId].conditions.Channel
        }

    }

    async dismissSpell(tokenId){
        log("dismiss")
    
        // remove spell effects
        if(this.type == "Binding"){
            await removeBind(this)
        }
        else if(this.type == "Barrier"){
            await removeBarrier(this)
        }
        else if(this.type == "Exorcism"){
            await removeArea(this)
            await removeStatic(this)
        }
        else if(this.type == "Area"){
            await removeArea(this)
            await removeStatic(this)
        }
        
        // output result
        // const replacements = {
        // }
        
        // let spellString = await getSpellString("TalismanCast", replacements)

        // remove currentSpell
        if(this.tokenId in state.HandoutSpellsNS.OnInit){
            state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
        }
    }

    defense(tokenId){
        log("static defense")

        // send defense actions to token
        var dodgeString = "";
        const remainingDodges = getAttrByName(getCharFromToken(tokenId), "Dodges")

        if(remainingDodges > 0) dodgeString = "[Dodge](!DefenseStatic;;" + this.listId + ";;" + tokenId + ";;1)"

        const wardString = "[Ward](!DefenseStatic;;" + this.listId + ";;" + tokenId + ";;0)"
        const hitString = "[Take Hit](!DefenseStatic;;" + this.listId + ";;" + tokenId + ";;2)"

        // get body part being targetted
        const bodyPart = this.currentAttack.targetType.shape.bodyPart

        // sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)
        WSendChat("System", tokenId, "**Incoming attack to the " + bodyPart + "**<br>" + dodgeString + wardString + hitString)
    }

    async checkRange(tokenId){
        log("check range")

        var token = getObj("graphic", tokenId);
        var page = getObj("page", token.get("pageid"))
        var gridSize = 70 * parseFloat(page.get("snapping_increment"));
        var targetInfo = this.currentAttack.targetType
        log(targetInfo)
        
        var radius = targetInfo.shape.len
        if(radius == "melee"){
            // display melee range as 5ft
            radius = 5
        }
        
        if(targetInfo.shape.type == "beam"){
            var beam_width = targetInfo.shape.width / 2.0
            var angle = getObj("graphic", targetInfo.shape.targetToken).get("rotation") * (Math.PI / 180) 
            
            var dist = getRadiusBeam(tokenId, targetInfo.shape.targetToken, angle);
            var range = getRadiusRange(tokenId, targetInfo.shape.targetToken)
            var direction = checkFOV(targetInfo.shape.path, tokenId, 180)
            // log(dist)
            var blocking = checkBarriers(tokenId, targetInfo.shape.targetToken)
            var s = token.get("bar2_value")
            var width = token.get("width") / gridSize * 2.5 + beam_width

            if ((dist <= width) & (blocking.length < 1) & (s !== "") & (range <= radius) & direction){
                token.set("tint_color", "#ff9900")
                return true
                // targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
            }
            else if((dist <= width) & (blocking.length > 0) & (s !== "") &(range <= radius) & direction){
                token.set("tint_color", "transparent")
                return false

                // targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
                // blockedTargets.push(token.get("id"))
            }
            else {
                token.set("tint_color", "transparent")
                return false
            }
        }
        else if(targetInfo.shape.type == "radius"){
            log(targetInfo.shape.targetToken)
            var range = getRadiusRange(tokenId, targetInfo.shape.targetToken);
            var blocking = checkBarriers(tokenId, targetInfo.shape.targetToken)
            var s = token.get("bar2_value")
            // log(s)
            if ((range <= radius) & (blocking.length < 1) & (s !== "")){
                token.set("tint_color", "#ff9900")
                return true

                // targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
            }
            else if((range <= radius) & (blocking.length > 0) & (s !== "")){
                token.set("tint_color", "transparent")
                return false

                // targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
                // blockedTargets.push(token.get("id"))
            }
            else {
                token.set("tint_color", "transparent")
                return false

            }
        }
        else if(targetInfo.shape.type == "cone"){
            var range = getRadiusRange(tokenId, targetInfo.shape.targetToken);
            var blocking = checkBarriers(tokenId, targetInfo.shape.targetToken)
            var s = token.get("bar2_value")
            // log(s)
            if ((range <= radius) & (blocking.length < 1) & (s !== "")){
                // check angle
                if(checkFOV(targetInfo.shape.path, tokenId, targetInfo.shape.width)){
                    token.set("tint_color", "#ff9900")
                    return true

                    // targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
                }
                else{
                    token.set("tint_color", "transparent")
                    return false
                }
            }
            else if((range <= radius) & (blocking.length > 0) & (s !== "")){
                token.set("tint_color", "transparent")
                return false

                // targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
                // blockedTargets.push(token.get("id"))
            }
            else {
                token.set("tint_color", "transparent")
                return false

            }
        }
    }
}

var testSpell;

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(",,");

    // this needs ,, split due to powercards template
    if (msg.type == "api" && msg.content.indexOf("!CastTalisman") === 0) {
        log(args)

        // check if countering
        var spell;
        if(checkParry(msg)){
            spell = state.HandoutSpellsNS.OnInit[getTokenId(msg)].currentSpell
        }
        // check if bolstering
        else if(checkBolster(msg)){
            targetToken = state.HandoutSpellsNS.OnInit[getTokenId(msg)].targetToken
            spell = state.HandoutSpellsNS.OnInit[targetToken].currentSpell
        }
        else{
            // get spell from ongoingAttack
            spell = state.HandoutSpellsNS.currentTurn.currentSpell
        }

        // set scaling based on argument
        if(args.length > 1){
            spell.scale = parseInt(args[1])
        }

        // make spell casting attempt
        await spell.castSpell(getTokenId(msg))
    }
})

function removeStatic(obj){
    log("remove static")

    for (var i in state.HandoutSpellsNS.staticEffects) {
        const static = state.HandoutSpellsNS.staticEffects[i];
        if(obj.attacks.Base.targetType.shape.targetToken == static.attacks.Base.targetType.shape.targetToken){
            // remove from staticEffects list
            delete state.HandoutSpellsNS.staticEffects[i]
            break
        }
    }
}

function compounding(){
    // check if target token is an areaToken

    // if yes, check type for counter or compound

    // if counter, reduce magnitude of both

    // if compounding, handle area spell conversion (separate function?)

    // if target is not areaToken, check if target has DoT

    // if DoT is countering, reduce magntidue of both

    // if DoT is compounding, handle DoT spell conversion (separate function?)
}

function areaCompound(){
    // check if area is channeled or static

    // if channeled, handle based on trigger:
        // projectile trigger: change area type, transfer ownership, increase mag, cast area damage
        // area trigger: remove consumed areaTokens, increase mag of trigger, cast area damage
    
    // if static
        // projectile trigger: change area type, transfer ownership, increase mag, cast area damage
        // area trigger: remove consumed areaTokens, increase mag of trigger, cast area damage
}

function dotCompound(){
    // if trigger is projectile, increase DoT mag and change type
    // if area, remove DoT and increase area spell mag
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(";;");

    if (msg.type == "api" && msg.content.indexOf("!HSInit") === 0) {
        log(args)

        testTurn = state.HandoutSpellsNS.currentTurn

        // check if combat is ongoing
        if(!("ongoingAttack" in testTurn)){
            // create fake turn and target
            sendChat("System", "Currently can't display attacks out of combat!")

            return
        }

        // check if countering
        if(checkParry(msg)){
            tokenId = getTokenId(msg)
            testSpell = new HandSealSpell(tokenId)
            let result = await testSpell.init(args[1])

            // can only counter with barrier spells?
            if(result && testSpell.type == "Barrier"){
                state.HandoutSpellsNS.OnInit[tokenId].ongoingAttack = testSpell
                testSpell.castSpell(getTokenId(msg))
            } 
            else if(testSpell.type != "Barrier"){
                WSendChat("System", tokenId, "Must use Barrier spell to counter with hand seals!")
            }   
            return
        }
        else if(!checkTurn(msg)){
            sendChat("System", "Cannot attack out of turn!")
            return
        }

        // if("weaponName" in testTurn.ongoingAttack){
        //     testTurn.attack("weapon", args[1], "")
        // }
        // else{
        //     sendChat("System", "No weapon is equipped")
        // }

        log(testTurn.tokenId)
        testTurn.attack("hand seal", args[1], "")
        log("passed")
        // testSpell = new HandSealSpell(args[1])
        // await testSpell.init("Test Spell")
        // log(testSpell.seals)
    }

    if (msg.type == "api" && msg.content.indexOf("!HSTest") === 0) {
        log(args)

        // check if countering
        var spell;
        if(checkParry(msg)){
            spell = state.HandoutSpellsNS.OnInit[getTokenId(msg)].ongoingAttack
        }
        // check if bolstering
        else if(checkBolster(msg)){
            targetToken = state.HandoutSpellsNS.OnInit[getTokenId(msg)].targetToken
            spell = state.HandoutSpellsNS.OnInit[targetToken].ongoingAttack
        }
        else{
            // get spell from ongoingAttack
            spell = state.HandoutSpellsNS.currentTurn.ongoingAttack
        }

        // make spell casting attempt
        await spell.castSpell(getTokenId(msg))
    }

    if (msg.type == "api" && msg.content.indexOf("!TalismanOptions") === 0) {
        
        log(args)

        testTurn = state.HandoutSpellsNS.currentTurn
        
        if(!("ongoingAttack" in testTurn)){
            log("currently not handling attack out of combat")
            return
        }
        
        if(checkParry(msg)){
            testSpell = new TalismanSpell(getTokenId(msg))
            let result = await testSpell.init(args[1])
            if(result){
                state.HandoutSpellsNS.OnInit[getTokenId(msg)].ongoingAttack = testSpell
                testSpell.scalingOptions()
            }    
            return
        }
        else if(!checkTurn(msg)){
            sendChat("System", "Cannot attack out of turn!")
            return
        }

        testTurn.attack("talisman", args[1], "")
    }

    if (msg.type == "api" && msg.content.indexOf("!ChannelSpell") === 0) {
        
        log(args)

        testTurn = state.HandoutSpellsNS.currentTurn
        
        if(!("ongoingAttack" in testTurn)){
            log("currently not handling attack out of combat")
            return
        }
        
        if(checkParry(msg)){
            sendChat("System", "Cannot maintain a channeled spell while countering!")
            return
        }
        else if(checkBolster(msg)){
            // future check for bolster
            sendChat("System", "Cannot bolster a channeled spell!")
            return
        }
        else if(!checkTurn(msg)){
            sendChat("System", "Cannot attack out of turn!")
            return
        }

        testTurn.currentSpell.channelSpell(getTokenId(msg))
    }

    if (msg.type == "api" && msg.content.indexOf("!DismissSpell") === 0) {
        
        log(args)

        testTurn = state.HandoutSpellsNS.OnInit[getTokenId(msg)]
        
        if(!("ongoingAttack" in testTurn)){
            log("currently not handling attack out of combat")
            return
        }
        
        // if(checkParry(msg)){
        //     sendChat("System", "Cannot maintain a channeled spell while countering!")
        //     return
        // }
        // else if(checkBolster(msg)){
        //     // future check for bolster
        //     sendChat("System", "Cannot bolster a channeled spell!")
        //     return
        // }
        // else if(!checkTurn(msg)){
        //     sendChat("System", "Cannot attack out of turn!")
        //     return
        // }

        testTurn.currentSpell.dismissSpell(getTokenId(msg))
    }

    if (msg.type == "api" && msg.content.indexOf("!TargetStatic") === 0) {
        log("target static")

        currentTurn = state.HandoutSpellsNS.currentTurn
        if(!_.isEmpty(currentTurn)){
            log("can't place static in combat")
            return
        }

        spell = new StaticSpell()
        await spell.init(args[1])
        log(msg.playerid)
        id = await spell.castSpell(msg.playerid)

        state.HandoutSpellsNS.staticEffects[id] = spell
    }

    if (msg.type == "api" && msg.content.indexOf("!UpdateStatic") === 0) {
        log("update static")


        log(state.HandoutSpellsNS.staticEffects)

        latestStatic = state.HandoutSpellsNS.staticEffects[args[1]]
        log(latestStatic)
        targetInfo = latestStatic.currentAttack.targetType

        if((targetInfo.shape.type == "cone" || targetInfo.shape.type == "beam") & "path" in targetInfo.shape){
            obj = getObj("path", targetInfo.shape.path)
            // ensure it lines up with token
            obj.set({
                top: getObj("graphic", targetInfo.shape.targetToken).get("top"),
                left: getObj("graphic", targetInfo.shape.targetToken).get("left"),
                rotation: getObj("graphic", targetInfo.shape.targetToken).get("rotation")
            })
        }
    
    }

    if (msg.type == "api" && msg.content.indexOf("!AddStatic") === 0) {
        log("add static")

        // remove targeting
        var allTokens = findObjs({
            _type: "graphic",
            _pageid: getObj("player", msg.playerid).get("_lastpage"),
            layer: "objects",
        });
        
        _.each(allTokens, function(token){
            token.set({
                tint_color: "transparent",
                // aura1_radius: "",
                showplayers_aura1: false
            })
            if(token.get("name") == args[1] + "_tempMarker"){
                // set target token to gm layer
                // token.remove();
                token.set("layer", "gmlayer")
            }
        })
    
        latestStatic = state.HandoutSpellsNS.staticEffects[args[1]]
        if("shape" in latestStatic.currentAttack.targetType){
            if("path" in latestStatic.currentAttack.targetType.shape){
                cone = getObj("path", latestStatic.currentAttack.targetType.shape.path)
                cone.remove()
                delete latestStatic.currentAttack.targetType.shape.path
            }
        }

        // apply effects
        latestStatic.applyEffects()
        state.HandoutSpellsNS.currentTurn = {}
    }

    if (msg.type == "api" && msg.content.indexOf("!ClearStatic") === 0) {
        log("clear static")
        log(state.HandoutSpellsNS.staticEffects)

        for (var i in state.HandoutSpellsNS.staticEffects) {
            const static = state.HandoutSpellsNS.staticEffects[i];
            
            if(static.type == "Barrier"){
                removeBarrier(static)
                removeStatic(static)
            }
            else if(static.type == "Area" || static.type == "Exorcism"){
                removeArea(static)
                removeStatic(static)
            }
            else {
                removeStatic(static)
            }
        }
        log(state.HandoutSpellsNS.staticEffects)
    }

    if (msg.type == "api" && msg.content.indexOf("!DefenseStatic") === 0) {
        log(args)

        // get static effect from id
        static = state.HandoutSpellsNS.staticEffects[args[1]]


        // check if attempting to dodge
        hitType = args[3]
        targetId = args[2]
        dodged = false
        if(hitType == "1"){
            // if hitType is 1, roll for dodge
            // decrement current dodge on char sheet
            const charId = getCharFromToken(targetId)
            let dodgeObj = await getAttrObj(charId, "Dodges")
            if(parseInt(dodgeObj.get("current")) > 0){
                dodgeObj.set("current", parseInt(dodgeObj.get("current")) - 1)
            }
            else{
                // no more dodges available, return early
                WSendChat("System", targetId, "No more dodges available this turn!")
                return false
            }

            // check for full dodge reaction
            var dodgeDC = state.HandoutSpellsNS.coreValues.DodgeDC
            var mods = getConditionMods(targetId, "2100")            

            // check if target body part is torso
            if(!static.currentAttack.targetType.shape.bodyPart.includes("Torso")){
                // reduced DC for attacks to extremities
                dodgeDC = dodgeDC - state.HandoutSpellsNS.coreValues.NonTorsoDodge + attackMod
            }
            log(dodgeDC)
            
            var roll = randomInteger(20)
            var crit = 0
            // get character's agility score
            const agility = parseInt(getAttrByName(getCharFromToken(targetId), "Agility"))
            if(roll >= mods.critThres){
                log("crit dodge")
                crit = 1
                // what to do with critical dodge
                // auto succeed even on area
                dodged = true
            }

            else {
                if((roll + mods.rollAdd + agility) >= dodgeDC){
                    // succeed in dodge
                    // remove from target list if not an area spell
                    if(static.currentAttack.type != "Area"){
                        dodged = true
                    }
                }
                else {
                    hitType = "0"
                }
            }

            // display parameters
            var name = getCharName(targetId)
            
            const replacements = {
                "DEFENDER": name,
                "AGILITY": agility,
                "ROLL": roll,
                "TOTAL": agility + roll + mods.rollAdd,
                "THRES": dodgeDC,
                "MODS": mods.rollAdd,
                "CRIT": crit
            }

            // output message
            let spellString = await getSpellString("DodgeRoll", replacements)
            log(spellString)
            sendChat(name, "!power" + spellString)
        }

        if(!dodged){
            // add target to static
            static.currentAttack.targets["0"] = {"token": args[2], "type": "primary","bodyPart": static.currentAttack.targetType.shape.bodyPart, "hitType": hitType}
    
            // apply effects
            await static.applyEffects()
            static.setCurrentAttack()
        }

        // resume advancing turn
        setTimeout(function(){
            advanceTurn()}, 500
        )
        
    }

    if (msg.type == "api" && msg.content.indexOf("!ConvertStatic") === 0) {
        log(args)

        tokenId = args[1]

        // _.each(msg.selected, async function(selected){
        //     tokenId = selected._id
        //     log(tokenId)

        if(tokenId in state.HandoutSpellsNS.OnInit){
            spell = state.HandoutSpellsNS.OnInit[tokenId].currentSpell
            log(spell)
            if(!_.isEmpty(spell)){
                static = new StaticSpell()
                await static.convertSpell(spell)

                state.HandoutSpellsNS.OnInit[tokenId].currentSpell = {}
                sendChat("System", "/w GM **" + spell.spellName + "** moved to static")
            }
        }
        // })

        log(state.HandoutSpellsNS.staticEffects)
    }

    if (msg.type == "api" && msg.content.indexOf("!DisipateSpell") === 0) {
        log(args)

        spell = state.HandoutSpellsNS.OnInit[args[1]].currentSpell
        spell.deleteSpell()
    }
})