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

        this.spellName = spellObj.spellName;
        this.type = spellObj.spellType;
        this.magnitude = spellObj.magnitude;
        this.id = spellObj.spellId;
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
                setCrit(this)
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
                "DAMAGE": "",
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
                setTimeout(function(){
                    state.HandoutSpellsNS.currentTurn.attack("", "", "effects")}, 250
                )
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
                "DAMAGE": "",
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
        }

    }

    async dismissSpell(){
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
        
        // output result
        // const replacements = {
        // }
        
        // let spellString = await getSpellString("TalismanCast", replacements)
        sendChat("System", "**" + this.spellName + "** has been removed from " + names.join(", "))

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
        else if(!(['Exorcism', 'Binding', 'Stealth'].includes(this.type))){
            // if spell is not channel, clear currentSpell
            state.HandoutSpellsNS.OnInit[this.tokenId].currentSpell = {}
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

        this.spellName = spellObj.spellName;
        this.type = spellObj.spellType;
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
            this.spellName + ";" + this.currentAttack.effects.damage.damageType + ";" + this.type + ";" + this.magnitude + ";" + optionString.join(";") + ";")
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
                "DAMAGE": this.currentAttack.effects.damage.damageType,
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
                "DAMAGE": this.currentAttack.effects.damage.damageType,
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
        }

        // output result
        const replacements = {
            "SPELL": this.spellName,
            "TYPE": this.type,
            "DAMAGE": this.currentAttack.effects.damage.damageType,
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

    async dismissSpell(){
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
            "DAMAGE": this.currentAttack.effects.damage.damageType,
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

        // get outcome string
        var outcome = state.HandoutSpellsNS.Random.ChannelStrings[result]

        // move spell into static effects

        // send GM outcome with effect button
        sendChat("System", "/w GM " + outcome)
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

        // set scaling based on argument
        if(args.length > 1){
            spell.scale = parseInt(args[1])
        }

        // make spell casting attempt
        await spell.castSpell(getTokenId(msg))
    }
})

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

        testTurn.currentSpell.dismissSpell()
    }
})