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
                        targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!HandleDefense;;' + this.tokenId
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
                                
                                targetString += ";;" + stringList.join(",") + ")~C"
                            }
                        }

                    }
                    else {
                        // shape targeting
                        log("shape targetting")
                        if(targetInfo.shape.type == "radius"){
                            // area casting
                            if(targetInfo.shape.source == "tile"){
                                // area casting with targeting rectical
                            }
                            else if(targetInfo.shape.source == "target"){
                                // casting radius around target
                                // create aura on target and prompt for confirmation
                            }
                            else {
                                // casting radius around self
                                // when to include self?
                                var targets = getRadialTargets(this, this.tokenId, targetInfo.includeSource)
                                this.parseTargets(targets)
                                log(this.ongoingAttack.currentAttack.targets)

                                // message to confirm targets
                                // update this with attack macro on retarget
                                var targetString = '!power --whisper|"' + this.name + '" --Confirm targeting| --!target|~C[Confirm](!HandleDefense;;' + this.tokenId + ")~C"
                                
                                targetInfo.shape["targetToken"] = this.tokenId
                            }
                        }
                        else if(targetInfo.shape.type == "cone"){
                            // cone casting
                        }
                        else if(targetInfo.shape.type == "beam"){
                            // beam casting
                        }
                        else {
                            // unhandle target name
                        }
                    }
                    
                    // if(this.ongoingAttack.currentAttack.targetType == "Self"){  
                    //     this.ongoingAttack.currentAttack.targets[this.tokenId] = {"bodyPart": "torso", "hitType": 0}
                        
                    //     // apply effect to self
                    //     this.ongoingattack.applyEffects()
                    // }
                    
                    // var bodyPart = ""
                    // if(this.attackType == "weapon" | this.ongoingAttack.weaponType == "Projectile"){ // change weaponType to something more generic
                    //     bodyPart = "&#63;{Target Body Part|&#64;{target|body_parts}}"
                    // }
                    // else {
                    //     bodyPart = this.ongoingAttack.currentAttack.bodyPart
                    // }
                    
                    // var targetString = "";
                    // if(this.ongoingAttack.weaponType == "Spirit Flow"){
                    //     targets = this.ongoingAttack.currentAttack.targetType.split(",")
                    //     // 0 - heal, 1 - drain
                    //     if(targets[0].includes("Multi")){
                    //         // number is after space
                    //         numTargets = parseInt(targets[0].split(" ")[1])
                    //         healString = []
                    //         for (var i = 1; i <= numTargets; i++) {
                    //             healString.push("&#64;{target|Select heal target #" + i.toString() + "|token_id}")
                    //             log(healString)
                    //         }
                    //         healString = healString.join(",")
                    //     }
                    //     else if(targets[0].includes("Self")){
                    //         healString = tokenId
                    //     }
                    //     else {
                    //         // single target
                    //         healString = "&#64;{target|Select heal target|token_id}"
                    //     }  

                    //     if(targets.length > 1){
                    //         if(targets[1].includes("Multi")){
                    //             // number is after space
                    //             numTargets = parseInt(targets[1].split(" ")[1])
                    //             attackString = []
                    //             for (var i = 1; i <= numTargets; i++) {
                    //                 attackString.push("&#64;{target|Select attack target #" + i.toString() + "|token_id}")
                    //             }
                    //             attackString = attackString.join(",")
                    //         }
                    //         else if(targets[1].includes("Self")){
                    //             attackString = tokenId
                    //         }
                    //         else {
                    //             // single target
                    //             attackString = "&#64;{target|Select attack target|token_id}"
                    //         }
                    //     }
                    //     else {
                    //         attackString = ""
                    //     }

                    //     targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!FlowTarget;;' + this.tokenId + ";;" + attackString + ";;" + healString + ")~C"
                    //     log(targetString)
                    // }

                    // else if(this.ongoingAttack.currentAttack.targetType.includes("Radius")) {
                    //     // spell effect area
                    //     targetString = '!AreaTarget;;' + this.tokenId + ";;" + bodyPart
                    // }
                    // else if(this.ongoingAttack.currentAttack.targetType.includes("Single")) {
                    //     // spell effect single target
                    //     targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!HandleDefense;;' + this.tokenId + ";;&#64;{target|token_id};;" + bodyPart + ")~C"
                    // }
                    // else if(this.ongoingAttack.currentAttack.targetType.includes("Line")){
                    //     // spell effect line
                    //     lineTarget(tokenId)
                    //     targetString = '!power --whisper|"' + this.name + '" --Use Polyline draw tool to draw spell shape.| --!cast|~C[Cast Spell](!CastLine;;' + this.tokenId + ")~C"
                    // }
                    // else {
                    //     log("unhandled target type")
                    //     return;
                    // }

                    // log(targetString) 

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

                    this.ongoingAttack.currentAttack = {}
                    break;
            }
        }

        parseTargets(targetList){
            this.ongoingAttack.currentAttack.targets = {}
            for(let i=0; i<targetList.length; i++){
    
                var target = targetList[i].split(".")
                this.ongoingAttack.currentAttack.targets[target[1]] = {"type": target[0],"bodyPart": target[2], "hitType": 0}
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
            // targets = args[2]
            // bodyPart = args[3]

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
            })

            testTurn = state.HandoutSpellsNS.currentTurn
            testTurn.attack("", "", "defense")
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