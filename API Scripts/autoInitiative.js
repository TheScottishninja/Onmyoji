var Combat_Begins = Combat_Begins || {};

Combat_Begins.statName = new Array ("Agility"); //Stats to be added to roll, commas between values
Combat_Begins.rollValue = 20; //rolling 1d20, change if you roll 1dXX
Combat_Begins.sendChat = true; //True if you want the chat log to show their results
Combat_Begins.includeChars = true; //set false if you want to roll for players

state.HandoutSpellsNS.TurnOrder = [];
var FirstTurn = true;
var EndTurn = false;

function getRollResult(msg) {
    log("Obtaining roll result...")
    if(_.has(msg,'inlinerolls')){
        msg.content = _.chain(msg.inlinerolls)
            .reduce(function(m,v,k){
                m['$[['+k+']]']=v.results.total || 0;
                return m;
            },{})
            .reduce(function(m,v,k){
                return m.replace(k,v);
            },msg.content)
            .value();
        
	//removes all non-numerical characters and returns result
        return msg.content.replace(/\D/g,'');
    }
}

function containsObject(obj, list) {
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i] === obj) {
            return true;
        }
    }

    return false;
}

function getInitRoll(id, sources){
    var roll = 0;
   _.each(state.HandoutSpellsNS.TurnOrder, function(token) {
      if (token.id === id){
        if (typeof token.pr === "number"){
            
            roll = token.pr;
        }
        else if (containsObject(token.pr, sources)) {
            roll = 0;
        }
        else {
            sources.push(token.id);
            roll = getInitRoll(token.pr, sources);
        }
      } 

    });
    return roll;
    
}

function getCharName(token_id){
    var obj = getObj("graphic", token_id);
    var currChar = getObj("character", obj.get("represents")) || "";
    if (currChar.lenght != 0) {
        return currChar.get("name");
    }
    else {
        return obj.get("name");
    }
    
}

function getCharFromToken(tokenId){
    var obj = getObj("graphic", tokenId);
    var currChar = getObj("character", obj.get("represents")) || "";
    if(currChar != "") {var charID = currChar.get("_id");}
    else {var charID = ""}
    return charID;
}

async function resetDodge(charId){
    let dodge = await getAttrObj(charId, "Dodges")
    dodge.set("current", dodge.get("max"));
}

function statusChange(tokenId){
    var targetObj = getObj("graphic", tokenId);
    currentStatus = targetObj.get("statusmarkers").split(",")
    newStatus = [];
    var updateState = {};
    for(var status in state.HandoutSpellsNS.turnActions[tokenId].statuses) {
        statusId = status.substring(0, status.indexOf("_"))
        statusId = statusId.split("@")
        instance = status.substring(status.indexOf("_") + 1, status.length)
        var statusNum = parseInt(statusId[1]);
        if ((statusNum - 1) >= 1){
            // update the identifier of the spell in replacements
            var identifier = statusId[0] + "@" + statusNum.toString() + "_" + instance + "_" + charId + ":";
            charId = getCharFromToken(tokenId)
            statusNum = statusNum - 1
            newString = statusId[0] + "@" + statusNum.toString() + "_" + instance
            replaceHandout = findObjs({_type:"handout", name:"PowerCard Replacements"})[0]
            log(replaceHandout)
            replaceHandout.get("notes", function(currentNotes){
                startIdx = currentNotes.indexOf(identifier)
                if(startIdx == -1){
                    log("ERROR: There should be a replacement for " + identifier)
                }
                else{
                    log("update replacement")
                    infoString = currentNotes.substring(startIdx, currentNotes.indexOf("</p>", startIdx))
                    infoString = infoString.replace(identifier, newString + "_" + charId + ":")
                    replaceHandout.set("notes", beforeString + infoString + afterString);
                }
                log("Updated " + newString + "_" + charId + ":" + " in Replacement")
            });

            updateState[newString] = state.HandoutSpellsNS.turnActions[tokenId].statuses[status];
            newStatus.push(statusId[0] + "@" + statusNum.toString());            
        }
        else{
            // functions to remove status spell replacement
            charId = getCharFromToken(tokenId)
            identifier = statusId[0] + "@" + statusNum.toString() + "_" + instance + "_" + charId;
            deleteReplacement(identifier)
        }
    }
    //update the keys in state
    state.HandoutSpellsNS.turnActions[tokenId].statuses = updateState;
    // log(state.HandoutSpellsNS.turnActions[tokenId].statuses)
    targetObj.set("statusmarkers", newStatus.join(","))
}

