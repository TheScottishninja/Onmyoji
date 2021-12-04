class Turn {
    
    tokenId;
    name;
    attackType;
    reactors = {};
    attackName; // for weapons this is weaponName:attackName
    turnType;
    turnTarget;
    ongoingAttack = {};
    defenseCount = [];
    castSucceed = false;
    // conditions and statuses in here?
    statuses = []
    conditions = {}
    queuedAttack = false;
    remainingMove;
    remainingHS = 0;

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
                    // if("weaponName" in input[attr]){
                    //     log("Loading weapon...")
                    //     // ongoing attack is a weapon
                    //     var weapon = new Weapon(input[attr])

                    //     // do I need need to initialize
                    //     this.ongoingAttack = weapon
                    // }
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
        this.defenseCount = []
        
        // set remaining movement
        const charId = getCharFromToken(this.tokenId)
        this.remainingMove = getAttrByName(charId, "Move", "current") // need to change how move in sheet so that a number is returned
        log(this.remainingMove)
        token = getObj("graphic", this.tokenId)
        token.set("bar3_value", this.remainingMove)
        
        this.remainingHS = parseInt(getAttrByName(charId, "hsPerTurn", "current")) 

        // status damage
        var removeIndices = []
        this.moveList = []
        const allMarkers = JSON.parse(Campaign().get("token_markers"));
        var currentMarkers = []
        for (let i = 0; i < this.statuses.length; i++) {
            const status = this.statuses[i];
            log(status)

            // status effect with no attack
            if(!("attack" in status)){
                // do nothing since it's a mod
            }
            else if("range" in status.attack.currentAttack.targetType){
                // if range is in taretType, then need to target
                this.ongoingAttack = status.attack
                if(!_.isEmpty(this.reactors)){
                    // make attack after reactors
                    this.queuedAttack = true
                }
                else{
                    this.attack("", "", "target")
                }
            }
            else{
                // apply effects of the attack
                status.attack.outputs = {
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


        // reset attack targets (for toggle ability)
        this.ongoingAttack.currentAttack.targets = {}
    }

    // on end of turn
    async endTurn(){
        log("end turn")

        // remove counter status here
        var removeIndices = []
        for (let i = 0; i < this.statuses.length; i++) {
            var status = this.statuses[i];
            log(status)

            // check if status is Counter
            if("name" in status && status.name.includes("_counter-")){
                log("counter found in statuses")
                // reset the attribute
                let statusAttr = await getAttrObj(charId, status.name)
                statusAttr.set("current", 0)

                // remove status from list
                removeIndices.push(i)
                // var testArr = this.statuses
                // testArr.splice(i, 1)

                // remove from statusmarker
                var tokenObj = getObj("graphic", this.tokenId)
                log(tokenObj)
                var player_markers = tokenObj.get("statusmarkers").split(",")
                log(player_markers)
                for (let j = 0; j < player_markers.length; j++) {
                    const marker = player_markers[j];
                    if(marker.includes(status.icon)){
                        player_markers.splice(j, 1)
                        break;
                    }
                }
                tokenObj.set("statusmarkers", player_markers.join(","))
            }
        }

        // remove finished statuses
        // log(this.statuses)
        var testArr = this.statuses
        _.each(removeIndices, function(idx){
            testArr.splice(idx, 1)
        })

    }

    // alternate ability
    async ability(skillType, skillName){
        // for non-attack like skills

        // are these allows during stun?
        
        // add weapon/spell to turn first
        log("create weapon")
        if(_.isEmpty(this.ongoingAttack)){
            // initialize a new weapon
            sendChat("System", "No weapon equipped")

            // let weapon = new Weapon(this.tokenId)
            // await weapon.init(source)
            // this.ongoingAttack = weapon
            return
        }

        if(skillType == "toggle"){
            this.ongoingAttack.toggleAbility(skillName)

            //prevent from toggling again this turn
        }
    }

    // on cast/attack (AddTurnCasting) and targetting
    async attack(input1, input2, stage){
        log("main attack")

        // check if status prevents attack
        if("Stunned" in this.conditions){
            sendChat("System", this.name + " is stunned and cannot attack this turn!")
            return
        }

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
                // check if action has been used

                const attackType = input1
                const attackName = input2
                this.attackType = attackType
                this.attackName = attackName

                switch(attackType){
                    case "weapon":
                        log("create weapon")
                        const weaponName = attackName
                        if(_.isEmpty(this.ongoingAttack)){
                            sendChat("System", "No weapon equipped")
                        }
                        var result = this.ongoingAttack.setCurrentAttack(weaponName)
                                                
                        if(result){
                            await this.attack("", "", "target")
                        }
                    break;
                    
                    case "hand seal":
                        log("create hand seal spell")
                        var spell = new HandSealSpell(this.tokenId)
                        var result = await spell.init(attackName)

                        if(result){
                            this.ongoingAttack = spell
                            this.ongoingAttack.castSpell(this.tokenId)
                        }
                    break;

                    case "talisman":
                        log("create talisman spell")
                        var spell = new TalismanSpell(this.tokenId)
                        var result = await spell.init(attackName)
                        if(result){
                            this.ongoingAttack = spell
                            await this.ongoingAttack.scalingOptions()
                        }
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
                                if(!("bodyPart" in this.ongoingAttack.currentAttack.targetType) | this.ongoingAttack.type == "Projectile"){ //change weapontype to something more generic
                                    tokensString = tokensString + ".&#63;{" + targetInfo.desc[targetType] + " Body Part #" + (i+1).toString() + "|&#64;{target|" + targetInfo.desc[targetType] + " #" + (i+1).toString() + "|body_parts}}"
                                }                                  
                                else {
                                    tokensString = tokensString + "." + this.ongoingAttack.currentAttack.targetType.bodyPart
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
                if("shape" in targetInfo) {
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

                            // display the facing token for aiming
                            var facing = findObjs({_type: "graphic", name: this.tokenId + "_facing"})[0];
                            facing.set("layer", "objects")
        
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

                                // for move, need to put target in 
                                for(var effect in this.ongoingAttack.currentAttack.effects){
                                    if(effect.includes("move")){
                                        this.ongoingAttack.currentAttack.effects[effect]["x"] = x
                                        this.ongoingAttack.currentAttack.effects[effect]["y"] = y
                                    }
                                }

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

                            // display the facing token for aiming
                            var facing = findObjs({_type: "graphic", name: this.tokenId + "_facing"})[0];
                            facing.set("layer", "objects")
        
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

                // if spiritCost in attack, then consume applyDamage
                if("spiritCost" in this.ongoingAttack.currentAttack){
                    // should this be displayed?
                    applyDamage(this.tokenId, this.ongoingAttack.currentAttack.spiritCost, "Drain", "Torso", "0")
                    this.ongoingAttack.outputs["COST"] = this.ongoingAttack.currentAttack.spiritCost + " Spirit"
                }
                
                // run for reacting
                
                sendChat("System", targetString, null, {noarchive: true})
                break;
            
            case "defense":
                log("defense")

                //check for countering
                if(!_.isEmpty(this.reactors) && input1 == ""){
                    // prompt reactors to make their counter attack
                    // if there are no reactors, then continue
                    var countered = false
                    for(var reactor in this.reactors){
                        if(this.reactors[reactor].type == "Counter" || this.reactors[reactor].type == "Parry"){
                            this.reactors[reactor]["attackMade"] = false
                            WSendChat("System", reactor, "Make your counter attack against " + this.name)
                            countered = true
                        }
                    }
                    if(countered){
                        WSendChat("System", this.tokenId, "Wait for counter attacks to complete!")
                        return
                    }
                }
                else if(input1 == "counterComplete"){
                    // check if counter has cancelled out the attack
                    // attack must have damage? how to counter status spells then?
                    var code = this.ongoingAttack.currentAttack.effects.damage.code
                    var mods = getConditionMods(this.tokenId, code) // not sure if this code will always work
                    var modMag = this.ongoingAttack.magnitude + mods.rollCount
                    if(modMag <= 0){
                        // spell is canceled
                        sendChat("System", "**" + this.ongoingAttack.currentAttack.attackName + "** has be cancelled by counter attacks!")
                        removeTargeting(this.tokenId, this)
                        return
                    }
                }
                else{
                    WSendChat("System", this.tokenId, "Wait for targets to select defense actions!")
                }
        
                this.castSucceed = true
                // hide the facing token for aiming
                var facing = findObjs({_type: "graphic", name: this.tokenId + "_facing"})[0];
                if(facing){facing.set("layer", "gmlayer")}
                
                var tokens = this.ongoingAttack.currentAttack.targets
                log(tokens)
                
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

                        // get body part being targetted
                        const bodyPart = tokens[i].bodyPart
        
                        // sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)
                        WSendChat("System", token, "**Incoming attack to the " + bodyPart + "**<br>" + dodgeString + wardString + hitString)
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

                var attacked = false
                for(var target in this.ongoingAttack.currentAttack.targets){

                    // only apply effects if there is a primary target
                    if(this.ongoingAttack.currentAttack.targets[target].type == "primary" && "attack" in this.ongoingAttack.currentAttack.effects){
                        await this.ongoingAttack.applyEffects()
                        attacked = true
                        break
                    }
                    else if(this.ongoingAttack.currentAttack.targets[target].type == "primary"){
                        await this.ongoingAttack.applyEffects()
                        break
                    }
                }

                if(!attacked){
                    removeTargeting(this.tokenId, this)
                }
                // this.ongoingAttack.currentAttack = {}
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
                var range = this.ongoingAttack.currentAttack.targetType.range[target[0]]
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

            // move needs target token in case secondary dodges
            if("move" in this.ongoingAttack.currentAttack.effects && this.ongoingAttack.currentAttack.effects.move.target == target[0]){
                this.ongoingAttack.currentAttack.effects.move["token"] = target[1]
            }
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
                    var critThres = state.HandoutSpellsNS.coreValues.CritThres + getMods(charId, "215")[0].reduce((a, b) => a + b, 0)
                    var rollAdd = getMods(charId, "213")[0].reduce((a, b) => a + b, 0)
                    if(targetId in this.reactors && this.reactors[targetId].type == "Defense"){
                        dodgeDC -= state.HandoutSpellsNS.coreValues.FullDodge
                        critThres += getMods(charId, "235")[0].reduce((a, b) => a + b, 0)
                        rollAdd += getMods(charId, "233")[0].reduce((a, b) => a + b, 0)
                    }

                    // check if target body part is torso
                    if(!this.ongoingAttack.currentAttack.targets[i].bodyPart.includes("Torso")){
                        // reduced DC for attacks to extremities
                        var attackChar = getCharFromToken(this.tokenId)
                        var mod = getMods(attackChar, "13ZZ34")[0].reduce((a, b) => a + b, 0) // bonus when attacking extremeties
                        dodgeDC = dodgeDC - state.HandoutSpellsNS.coreValues.NonTorsoDodge + mod
                    }
                    log(dodgeDC)
                    
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
                            if(this.ongoingAttack.currentAttack.type != "Area"){
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
    
                log(this.defenseCount)
                if(this.defenseCount.includes(targetId)){
                    const idx = this.defenseCount.indexOf(targetId)
                    this.defenseCount.splice(idx, 1)
                }
                if(this.defenseCount.length < 1){
                    // all targets recieved
                    this.attack("", "", "effects")
                }
                return true;
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
        else {
            // hide the facing token for aiming
            var facing = findObjs({_type: "graphic", name: token.get("id") + "_facing"})[0];
            if(facing){facing.set("layer", "gmlayer")}
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
        
        removeTargeting(tokenId, testTurn)
        
        if(args.length > 2){
            targets = args[2]
            result = testTurn.parseTargets(targets.split(","), checkRange=true)
            if(result != ""){
                ranges = []
                for(var type in testTurn.ongoingAttack.currentAttack.targetType.range){
                    range = testTurn.ongoingAttack.currentAttack.targetType.range[type].toString()
                    if(range != "melee"){
                        ranges.push("**" + range + "ft** for " + type)
                    }
                    else {
                        ranges.push("**" + range + "** for " + type)
                    }
                }
                rangeString = ranges.join(" and ")
                WSendChat("System", tokenId, 'Target **' + result + "** is out of range. Max range: " + rangeString)
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

        testTurn = state.HandoutSpellsNS.currentTurn
        result = await testTurn.addHitType(targetId, hitType)
        if(result){
            sendChat("System", charName + " " + defenseType[hitType] + " the attack", null, {noarchive: true})
        }
    }

})