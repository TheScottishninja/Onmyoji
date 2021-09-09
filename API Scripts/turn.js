class Turn {
    
    tokenId;
    name;
    attackType;
    reactors = {};
    attackName; // for weapons this is weaponName:attackName
    turnType;
    turnTarget;
    ongoingAttack;
    defenseCount = [];
    castSucceed = false;
    // conditions and statuses in here?
    statuses = []
    conditions = {}
    remainingMove;

    constructor(input){

        if(typeof input == "string"){
            // log("token constructor")
            this.tokenId = input
            this.name = getCharName(input)  
        }
        else if(typeof input == "object"){
            // log("object constructor")
            for(var attr in input){
                if(attr == "ongoingAttack"){
                    // load ongoingAttack from file
                    if("weaponName" in input[attr]){
                        log("Loading weapon...")
                        // ongoing attack is a weapon
                        var weapon = new Weapon(input[attr])
                        // do I need need to initialize
                        this.ongoingAttack = weapon
                    }
                }
                else if(attr == "statuses"){
                    var statusList = []
                    // setup all status attacks
                    log("Loading statuses...")
                    _.each(input[attr], function(status){
                        if("weaponName" in status.attack){
                            var weapon = new Weapon(status.attack)
                            var statusObj = status
                            statusObj.attack = weapon
                            statusList.push(statusObj)
                        }
                        else{
                            // apply effects of the attack
                            log("Unhandled status type")
                        }
                    })

                    this[attr] = statusList
                }
                else{
                    this[attr] = input[attr]
                }
            }
        }
        else {
            log("ERROR: unhandled constructor input")
        }
    }

    // on start of turn
    async startTurn(){
        log("start turn")
        this.castSucceed = false
        // status damage
        var removeIndices = []
        this.moveList = []
        const charId = getCharFromToken(this.tokenId)
        this.remainingMove = getAttrByName(charId, "Move", "current") // need to change how move in sheet so that a number is returned
        log(this.remainingMove)
        token = getObj("graphic", this.tokenId)
        token.set("bar3_value", this.remainingMove)
        const allMarkers = JSON.parse(Campaign().get("token_markers"));
        var currentMarkers = []
        for (let i = 0; i < this.statuses.length; i++) {
            const status = this.statuses[i];
            log(status)

            // if targetType is not empty, use attack
            if(!_.isEmpty(status.attack.currentAttack.targetType)){
                this.ongoingAttack = status.attack
                this.attack("", "", "target")
            }
            else{
                // apply effects of the attack
                status.attack.applyEffects()
            }

            // update remaining turns
            if("remainingTurns" in status && status.remainingTurns == 1){
                removeIndices.push(i)
                if("name" in status){
                    // reset the attribute
                    let statusAttr = await getAttrObj(charId, status.name)
                    statusAttr.set("current", 0)
                }
            }
            else if("remainingTurns" in status){
                // add icon with number
                status.remainingTurns -= 1
                for(marker in allMarkers){
                    if(allMarkers[marker].name == status.icon){
                        const markerString = allMarkers[marker].tag + "@" + status.remainingTurns.toString()
                        currentMarkers.push(markerString)
                        break;
                    }
                }
            }
            else{
                // add icon without number
                for(marker in allMarkers){
                    if(allMarkers[marker].name == status.icon){
                        const markerString = allMarkers[marker].tag
                        currentMarkers.push(markerString)
                        break;
                    }
                } 
            }
        
        }
        
        // apply status markers to token
        var token = getObj("graphic", this.tokenId)
        token.set("statusmarkers", currentMarkers.join(","))
        
        // remove finished statuses
        // log(this.statuses)
        var testArr = this.statuses
        _.each(removeIndices, function(idx){
            testArr.splice(idx, 1)
        })
    
        // reset dodge? -> still handled in autoInitiative

        // get reactors to select their actions
        setReactions(this.tokenId)

        // update stored class info
        storeClasses()

        // set conditions
        this.conditions = {"normal": {"id": "0"}}

        // reset ongoingAttacks?
        // this.ongoingAttack = {}
    }

    // on end of turn
    endTurn(){
        log("end turn")
        this.conditions = {}
    }

    // alternate ability
    async ability(source, skillType, skillName){
        // for non-attack like skills
        
        // add weapon/spell to turn first
        log("create weapon")
        if(_.isEmpty(this.ongoingAttack)){
            // initialize a new weapon
            let weapon = new Weapon(this.tokenId)
            await weapon.init(source)
            this.ongoingAttack = weapon
        }

        if(skillType == "toggle"){
            this.ongoingAttack.toggleAbility(skillName)

            //prevent from toggling again this turn
        }
    }

    // on cast/attack (AddTurnCasting) and targetting
    async attack(input1, input2, stage){
        log("main attack")

        // check that all reactors have selected their action
        var noAction = []
        for(var reactor in this.reactors){
            if(this.reactors[reactor].type == "Reaction"){
                var name = getCharName(reactor)
                noAction.push(name)
            }
        }

        // if reactors haven't selected action, prevent attack from starting
        if(noAction.length > 0){
            sendChat("System", '/w "' + this.name + '" Waiting for reaction selection from ' + noAction.join(", "))
            return
        }

        switch(stage) {
            case "":
                log("start casting")
                const attackType = input1
                const attackName = input2
                this.attackType = attackType
                this.attackName = attackName

                switch(attackType){
                    case "weapon":
                        log("create weapon")
                        const weaponName = attackName.split(":")
                        if(_.isEmpty(this.ongoingAttack)){
                            // initialize a new weapon
                            let weapon = new Weapon(this.tokenId)
                            await weapon.init(weaponName[0])
                            this.ongoingAttack = weapon
                        }
                        if(weaponName.length > 1){
                            this.ongoingAttack.setCurrentAttack(weaponName[1])
                        }
                        else{
                            this.ongoingAttack.makeBasicAttack()
                        }
                        
                        await this.attack("", "", "target")
                        break;
                }
                break;

            case "target":
                log("targetting")
                // get targets for attack

                // run countering function

                // run bolster function. Why is this here?\
                var targetInfo = this.ongoingAttack.currentAttack.targetType
                var targetString = ""
                if("tokens" in targetInfo){
                    // token targeting
                    log("token targeting")
                    targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!HandleDefense;;' + this.tokenId + ";;"
                    for(var targetType in targetInfo.tokens){
                        var count = targetInfo.tokens[targetType]
                        if(count == "self"){
                            targetString = targetString + targetType + "." + this.tokenId + ".Torso"
                        }
                        else if(count > 0){
                            var stringList = []
                            var partList = []
                            for (let i = 0; i < count; i++) {
                                var tokensString =  targetType + ".&#64;{target|" + targetInfo.desc[targetType] + " #" + (i+1).toString() + "|token_id}"
                                if(this.attackType == "weapon" | this.ongoingAttack.weaponType == "Projectile"){ //change weapontype to something more generic
                                    tokensString = tokensString + ".&#63;{Body Part #" + (i+1).toString() + "|&#64;{target|" + targetInfo.desc[targetType] + " #" + (i+1).toString() + "|body_parts}}"
                                }                                  
                                else {
                                    tokensString = tokensString + "." + this.ongoingAttack.currentAttack.bodyPart
                                }

                                stringList.push(tokensString)
                                // stringList.push(targetType + ".&#64;{target|" + targetInfo.desc[targetType] + " #" + (i+1).toString() + "|token_id}")
                                // partList.push("&#63;{Body Part #" + (i+1).toString() + "|&#64;{target|" + targetInfo.desc[targetType] + " #" + (i+1).toString() + "|body_parts}}")
                            }
                            
                            targetString += stringList.join(",")
                        }

                        targetString += ","
                    }

                    targetString += ")~C"

                }
                else {
                    // shape targeting
                    log("shape targetting")
                    if(targetInfo.shape.type == "radius"){
                        //------------------------------------ area casting -------------------------------------------
                        if(targetInfo.shape.source == "tile"){
                            // area casting with targeting rectical
                            var playerId = getPlayerFromToken(this.tokenId)
                            var token = getObj("graphic", this.tokenId)
                            var pageid = token.get("pageid")
                            var page = getObj("page", pageid)
                            var gridSize = 70 * parseFloat(page.get("snapping_increment"));
                            log("here")
                            //create rectical token
                            createObj("graphic", 
                            {
                                controlledby: playerId,
                                left: token.get("left") + gridSize,
                                top: token.get("top"),
                                width: gridSize,
                                height: gridSize,
                                name: this.tokenId + "_tempMarker",
                                pageid: pageid,
                                imgsrc: "https://s3.amazonaws.com/files.d20.io/images/187401034/AjTMrQLnUHLv9HWlwBQzjg/thumb.png?16087542345",
                                layer: "objects",
                                aura1_radius: targetInfo.shape.width,
                                showplayers_aura1: true,
                            });

                            var target = findObjs({_type: "graphic", name: this.tokenId + "_tempMarker"})[0];
                            toFront(target);
                            
                            var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Confirm](!HandleDefense;;' + this.tokenId + ")~C"

                            targetInfo.shape["targetToken"] = target.get("id")
                        }
                        else if(targetInfo.shape.source == "target"){
                            // casting radius around target
                            // create aura on target and prompt for confirmation
                            if(input1 == ""){
                                // target not yet selected
                                var targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!Retarget;;' + this.tokenId + ";;&#64;{target|token_id})~C"
                            }
                            else{
                                // input one is target token
                                targetInfo.shape["targetToken"] = input1
    
                                var distance = getRadiusRange(input1, this.tokenId)
                                var range = targetInfo.range
                                var unit = "ft"
                                if(range == "melee"){
                                    range = Math.sqrt(50)
                                    unit = ""
                                }
                                if(distance > range){
                                    var result = getCharName(input1);
                                    WSendChat("System", this.tokenId, 'Target **' + result + "** is out of range. Max range: **" + range + unit + "**")
                                    removeTargeting(this.tokenId, this)
                                    return;
                                }
                                var targets = getRadialTargets(this, input1)
                                this.parseTargets(targets)

                                var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Retarget](!Retarget;;' + this.tokenId + 
                                    ';;&#64;{target|token_id}) [Confirm](!HandleDefense;;' + this.tokenId + ")~C"
                            
                            }
                        }
                        else {
                            // casting radius around self
                            targetInfo.shape["targetToken"] = this.tokenId
                            // when to include self?
                            var targets = getRadialTargets(this, this.tokenId)
                            this.parseTargets(targets)
                            log(this.ongoingAttack.currentAttack.targets)

                            // message to confirm targets
                            // update this with attack macro on retarget
                            var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Confirm](!HandleDefense;;' + this.tokenId + ")~C"
                            
                        }
                    }
                    else if(targetInfo.shape.type == "cone"){
                        //------------------------------------ cone casting ------------------------------------------
                        if(targetInfo.shape.source == "tile"){
                            // direction token
                            var playerId = getPlayerFromToken(this.tokenId)
                            var token = getObj("graphic", this.tokenId)
                            var pageid = token.get("pageid")
                            var page = getObj("page", pageid)
                            var gridSize = 70 * parseFloat(page.get("snapping_increment"));
                            
                            //create rectical token
                            createObj("graphic", 
                            {
                                controlledby: playerId,
                                left: token.get("left") + gridSize,
                                top: token.get("top"),
                                width: gridSize,
                                height: gridSize,
                                name: this.tokenId + "_target_facing",
                                pageid: pageid,
                                imgsrc: "https://s3.amazonaws.com/files.d20.io/images/238043910/IzVPP4nx3tT2aDAFbEhB7w/thumb.png?16281180565",
                                layer: "objects",
                            });

                            var target = findObjs({_type: "graphic", name: this.tokenId + "_target_facing"})[0];
                            toFront(target);
                            
                            createCone(this, target.get("id"))
                            targetInfo.shape["targetToken"] = target.get("id")
                            var targets = getConeTargets(this, target.get("id"))
                            this.parseTargets(targets)

                            var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Confirm](!HandleDefense;;' + this.tokenId + ")~C"
                        }
                        else if(targetInfo.shape.source == "target"){
                            // will I ever use this?
                            // how to rotate?
                            // skip for now
                        }
                        else {
                            // cone source is self
                            createCone(this, this.tokenId)
                            targetInfo.shape["targetToken"] = this.tokenId
        
                            // get angluar targets (how to handle range)
                            var targets = getConeTargets(this, this.tokenId)
                            this.parseTargets(targets)
                            // print message
                            var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Confirm](!HandleDefense;;' + this.tokenId + ")~C"                  

                        }
                    }
                    else if(targetInfo.shape.type == "beam"){
                        // beam casting
                        if(targetInfo.shape.source == "tile"){
                            // beam comes from target and directed by rotation
                            var playerId = getPlayerFromToken(this.tokenId)
                            var token = getObj("graphic", this.tokenId)
                            var pageid = token.get("pageid")
                            var page = getObj("page", pageid)
                            var gridSize = 70 * parseFloat(page.get("snapping_increment"));
                            
                            //create rectical token
                            createObj("graphic", 
                            {
                                controlledby: playerId,
                                left: token.get("left"),
                                top: token.get("top") - gridSize,
                                width: gridSize,
                                height: gridSize,
                                name: this.tokenId + "_target_facing",
                                pageid: pageid,
                                imgsrc: "https://s3.amazonaws.com/files.d20.io/images/238043910/IzVPP4nx3tT2aDAFbEhB7w/thumb.png?16281180565",
                                layer: "objects",
                            });

                            var target = findObjs({_type: "graphic", name: this.tokenId + "_target_facing"})[0];
                            toFront(target);
                            
                            createBeam(this, target.get("id"))
                            targetInfo.shape["targetToken"] = target.get("id")
                            var targets = getBeamTargets(this, target.get("id"))
                            this.parseTargets(targets)

                            var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Confirm](!HandleDefense;;' + this.tokenId + ")~C"
                        }
                        else if(targetInfo.shape.source == "target"){
                            // draw beam from source to target
                            if(input1 == ""){
                                // target not yet selected
                                var targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!Retarget;;' + this.tokenId + ";;&#64;{target|token_id})~C"
                            }
                            else{
                                // input one is target token
                                
                                var distance = getRadiusRange(input1, this.tokenId)
                                var range = targetInfo.range
                                var unit = "ft"
                                if(range == "melee"){
                                    range = Math.sqrt(50)
                                    unit = ""
                                }
                                if(distance > range){
                                    var result = getCharName(input1);
                                    WSendChat("System", this.tokenId, 'Target **' + result + "** is out of range. Max range: **" + range + unit + "**")
                                    removeTargeting(this.tokenId, this)
                                    return;
                                }
                                
                                createBeam(this, this.tokenId)
                                targetInfo.shape["targetToken"] = this.tokenId
                                // change beam rotation to pass through target
                                var token = getObj("graphic", this.tokenId)
                                var target = getObj("graphic", input1)
                                var x = parseFloat(target.get("left")) - parseFloat(token.get("left"))
                                var y = parseFloat(target.get("top")) - parseFloat(token.get("top"))
                            
                                var angle = Math.atan2(y, x) * 180 / Math.PI
                                //angle = (angle + 450) % 360
                                angle += 90
                                if(angle > 180){
                                    angle = -(360 - angle)
                                }
                                path = getObj("path", targetInfo.shape.path)
                                path.set("rotation", angle)
                                changePath(path, {"layer": path.get("layer")})

                                var targets = getBeamTargets(this, this.tokenId)
                                this.parseTargets(targets)

                                var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Retarget](!Retarget;;' + this.tokenId + 
                                    ';;&#64;{target|token_id}) [Confirm](!HandleDefense;;' + this.tokenId + ")~C"
                            
                            }
                        }
                        else{
                            // draw beam from source directed by rotation
                            createBeam(this, this.tokenId)
                            targetInfo.shape["targetToken"] = this.tokenId
        
                            // get angluar targets (how to handle range)
                            var targets = getBeamTargets(this, this.tokenId)
                            this.parseTargets(targets)
                            // print message
                            var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Confirm](!HandleDefense;;' + this.tokenId + ")~C"

                        }
                    }
                    else {
                        log("ERROR: Unhandled target shape")
                        // unhandle target name
                    }
                }

                // run for reacting
                
                sendChat("System", targetString, null, {noarchive: true})
                break;
            
            case "defense":
                log("defense")

                //check for countering
        
                this.castSucceed = true
                
                var tokens = this.ongoingAttack.currentAttack.targets
                // log(tokens)
                
                var noDefense = [];
                for(var i in tokens){
                    
                    var token = tokens[i].token
                    // var target = tokens[token]
                    
                    // check if self or heal target. Don't need to get
                    if(token == this.tokenId || tokens[i].type == "heal"){
                        log("no defense")
                        noDefense.push(token)
                    }
                    else {
                        const remainingDodges = getAttrByName(getCharFromToken(token), "Dodges")
                        var followUp = false;
                        
                        // if followed ally succeeded attack, can't dodge
                        if(this.turnType == "Reaction"){
                            log("here")
                            const reactionType = state.HandoutSpellsNS.OnInit[this.turnTarget].reactors[this.tokenId].type
                            if(reactionType == "Follow"){
                                followUp = true
                            }
                        }
    
                        var dodgeString = "";
                        if(remainingDodges > 0 & !followUp) dodgeString = "[Dodge](!DefenseTest;;" + this.tokenId + ";;" + token + ";;1)"
        
                        const wardString = "[Ward](!DefenseTest;;" + this.tokenId + ";;" + token + ";;0)"
                        const hitString = "[Take Hit](!DefenseTest;;" + this.tokenId + ";;" + token + ";;2)"
        
                        // sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)
                        WSendChat("System", token, dodgeString + wardString + hitString)
                    }

                    this.defenseCount.push(token)
                }

                noDefense.forEach(tokenId => {
                    log("before add hit")
                    this.addHitType(tokenId, "0")
                });

                break;

            case "effects":
                log("apply effects")
                if(!_.isEmpty(this.ongoingAttack.currentAttack.targets)){
                    await this.ongoingAttack.applyEffects()

                }
                removeTargeting(this.tokenId, this)
                this.ongoingAttack.currentAttack = {}
                break;
        }
    }

    parseTargets(targetList, checkRange=false){
        this.ongoingAttack.currentAttack.targets = {}
        // remove any blanks from target results
        targetList = targetList.filter(function(el) {return el != ""})
        for(let i=0; i<targetList.length; i++){

            var target = targetList[i].split(".")
            log(target)
            // check range
            if(checkRange){
                var range = this.ongoingAttack.currentAttack.targetType.range
                if(range == "melee"){
                    // range to handle diagonals
                    range = Math.sqrt(50)
                }
                var source = this.tokenId
                if("shape" in this.ongoingAttack.currentAttack.targetType){
                    source = this.ongoingAttack.currentAttack.targetType.shape.targetToken
                }
                var distance = getRadiusRange(target[1], source)
                if(distance > range){
                    return getCharName(target[1]);
                }
            }
            this.ongoingAttack.currentAttack.targets[i] = {"token": target[1], "type": target[0],"bodyPart": target[2], "hitType": 0}
        }
        return "";
    }
    
    instanceTest(){
        log("I'm an instance of Turn")
    }
    
    // handle defenders responses
    async addHitType(targetId, hitType){
        log("add hit")
        
        // ensure target is actually a target
        for(var i in this.ongoingAttack.currentAttack.targets){
            log(i)
            if(targetId == this.ongoingAttack.currentAttack.targets[i].token){
                log("found")
                if(hitType == "1"){
                    // if hitType is 1, roll for dodge
                    // check for full dodge reaction
                    var dodgeDC = state.HandoutSpellsNS.coreValues.DodgeDC
                    const charId = getCharFromToken(targetId)
                    var critThres = state.HandoutSpellsNS.coreValues.CritThres + getMods(charId, "215")[0].reduce((a, b) => a + b, 0)
                    var rollAdd = getMods(charId, "213")[0].reduce((a, b) => a + b, 0)
                    if(targetId in this.reactors && this.reactors[targetId].type == "Defense"){
                        dodgeDC -= state.HandoutSpellsNS.coreValues.FullDodge
                        critThres += getMods(charId, "235")[0].reduce((a, b) => a + b, 0)
                        rollAdd += getMods(charId, "233")[0].reduce((a, b) => a + b, 0)
                    }

                    // decrement current dodge on char sheet
                    let dodgeObj = await getAttrObj(charId, "Dodges")
                    dodgeObj.set("current", parseInt(dodgeObj.get("current")) - 1)

                    // check if target body part is torso
                    if(!this.ongoingAttack.currentAttack.targets[i].bodyPart.includes("Torso")){
                        // reduced DC for attacks to extremities
                        attackChar = getCharFromToken(this.tokenId)
                        var mod = getMods(attackChar, "13ZZ34")[0].reduce((a, b) => a + b, 0) // bonus when attacking extremeties
                        dodgeDC = dodge - state.HandoutSpellsNS.coreValues.NonTorsoDodge + mod
                    }
                    
                    var roll = randomInteger(20)
                    var crit = 0
                    // get character's agility score
                    const agility = parseInt(getAttrByName(getCharFromToken(targetId), "Agility"))
                    if(roll >= critThres){
                        log("crit dodge")
                        crit = 1
                        // what to do with critical dodge
                        // auto succeed even on area
                        delete this.ongoingAttack.currentAttack.targets[i]
    
                    }
    
                    else {
                        if((roll + rollAdd + agility) >= dodgeDC){
                            // succeed in dodge
                            // remove from target list if not an area spell
                            if(this.ongoingAttack.currentAttack.weaponType != "Area"){
                                delete this.ongoingAttack.currentAttack.targets[i]
                            }
                            else{
                                this.ongoingAttack.currentAttack.targets[i]["hitType"] = hitType
                            }
                        }
                        else {
                            this.ongoingAttack.currentAttack.targets[i]["hitType"] = "0"
                        }
                    }
    
    
                    // display parameters
                    var name = getCharName(targetId)
                    
                    const replacements = {
                        "DEFENDER": name,
                        "AGILITY": agility,
                        "ROLL": roll,
                        "TOTAL": agility + roll + rollAdd,
                        "THRES": dodgeDC,
                        "MODS": rollAdd,
                        "CRIT": crit
                    }
    
                    // output message
                    let spellString = await getSpellString("DodgeRoll", replacements)
                    log(spellString)
                    sendChat(name, "!power" + spellString)
    
                }
                else {
                    this.ongoingAttack.currentAttack.targets[i]["hitType"] = hitType
                }
    
                
                if(this.defenseCount.includes(targetId)){
                    const idx = this.defenseCount.indexOf(targetId)
                    this.defenseCount.splice(idx, 1)
                }
                if(this.defenseCount.length < 1){
                    // all targets recieved
                    this.attack("", "", "effects")
                }
                return;
            }
        }
        log("token is not a target")
    }
}