function statusDamage(tokenId){
    log("statusDamage")
    var statusList = state.HandoutSpellsNS.turnActions[tokenId].statuses;
    // var name = getCharName(tokenId);
    var obj = getObj("graphic", tokenId);
    for (var status in statusList) {
        // change to use replacement instead
        var damage = statusList[status].damageTurn * statusList[status].magnitude
        // sendChat("System", "**" + statusList[status].spellName + "** triggers:")
        applyDamage(tokenId, damage, statusList[status].damageType, statusList[status].bodyPart, 0)
    }
}

async function checkCasting(token){
    casting = state.HandoutSpellsNS.turnActions[token];
    log(casting)
    char = getCharName(token)
    if(_.keys(casting.casting.seals).length > 0){
        let spellStats = await getFromHandout("PowerCard Replacements", casting.casting.spellName, ["SpellType"]);
        if(spellStats["SpellType"] != "Barrier") {sendChat("",'/w "' + char + '" Continue casting **' + casting.casting["spellName"] + "**? [Form Seal](!FormHandSeal;;" + token + ")")}
        else {
            sendChat("",'/w "' + char + '" **' + casting.casting["spellName"] + "** is cancelled since it wasn't cast in one turn.")
            casting.casting = {};
        }
    }
    else if(!_.isEmpty(casting.channel)){
        sendChat("", '/w "' + char + '" Channel **' + casting.channel["spellName"] + "** or cancel spell? [Channel](!ChannelSpell;;" + token + ") [Cancel](!CancelSpell;;" + token + ")")
    }
}

function setTurnOrder(){
    var orderList = [];
    var reactorList = [];
    var targetRoll = 0;
    
    _.each(state.HandoutSpellsNS.TurnOrder, function(token) {
      if (typeof token.pr === "number"){
          orderList.push(token);
      } 
      else {
          reactorList.push(token);
          var sources = [token.id];
          targetRoll = getInitRoll(token.pr, sources);
          if (targetRoll > 0){
              orderList.push({
                  id: token.id,
                  pr: targetRoll - 0.1,
              });
          }
          else {
              var char1 = getCharName(token.id);
              sendChat("", char1 + " and their target take no action!");
          }
      }
    });
    
    orderList.sort(function(a,b) {
        first = a.pr;
        second = b.pr;
        
        return second - first;
    });
    
    _.each(orderList, function(token){
        var i;
        for (i = 0; i < reactorList.length; i++) {
            if (reactorList[i].id == token.id) {
                var CharName = getCharName(reactorList[i].pr);
                
                token.pr = "R: " + CharName;
            }
        }
    });
    
    orderList.unshift({
        id: "-1",
        pr: "",
        custom: "Round Start",
    });
    FirstTurn = true;
    
    Campaign().set("turnorder", JSON.stringify(orderList));
}

function setReactions(tokenId){
    log("setReactions")
    log(tokenId)
    _.each(state.HandoutSpellsNS.OnInit[tokenId].reactors, function(reactor){
        // check if target is ally or foe
        // log(reactor.reactor)
        targetBar = getObj("graphic", tokenId).get("bar1_link")
        reactorBar = getObj("graphic", reactor).get("bar1_link")

        name = getCharName(reactor)
        log(name)
        sendChat("", name + " gets to react");
        if(name == "all") var txt = "";
        else if(name == "") var txt = "/w GM"
        else var txt = '/w "' + name + '" '

        if(targetBar.length != reactorBar.length){
            // target is foe
            sendChat("System",  txt + 'Choose Reaction: [Counter](!AddReact ' + reactor + " " + tokenId + " Counter) [Full Defense](!AddReact " + reactor + " " + tokenId + " Defense)")
        }
        else {
            // target is ally 
            sendChat("System", txt + 'Choose Reaction: [Bolster](!AddReact ' + reactor + " " + tokenId + " Bolster) [Follow-up](!AddReact " + reactor + " " + tokenId + " Follow)")
        }
        setReactions(reactor)
    });

}

