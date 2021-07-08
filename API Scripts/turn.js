    class Turn {
        tokenId;
        name;
        attackType;
        reactors;
        attackName; // for weapons this is weaponName:attackName
        turnType;
        turnTarget;
        ongoingAttack;
        defenseCount = [];
        castSucceed = false;
        // conditions and statuses in here?

        constructor(tokenId){
            this.tokenId = tokenId
            this.name = getCharName(tokenId)

            
        }

        // on start of turn

        // on end of turn

        // prompt reactors and prevent action until reactors are ready

        // on cast/attack (AddTurnCasting) and targetting
        async attack(input1, input2, stage){
            log("main attack")
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
                            
                            await this.attack(attackType, attackName, "target")
                            break;
                    }
                    break;

                case "target":
                    log("targetting")
                    // get targets for attack
                    this.castSucceed = true

                    // run countering function

                    // run bolster function
                    
                    if(this.ongoingAttack.currentAttack.targetType == "Self"){  
                        this.ongoingAttack.currentAttack.targets[this.tokenId] = {"bodyPart": "torso", "hitType": 0}
                        
                        // apply effect to self
                        this.ongoingattack.applyEffects()
                    }
                    
                    var bodyPart = ""
                    if(this.attackType == "weapon" | this.ongoingAttack.weaponType == "Projectile"){ // change weaponType to something more generic
                        bodyPart = "&#63;{Target Body Part|&#64;{target|body_parts}}"
                    }
                    else {
                        bodyPart = this.ongoingAttack.currentAttack.bodyPart
                    }
                    
                    var targetString = "";
                    if(this.ongoingAttack.weaponType == "Spirit Flow"){
                        targets = this.ongoingAttack.currentAttack.targetType.split(",")
                        // 0 - heal, 1 - drain
                        if(targets[0].includes("Multi")){
                            // number is after space
                            numTargets = parseInt(targets[0].split(" ")[1])
                            healString = []
                            for (var i = 1; i <= numTargets; i++) {
                                healString.push("&#64;{target|Select heal target #" + i.toString() + "|token_id}")
                                log(healString)
                            }
                            healString = healString.join(",")
                        }
                        else if(targets[0].includes("Self")){
                            healString = tokenId
                        }
                        else {
                            // single target
                            healString = "&#64;{target|Select heal target|token_id}"
                        }  

                        if(targets.length > 1){
                            if(targets[1].includes("Multi")){
                                // number is after space
                                numTargets = parseInt(targets[1].split(" ")[1])
                                attackString = []
                                for (var i = 1; i <= numTargets; i++) {
                                    attackString.push("&#64;{target|Select attack target #" + i.toString() + "|token_id}")
                                }
                                attackString = attackString.join(",")
                            }
                            else if(targets[1].includes("Self")){
                                attackString = tokenId
                            }
                            else {
                                // single target
                                attackString = "&#64;{target|Select attack target|token_id}"
                            }
                        }
                        else {
                            attackString = ""
                        }

                        targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!FlowTarget;;' + this.tokenId + ";;" + attackString + ";;" + healString + ")~C"
                        log(targetString)
                    }

                    else if(this.ongoingAttack.currentAttack.targetType.includes("Radius")) {
                        // spell effect area
                        targetString = '!AreaTarget;;' + this.tokenId + ";;" + bodyPart
                    }
                    else if(this.ongoingAttack.currentAttack.targetType.includes("Single")) {
                        // spell effect single target
                        targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!HandleDefense;;' + this.tokenId + ";;&#64;{target|token_id};;" + bodyPart + ")~C"
                    }
                    else if(this.ongoingAttack.currentAttack.targetType.includes("Line")){
                        // spell effect line
                        lineTarget(tokenId)
                        targetString = '!power --whisper|"' + this.name + '" --Use Polyline draw tool to draw spell shape.| --!cast|~C[Cast Spell](!CastLine;;' + this.tokenId + ")~C"
                    }
                    else {
                        log("unhandled target type")
                        return;
                    }

                    // log(targetString) 

                    // run for reacting
                    
                    sendChat("System", targetString, null, {noarchive: true})
                    break;
                
                case "defense":
                    log("defense")

                    // parse targets from input
                    const tokens = input1.split(",")
                    const bodyParts = input2.split(",")

                    log(tokens)
                    log(bodyParts)

                    for(i=0; i<tokens.length; i++){
                        
                        this.ongoingAttack.currentAttack.targets[tokens[i]] = {"bodyPart": bodyParts[i], "hitType": 0}
        
                        const remainingDodges = getAttrByName(getCharFromToken(tokens[i]), "Dodges")
                        var followUp = false;

                        // if followed ally succeeded attack, can't dodge
                        // how to check if ally succeeded?
                        if(this.turnType == "Follow"){
                            followUp = true;
                        }
        
                        var dodgeString = "";
                        if(remainingDodges > 0 & !followUp) dodgeString = "[Dodge](!DefendTest;;" + this.tokenId + ";;" + tokens[i] + ";;1)"
        
                        const wardString = "[Ward](!DefenseTest;;" + this.tokenId + ";;" + tokens[i] + ";;0)"
                        const hitString = "[Take Hit](!DefenseTest;;" + this.tokenId + ";;" + tokens[i] + ";;2)"
        
                        // sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)
                        WSendChat("System", tokens[i], dodgeString + wardString + hitString)

                        this.defenseCount.push(tokens[i])
                    }

                    break;

                case "effects":
                    log("apply effects")
                    await this.ongoingAttack.applyEffects()
                    break;
            }
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

    on("chat:message", async function(msg) {   
        'use string';
        
        if('api' !== msg.type) {
            return;
        }
        var args = msg.content.split(";;");

        if (msg.type == "api" && msg.content.indexOf("!HandleDefense") === 0) {
            log("handle defense")

            tokenId = args[1]
            targetId = args[2]
            bodyPart = args[3]

            testTurn = state.HandoutSpellsNS.turnActions[tokenId].weapon
            testTurn.attack(targetId, bodyPart, "defense")
        }

        if (msg.type == "api" && msg.content.indexOf("!DefenseTest") === 0) {
            log("defend")

            tokenId = args[1]
            targetId = args[2]
            hitType = args[3]

            testTurn = state.HandoutSpellsNS.turnActions[tokenId].weapon
            testTurn.addHitType(targetId, hitType)
        }
    })