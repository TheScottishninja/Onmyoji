class HandSealSpell {
    tokenId;
    spellName = "Test";
    spellType;
    magnitude;
    currentAttack = {};
    currentEffect = {};
    tokenName = "";
    spellId = "";
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
        this.spellType = spellObj.spellType;
        this.magnitude = spellObj.magnitude;
        this.spellId = spellObj.spellId;
        this.currentAttack = spellObj.attacks.Base
        this.seals = spellObj.seals
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
        var currentTurn = state.HandoutSpellsNS.currentTurn
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
        let critMagObj = await getAttrObj(getCharFromToken(this.tokenId), "11ZZ1B_crit_mag") // must be caster
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

                var baseMag = this.magnitude
                var critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
                critMagObj.set("current", critMag)
                critString = "✅ Critical Spellcast!"
                state.HandoutSpellsNS.OnInit[obj.tokenId].conditions["critical"] = {"id": "B"}
                mods = getConditionMods(obj.tokenId, effect.code)

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
                setTimeout(function(){
                    currentTurn.attack("", "", "target")}, 250
                )
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
                setTimeout(function(){
                    currentTurn.attack("", "", "target")}, 250
                )
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
                return
            }
        }

        // continue button or continue next turn
        if(contCast != "" && this.currentSeal < this.seals.length){
            // continue casting this turn
            log("continue this turn")
            setTimeout(function(){
                sendChat("System", '!power --whisper|"' + charName + '" --!Seal|~C[Next Seal](!HSTest;;' + tokenId + ")~C")}, 250
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
    }
}

class TalismanSpell {
    tokenId;
    spellName = "Test";
    spellType;
    magnitude;
    currentAttack = {};
    currentEffect = {};
    tokenName = "";
    spellId = "";
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
        this.spellType = spellObj.spellType;
        this.magnitude = spellObj.magnitude;
        this.spellId = spellObj.spellId;
        this.currentAttack = spellObj.attacks.Base
        this.scalingCost = spellObj.scalingCost
        for(var type in spellObj.costs){
            this.costs[type] = spellObj.costs[type]
        }
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
            this.spellName + ";" + this.currentAttack.effects.damage.damageType + ";" + this.spellType + ";" + this.magnitude + ";" + optionString.join(";") + ";")
    }

    async castSpell(tokenId){
        log("castSpell")

        // consume talismans from caster (currentTurn)
        log(this.scale)

        // set scale condition if necessary

        // get mods

        // roll against cast DC

        // handle crits

        // check for bolster

        // start targetting
        
    }
}

var testSpell;

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(",,");

    if (msg.type == "api" && msg.content.indexOf("!CastTalisman") === 0) {
        log(args)

        // check if countering
        var spell;
        if(checkParry(msg)){
            spell = state.HandoutSpellsNS.OnInit[getTokenId(msg)].ongoingAttack
        }
        else{
            // get spell from ongoingAttack
            spell = state.HandoutSpellsNS.currentTurn.ongoingAttack
        }

        // set scaling based on argument
        spell.scale = parseInt(args[1])

        // make spell casting attempt
        spell.castSpell(getTokenId(msg))
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

        if(!checkTurn(msg)){
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

        testTurn = state.HandoutSpellsNS.currentTurn
        
        await testTurn.ongoingAttack.castSpell(args[1])
        log(testSpell.currentSeal)
    }

    if (msg.type == "api" && msg.content.indexOf("!TalismanOptions") === 0) {
        // move this into turn
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
})