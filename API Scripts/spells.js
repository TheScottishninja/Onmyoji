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
        // log(weaponObj)

        this.spellName = spellObj.spellName;
        this.spellType = spellObj.spellType;
        this.magnitude = spellObj.magnitude;
        this.spellId = spellObj.spellId;
        this.currentAttack = spellObj.attack
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
        var hsPerTurn = castingTurn.remainingHS
        var contCast = ""

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
                hsPerTurn -= 1
                this.currentSeal += 2
            }
            else{
                // update current seal
                critString = "✅ Reduce Seals by 1"
                this.currentSeal += 2

                // decrement hand seals per turn
                hsPerTurn -= 1
                
                // check if casting can continue
                if(hsPerTurn > 0){
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
            var charName = getCharName(tokenId)
            sendChat(charName, "!power " + spellString)

            // check for cast complete
            if(this.currentSeal >= (this.seals.length - 1)){
                log("seal cast complete")
                currentTurn.attack("", "", "target")
                return
            }
        }
        else if(roll + mods.rollAdd >= state.HandoutSpellsNS.coreValues.HandSealDC){
            log("success")
    
            // update current seal
            this.currentSeal += 1

            // decrement hand seals per turn
            hsPerTurn -= 1
            
            // check if casting can continue
            if(hsPerTurn > 0){
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
            var charName = getCharName(tokenId)
            sendChat(charName, "!power " + spellString)    

            // check for cast complete
            if(this.currentSeal >= (this.seals.length - 1)){
                log("seal cast complete")
                currentTurn.attack("", "", "target")
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
            var charName = getCharName(tokenId)
            sendChat(charName, "!power " + spellString)    

            if(contCast == ""){
                // failed with no bolster, spell fails
                log("spell failed")
                return
            }
        }

        // continue button or continue next turn
        if(contCast != "" && this.currentSeal < (this.seals.length - 1)){
            // continue casting this turn
            log("continue this turn")
        }
        else{
            // continue casting next turn
            log("continue next turn")
        }
    }
}

var testSpell;

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(";;");

    if (msg.type == "api" && msg.content.indexOf("!HSInit") === 0) {
        log(args)

        testSpell = new HandSealSpell(args[1])
        testSpell.seals = [{name:"Seal1"}, {name:"Seal2"}, {name:"Seal3"}]
        testSpell.magnitude = 1

    }

    if (msg.type == "api" && msg.content.indexOf("!HSTest") === 0) {
        log(args)

        await testSpell.castSpell(args[1])
        log(testSpell.currentSeal)
    }
})