function startTurn(){
    obj = Campaign();
    var nextToken = JSON.parse(obj.get("turnorder"))[0];
    var turnList = JSON.parse(obj.get("turnorder")).slice(1)
    if (nextToken.id === "-1"){
        log("starting new round")
        Campaign().set("turnorder", "");
        state.HandoutSpellsNS.TurnOrder = [];
        sendChat("", "/desc New Round Start")
        sendChat("", "[Roll](!RollInit &#64;{selected|token_name}) [React](!ReactInit &#64;{selected|token_id} &#64;{target|Reacting To|token_id})");
        // Start of round functions
        state.HandoutSpellsNS["OnInit"] = {};
        _.each(turnList, function(token) {
            charId = getCharFromToken(token.id);
            resetDodge(charId)
            state.HandoutSpellsNS.turnActions[token.id].castCount = 0;
            state.HandoutSpellsNS.OnInit[token.id] = {
                "name": getCharName(token.id),
                "reactors": []
            }
            statusDamage(token.id);
            statusChange(token.id);
        });
        return;
    }
    // else if (nextToken.id === "-1"){
    //     // log('reset dodge')
    //     _.each(turnList, function(token) {
    //         charId = getCharFromToken(token.id);
    //         resetDodge(charId);
    //         statusDamage(token.id);
    //         statusChange(token.id);
    //     });
    //     return;
    // }
    var charName = getCharName(nextToken.id);
    if (typeof nextToken.pr === "number"){
        // log("character is not reacting")
        sendChat("", "/desc " + charName + "'s Turn");
        checkCasting(nextToken.id);
        setReactions(nextToken.id);
    }
    else {
        sendChat("System", "/w GM Player Reacted")
    }
    _.each(turnList, function(token){
        if (token.pr === "R: " + charName){
            var reactName = getCharName(token.id);
        }
    })
    // FirstTurn = false;
}

function remainInit(){
    names = [];
    for(var token in state.HandoutSpellsNS.OnInit){
        if(!("type" in state.HandoutSpellsNS.OnInit[token])){
            names.push(state.HandoutSpellsNS.OnInit[token].name)
        }
    }
    sendChat("", "/w GM Missing from Init: " + names.join(", "))
}