function storeClasses(){
    // since state doesn't keep class instances, save state.HandoutSpellNS.OnInit into a handout
    let Handout = findObjs({_type:"handout", name:"ClassStore"})[0]
    Handout.set("notes", JSON.stringify(state.HandoutSpellsNS.OnInit))
}

function removeTargeting(tokenId, turn){
    // remove targetting display
    var allTokens = findObjs({
        _type: "graphic",
        _pageid: getObj("graphic", tokenId).get("pageid"),
        layer: "objects",
    });
    
    _.each(allTokens, function(token){
        token.set({
            tint_color: "transparent",
            aura1_radius: "",
            showplayers_aura1: false
        })
        if(token.get("name") == tokenId + "_tempMarker" | token.get("name") == tokenId + "_target_facing"){
            token.remove();
        }
    })

    if("shape" in turn.ongoingAttack.currentAttack.targetType){
        if("path" in turn.ongoingAttack.currentAttack.targetType.shape){
            cone = getObj("path", turn.ongoingAttack.currentAttack.targetType.shape.path)
            cone.remove()
            delete turn.ongoingAttack.currentAttack.targetType.shape.path
        }
    }
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(";;");

    if (msg.type == "api" && msg.content.indexOf("!HandleDefense") === 0) {
        log("handle defense")

        tokenId = args[1]
        testTurn = state.HandoutSpellsNS.currentTurn
        // bodyPart = args[3]
        
        // removeTargeting(tokenId, testTurn)
        
        if(args.length > 2){
            targets = args[2]
            result = testTurn.parseTargets(targets.split(","), checkRange=true)
            if(result != ""){
                range = testTurn.ongoingAttack.currentAttack.targetType.range.toString()
                if(range != "melee"){
                    range += "ft"
                }
                WSendChat("System", tokenId, 'Target **' + result + "** is out of range. Max range: **" + range + "**")
                return;
            }
        }
        testTurn.attack("", "", "defense")
    }

    if (msg.type == "api" && msg.content.indexOf("!Retarget") === 0) {
        log("retarget")
        tokenId = args[1]
        targetId = args[2]

        testTurn = state.HandoutSpellsNS.currentTurn
        removeTargeting(tokenId, testTurn)
        testTurn.attack(targetId, "", "target")
    }

    if (msg.type == "api" && msg.content.indexOf("!DefenseTest") === 0) {
        log("defend")

        defenseType = {
            "0": "wards",
            "1": "attempts to dodge",
            "2": "takes"
        }
        tokenId = args[1]
        targetId = args[2]
        hitType = args[3]
        charName = getCharName(targetId)

        sendChat("System", charName + " " + defenseType[hitType] + " the attack", null, {noarchive: true})
        testTurn = state.HandoutSpellsNS.currentTurn
        testTurn.addHitType(targetId, hitType)
    }

})