class Turn {
    tokenId;
    name;
    attackType;
    reactors;
    attackName; // for weapons this is weaponName:attackName
    turnType;
    ongoingAttack;
    defenseCount = 0;
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
        switch(stage) {
            case "":
            // start casting 
            attackType = input1
            attackName = input2
            this.attackType = attackType
            this.attackName = attackName

            switch(attackType){
                case "weapon":
                    // create weapon
                    let weapon = new Weapon(this.tokenId)
                    await weapon.init(attackName.split(":")[0])
                    weapon.setCurrentAttack(attackName.split(":")[1])
                    this.ongoingAttack = weapon
                    
                    this.attack(attackType, attackName, "target")
                    break;
            }
                break;

            case "target":
                // get targets for attack

                // run countering function

                // run bolster function

                if(this.attack.currentAttack.targetType == "Self"){
                    this.attack.currentAttack.targets = [this.tokenId]
                    this.attack.currentAttack.targets = ["torse"]
                    this.attack.currentAttack.hitType = [0]
                    
                    // apply effect to self
                    this.attack.applyEffects()
                }

                if(this.attackType == "weapon" | this.attack.weaponType){ // change weaponType to something more generic
                    bodyPart = "&#63;{Target Body Part|&#64;{target|body_parts}}";
                }
                else {
                    bodyPart = this.attack.currentAttack.bodyPart
                }

                var targetString = "";
                if(this.attack.weaponType == "Spirit Flow"){
                    targets = this.attack.currentAttack.targetType.split(",")
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

                else if(this.attack.currentAttack.targetType.includes("Radius")) {
                    // spell effect area
                    targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!AreaTarget;;' + this.tokenId + ";;" + bodyPart + ")~C"
                }
                else if(this.attack.currentAttack.targetType.includes("Single")) {
                    // spell effect single target
                    targetString = '!power --whisper|"' + this.name + '" --!target|~C[Select Target](!DefenseAction;;' + this.tokenId + ";;&#64;{target|token_id};;" + bodyPart + ")~C"
                }
                else if(this.attack.currentAttack.targetType.includes("Line")){
                    // spell effect line
                    lineTarget(tokenId)
                    targetString = '!power --whisper|"' + this.name + '" --Use Polyline draw tool to draw spell shape.| --!cast|~C[Cast Spell](!CastLine;;' + this.tokenId + ")~C"
                }
                else {
                    log("unhandled target type")
                    return;
                }

                log(state.HandoutSpellsNS.OnInit) 

                // run for reacting
                
                sendChat("System", targetString, null, {noarchive: true})
                break;
            
            case "defense":
                // parse targets from input
                tokens = input1.split(",")
                bodyPart = input2.split(",")

                this.attack.currentAttack.targets = tokens
                this.attack.currentAttack.bodyPart = bodyPart
                this.attack.currentAttack.hitType = Array(tokens.length).fill(0)

                _.each(tokens, function(token){
    
                    remainingDodges = getAttrByName(getCharFromToken(defenderId), "Dodges")
                    var followUp = false;

                    // if followed ally succeeded attack, can't dodge
                    // how to check if ally succeeded?
                    if(this.turnType == "Follow"){
                        followUp = true;
                    }
    
                    dodgeString = "";
                    if(remainingDodges > 0 & !followUp) dodgeString = "[Dodge](!Dodge;;" + this.tokenId + ";;" + token + ";;" + dodgeHit + ")"
    
                    wardString = "[Ward](!Ward;;" + this.tokenId + ";;" + token + ")"
                    hitString = "[Take Hit](!TakeHit;;" + this.tokenId + ";;" + token + ")"
    
                    // sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)
                    WSendChat("System", token, dodgeString + wardString + hitString)
                })
                this.defenseCount = 0;

                break;

            case "effects":

                break;
        }
    }

    // handle defenders responses
    addHitType(targetId, hitType){
        idx = this.attack.currentAttack.targets.indexOf(targetId)
        this.attack.currentAttack.hitType[idx] = hitType

        this.defenseCount += 1
        if(this.defenseCount == targets.length){
            
        }
    }
}