//If you want players to roll, make this a global macro (add other stats as needed):
//    @{selected|token_name} rolls a [[ 1d20 + @{selected|Dex} &{tracker} ]] for initiative!

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    
    var args = msg.content.split(/\s+/);
    
    if (msg.type == "api" && msg.content.indexOf("!CombatBegins") !== -1) { //&& msg.who.indexOf("(GM)") !== -1
        
        
        Campaign().set("initiativepage", false );
        
        if (Combat_Begins.sendChat == true) {
            sendChat("", "/desc Combat Begins!");
        }
        state.HandoutSpellsNS.TurnOrder = [];
        state.HandoutSpellsNS.NumTokens = 0;
        state.HandoutSpellsNS["OnInit"] = {};
        state.HandoutSpellsNS["Drawing"] = {};
        state.HandoutSpellsNS["blockedTargets"] = {};
        // try{
        log(msg.selected)
        _.each(msg.selected, function(selected) {                
            state.HandoutSpellsNS.NumTokens += 1
            state.HandoutSpellsNS.OnInit[selected._id] = {
                "name": getCharName(selected._id),
                "reactors": []
            }
            
            state.HandoutSpellsNS.turnActions[selected._id] = {
                channel: {},
                statuses: {},
                casting: {}, 
                castCount: 0
            }
            charId = getCharFromToken(selected._id)
            resetDodge(charId);
            
            state.HandoutSpellsNS.crit[selected._id] = 0;
            
            log('after')
        });
        sendChat("", "[Roll](!RollInit) [React](!ReactInit &#64;{target|Reacting To|token_id})");
        sendChat("", "/w GM [DM React](!ReactDM)")
        remainInit()
        // } catch(err){
        //     log("error")
        //     log(err)
        //     return;
        // }
        //SendComplete = true
        // Campaign().set("initiativepage", true );
    }
    if (msg.type == "api" && msg.content.indexOf("!ReactDM") !== -1) {
        log(msg)
        _.each(msg.selected, function(selected){
            name = getObj("graphic", selected._id).get("name")
            log(name)
            sendChat("", "/w GM [" + name + "](!ReactInit &#64;{target|Reacting To|token_id} " + selected._id + ")")
        })
    }
    
    
    if (msg.type == "api" && msg.content.indexOf("!ReactInit") !== -1) {
        log(msg)
        
        if(!args[2]){
            selected_id = getTokenId(msg)    
        }
        else{
            selected_id = args[2]
        }
        if(!selected_id){return}
        target_id = args[1] 
        
        if (selected_id == 'undefined'){
            sendChat("", "Select one token before clicking Reaction");
            return;
        }

        if(!(selected_id in state.HandoutSpellsNS.OnInit)){
            sendChat("", "This token is not on the initiative list!")
            return;
        }
        
        state.HandoutSpellsNS.TurnOrder.push({
            id: selected_id,
            pr: target_id,
        });
        
        sourceName = getCharName(selected_id)
        targetName = getCharName(target_id)
        
        sendChat("System", '/w "' + sourceName + '" Reacting to ' + targetName);

        state.HandoutSpellsNS.OnInit[selected_id]["type"] = "Reaction"
        state.HandoutSpellsNS.OnInit[selected_id]["target"] = target_id
        state.HandoutSpellsNS.OnInit[target_id].reactors.push(selected_id)

        if (state.HandoutSpellsNS.TurnOrder.length == state.HandoutSpellsNS.NumTokens && state.HandoutSpellsNS.NumTokens > 0){
            Campaign().set("initiativepage", true );
            setTurnOrder();
            // Campaign().set("turnorder", JSON.stringify(TurnOrder));
            //SendComplete = false;
        }
        else {
            remainInit();
        }

        log(state.HandoutSpellsNS.OnInit)
    }

    if (msg.type == "api" && msg.content.indexOf("!AddReact") !== -1) {
        log('add react')
        selected_id = args[1]
        // selected_id = getTokenId(msg)
        // if(!selected_id){return}
        target_id = args[1]
        type = args[2]

        _.each(state.HandoutSpellsNS.OnInit[target_id].reactors, function(reactor){
            state.HandoutSpellsNS.OnInit[reactor].type = type
        });

        name = getCharName(selected_id)
        sendChat("System", '/w "' + name + '" ' + type + " reaction selected.")
        log(state.HandoutSpellsNS.OnInit)
    }
    
    if (msg.type == "api" && msg.content.indexOf("!CombatEnds") !== -1) {
            state.HandoutSpellsNS.TurnOrder = [];
            state.HandoutSpellsNS.NumTokens = 0;
            state.HandoutSpellsNS["OnInit"] = {};
            state.HandoutSpellsNS["Drawing"] = {};
            Campaign().set("turnorder", "");
            Campaign().set("initiativepage", false );
            sendChat("", "/desc Combat Ends!")
            //if (MovementTracker.MovementTracker == true) { ResetAllPins() };
    };
    
    if (msg.type == "api" && msg.content.indexOf("!DeathInit") !== -1){
        log("One fewer init total")
        state.HandoutSpellsNS.NumTokens = state.HandoutSpellsNS.NumTokens - 1;
        state.HandoutSpellsNS.OnInit.remove(args[1])
    }
    
    if (msg.type == "api" && msg.content.indexOf("!AdvanceTokenTurn") === 0){
        token = args[1]
        charId = getCharFromToken(token);
        name = getObj("graphic", token).get("name")
        sendChat("", name + "'s turn advanced!")
        resetDodge(charId);
        statusDamage(token);
        statusChange(token);
        checkCasting(token);
        
    }
    
    if (msg.type == "api" && msg.content.indexOf("!RollInit") !== -1) {
        log("RollInit")
        log(msg)
        var result = 0;
        tokenId = getTokenId(msg)
        if(!tokenId){tokens = msg.selected}
        else {tokens = [{"_id": tokenId}]}
        _.each(tokens, async function(selected) {
            var obj = getObj("graphic", selected._id);

            if(selected._id in state.HandoutSpellsNS.OnInit){

                var currChar = getObj("character", obj.get("represents")) || "";
                var initString = "";
                var TokenName = "";
                var CharName = "";
                
                if (currChar.length != 0) {
                    CharName = currChar.get("name");
                    if (currChar.get("controlledby") != "" && Combat_Begins.includeChars == false ) return;
                    
                    if (CharName != "") {
                        
                        _.each(Combat_Begins.statName, function(stat) {
                            //cycle through each stat and add it to mod  
                            mod = getAttrByName(obj.get("represents"), stat)
                            initString = initString + " + " + mod; 
             
                        });
                        // CharName = CharName + '"';
                    }
                    
                    var pre = "";
                    
                    if (Combat_Begins.sendChat == false || currChar.get("controlledby") == "") {
                        pre = "/w GM ";
                    }

                    // else {
                    //     pre = '/w "'
                    // }
                    
                    var string = "[[1d" + Combat_Begins.rollValue + initString + "]]";
                    
                    let result = await attackRoller(string);
                    
                    log(result)
                    state.HandoutSpellsNS.TurnOrder.push({
                        id: selected._id,
                        pr: result[1],
                    });

                    log(state.HandoutSpellsNS.OnInit)
                    
                    state.HandoutSpellsNS.OnInit[selected._id]["type"] = "Roll"             
                    // sendChat("character|" + obj.get("represents"), "I rolled a [[1d" + Combat_Begins.rollValue + "]] for initiative!", function(ops) {
                    //     var rollresult = ops[0];
                    //     result = rollresult.inlinerolls[0].results.total;
                    //     log(result)
                    // });
                    log(state.HandoutSpellsNS.TurnOrder)
                    sendChat("System", pre + CharName + " rolled a [[" + result[0] + "]] for initiative!");
                        
                } else {return;}
                
                
                log(state.HandoutSpellsNS.TurnOrder)
                log(state.HandoutSpellsNS.NumTokens)
                // log(SendComplete)
                if (state.HandoutSpellsNS.TurnOrder.length == state.HandoutSpellsNS.NumTokens && state.HandoutSpellsNS.NumTokens > 0){
                    // log(state.HandoutSpellsNS.TurnOrder)
                    setTurnOrder();
                    Campaign().set("initiativepage", true );
                    // Campaign().set("turnorder", JSON.stringify(TurnOrder));
                    //SendComplete = false;
                    
                }
                else {
                    remainInit()
                }
            }
            else {
                sendChat("System", "This token is not on the initiative list!")
            }
        });
    }
    
    if (msg.type == "api" && msg.content.indexOf("!AdvanceInit") !== -1){
        log("advance init")
        EndTurn = true;
        // run end of turn stuff first
        var tokenList = JSON.parse(Campaign().get("turnorder"));
        var pageid = Campaign().get("playerpageid")
        var statics = state.HandoutSpellsNS.staticEffects;
        token = tokenList.shift()
        if(token.id != "-1") {
            if(getObj("graphic", token.id).get("tint_color") != "transparent"){
                log("non transparent")
                // check for in range statics
                for(var areaToken in statics){
                    if(statics[areaToken].pageid != pageid) {return;}
                    var range = getRadiusRange(token.id, areaToken)
                    log(range)
                    log(statics[areaToken].radius)
                    if(range <= parseInt(statics[areaToken].radius)){
                        // apply effect
                        if(statics[areaToken].effectType == "Exorcism"){
                            let result = await applyDamage(token.id, statics[areaToken].damage, "Drain", "", 0)
                            log(result)
                        }
                    }
                }
            }
        }

        // advance the turn
        
        tokenList.push(token)
        Campaign().set("turnorder", JSON.stringify(tokenList));
        startTurn()
        EndTurn = false;
    }

    if (msg.type == "api" && msg.content.indexOf("!Test") !== -1){
        log("test")

          

    }

    if (msg.type == "api" && msg.content.indexOf("!NewPlayer") !== -1){
        log('new player')
        log(args[1])

        token = getObj("graphic", args[1])
        let spirit = await getAttrObj(getCharFromToken(args[1]), "spirit")
        let bind = await getAttrObj(getCharFromToken(args[1]), "Binding")
        token.set("bar1_link", spirit.get("id"))
        token.set("bar2_link", bind.get("id"))
        token.set("showname", true)
        token.set("has_bright_light_vision", true)
        token.set("showplayers_name", true)
        token.set("showplayers_bar1", true)
        token.set("showplayers_bar2", true)
        token.set("playersedit_name", false)
    }

    if (msg.type == "api" && msg.content.indexOf("!NewNPC") !== -1){
        log('new npc')

        token = getObj("graphic", args[1])
        let spirit = await getAttrObj(getCharFromToken(args[1]), "spirit")
        let bind = await getAttrObj(getCharFromToken(args[1]), "Binding")
        token.set("bar1_value", spirit.get("current"))
        token.set("bar1_max", spirit.get("max"))
        token.set("bar2_value", bind.get("current"))
        token.set("bar2_max", bind.get("max"))
        token.set("bar1_link", "")
        token.set("bar2_link", "")
        token.set("showname", true)
        token.set("has_bright_light_vision", true)
        token.set("showplayers_name", false)
        token.set("showplayers_bar1", false)
        token.set("showplayers_bar2", false)
        
    }
});

