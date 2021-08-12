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

        constructor(tokenId){
            this.tokenId = tokenId
            this.name = getCharName(tokenId)

            
        }

        // on start of turn
        async startTurn(){
            // status damage
            var removeIndices = []
            const allMarkers = JSON.parse(Campaign().get("token_markers"));
            var currentMarkers = []
            for (let i = 0; i < this.statuses.length; i++) {
                const status = this.statuses[i];
                
                // deal damage
                // add hanlding for mods!!
                const damage = status.damageTurn * status.magnitude
                await applyDamage(this.tokenId, damage, status.damageType, status.bodyPart, 0)

                // output damage display?

                // update remaining turns
                if(status.remainingTurns == 1){
                    removeIndices.push(i)
                }
                else{
                    status.remainingTurns -= 1
                    for(marker in allMarkers){
                        if(allMarkers[marker].name == status.icon){
                            const markerString = allMarkers[marker].tag + "@" + status.remainingTurns.toString()
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
        
            // reset dodge?

            // get reactors to select their actions
            setReactions(this.tokenId)
        }
            

        // on end of turn

        // prompt reactors and prevent action until reactors are ready

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
                            let weapon = new Weapon(this.tokenId)
                            const weaponName = attackName.split(":")
                            await weapon.init(weaponName[0])
                            weapon.setCurrentAttack(weaponName[1])
                            this.ongoingAttack = weapon
                            
                            await this.attack("", "", "target")
                            break;
                    }
                    break;

                case "target":
                    log("targetting")
                    // get targets for attack
                    this.castSucceed = true

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
                                targetString = targetString + ";;" + this.tokenId
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
                                
                                targetString += stringList.join(",") + ")~C"
                            }
                        }

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

                    // parse targets from input
                    // targets in 
                    // var tokens = input1.split(",")
                    // var bodyPart = input2.split(",")

                    // log(tokens)
                    // log(bodyPart)
                    var tokens = this.ongoingAttack.currentAttack.targets

                    for(var token in tokens){
    
                        // var target = tokens[token]
                        
                        // log(target)
        
                        const remainingDodges = getAttrByName(getCharFromToken(token), "Dodges")
                        var followUp = false;

                        // if followed ally succeeded attack, can't dodge
                        // how to check if ally succeeded?
                        if(this.turnType == "Follow"){
                            followUp = true;
                        }
        
                        var dodgeString = "";
                        if(remainingDodges > 0 & !followUp) dodgeString = "[Dodge](!DefendTest;;" + this.tokenId + ";;" + token + ";;1)"
        
                        const wardString = "[Ward](!DefenseTest;;" + this.tokenId + ";;" + token + ";;0)"
                        const hitString = "[Take Hit](!DefenseTest;;" + this.tokenId + ";;" + token + ";;2)"
        
                        // sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)
                        WSendChat("System", token, dodgeString + wardString + hitString)

                        this.defenseCount.push(token)
                    }

                    break;

                case "effects":
                    log("apply effects")
                    await this.ongoingAttack.applyEffects()

                    removeTargeting(this.tokenId, this)
                    this.ongoingAttack.currentAttack = {}
                    break;
            }
        }

        parseTargets(targetList, checkRange=false){
            this.ongoingAttack.currentAttack.targets = {}
            for(let i=0; i<targetList.length; i++){
    
                var target = targetList[i].split(".")
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
                this.ongoingAttack.currentAttack.targets[target[1]] = {"type": target[0],"bodyPart": target[2], "hitType": 0}
            }
            return "";
        }

        // handle defenders responses
        addHitType(targetId, hitType){
            log("add hit")

            // ensure target is actually a target
            if(targetId in this.ongoingAttack.currentAttack.targets){
                // if hitType is 1, roll for dodge


                if(hitType == 1 & this.ongoingAttack.currentAttack.weaponType == "Area"){
                    delete this.ongoingAttack.currentAttack.targets[targetId]
                }
                else {
                    this.ongoingAttack.currentAttack.targets[targetId]["hitType"] = hitType
                }
                
                if(this.defenseCount.includes(targetId)){
                    const idx = this.defenseCount.indexOf(targetId)
                    this.defenseCount.splice(idx, 1)
                }
                if(this.defenseCount.length < 1){
                    // all targets recieved
                    this.attack("", "", "effects")
                }
            }
            else {
                log("token is not a target")
            }

        }
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

            tokenId = args[1]
            targetId = args[2]
            hitType = args[3]

            testTurn = state.HandoutSpellsNS.currentTurn
            testTurn.addHitType(targetId, hitType)
        }

    })