on("ready", function(){
    on("add:graphic", async function(obj){
        log('add')
        if(obj.get("layer") !== "objects") {return;}

        sendChat("", "/w GM [Player](!NewPlayer " + obj.get("id") + ") [NPC](!NewNPC " + obj.get("id") + ")")
        
        state.HandoutSpellsNS.turnActions[obj.get("id")] = {
                channel: {},
                statuses: {},
                casting: {}, 
                castCount: 0,
        }

        // let spirit = await getAttrObj(getCharFromToken(obj.get("id")), "spirit")
        // let bind = await getAttrObj(getCharFromToken(obj.get("id")), "Binding")
        // obj.set("bar1_link", spirit.get("id"))
        // obj.set("bar2_link", bind.get("id"))
        // obj.set("showname", true)
        // obj.set("has_bright_light_vision", true)

        // add facing token
        page = getObj("page", obj.get("pageid"))
        var gridSize = 70 * parseFloat(page.get("snapping_increment"));
        var imgsrc = "https://s3.amazonaws.com/files.d20.io/images/212037672/aXA6H5fviIZSB7rJTt63qA/thumb.png?1617066408";
        var charId = getCharFromToken(obj.get("id"))
        var char = getObj("character", charId)
        log(obj.get("top"))
        log(obj.get("top") - (gridSize / 2))

        createObj("graphic", 
            {
                controlledby: char.get("controlledby"),
                left: obj.get("left"),
                top: obj.get("top"),
                width: gridSize*2,
                height: gridSize*2,
                name: obj.get("id") + "_facing",
                pageid: obj.get("pageid"),
                imgsrc: imgsrc,
                layer: "gmlayer",
                has_bright_light_vision: true,
                has_night_vision: true,
                has_limit_field_of_vision: true,
                night_vision_distance: 40,
                limit_field_of_vision_total: 90, // change to stat from char
                limit_field_of_night_vision_total: 90, //change to stat from char
                has_limit_field_of_night_vision: true
            });

    });
    
    on("destroy:graphic", function(obj){
        log('destroy')
        if(obj.get("layer") !== "objects") {return;}
        
        delete state.HandoutSpellsNS.turnActions[obj.get("id")]
    });
});

on("change:campaign:turnorder", function(obj){
    if(!EndTurn){
        sendChat("", "/w GM Don't do it this way!!!!")
        var tokenList = JSON.parse(Campaign().get("turnorder"));
        tokenList.splice(0, 0, tokenList.pop())
        Campaign().set("turnorder", JSON.stringify(tokenList))
    } 
}) 