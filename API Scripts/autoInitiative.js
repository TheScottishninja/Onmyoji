var Combat_Begins = Combat_Begins || {};

Combat_Begins.statName = new Array ("Agility"); //Stats to be added to roll, commas between values
Combat_Begins.rollValue = 20; //rolling 1d20, change if you roll 1dXX
Combat_Begins.sendChat = true; //True if you want the chat log to show their results
Combat_Begins.includeChars = true; //set false if you want to roll for players

var TurnOrder = [];
var NumTokens = 0;
var FirstTurn = true;

var attackRoller = async function(txt){
    return new Promise((resolve,reject)=>{
    	sendChat('',txt,(ops)=>{
    		resolve(ops[0].inlinerolls[0].results.total);
    	});
    });
};

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
   _.each(TurnOrder, function(token) {
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
    var charID = currChar.get("_id");
    return charID;
}

async function getAttrObj(charId, name){
    var obj = {};
    obj = findObjs({
        _type: "attribute",
        _characterid: charId,
        name: name
    })[0];
    if(!obj){
        // log(getAttrByName(charId, name))
        max_value = getAttrByName(charId, name, "max")
        current_value = getAttrByName(charId, name)
        if (max_value === undefined) { 
            log(max_value)
            max_value = ""
        }
        if (current_value === undefined){
            log(current_value)
            current_value = ""
        }
        createObj("attribute", {
            characterid: charId,
            name: name,
            current: current_value,
            max: max_value
        })
        while(true){
            obj = findObjs({
                _type: "attribute",
                _characterid: charId,
                name: name
            })[0];
            log(obj)
            if(obj) break;
        }
        
    }
    return obj
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
        var statusNum = parseInt(statusId[1]) - 1;
        if (statusNum >= 1){
            newString = statusId[0] + "@" + statusNum.toString() + "_" + instance;
            updateState[newString] = state.HandoutSpellsNS.turnActions[tokenId].statuses[status];
            newStatus.push(statusId[0] + "@" + statusNum.toString());
        }
    }
    //update the keys in state
    state.HandoutSpellsNS.turnActions[tokenId].statuses = updateState;
    // log(state.HandoutSpellsNS.turnActions[tokenId].statuses)
    targetObj.set("statusmarkers", newStatus.join(","))
}

function statusDamage(tokenId){
    // log(state.HandoutSpellsNS.turnActions)
    log(state.HandoutSpellsNS.turnActions[tokenId])
    var statusList = state.HandoutSpellsNS.turnActions[tokenId].statuses;
    var name = getCharName(tokenId);
    var obj = getObj("graphic", tokenId);
    for (var status in statusList) {
        var damage = statusList[status].damageTurn * statusList[status].magnitude
        // sendChat("System", "**" + statusList[status].spellName + "** triggers:")
        sendChat("", "!ApplyDamage;;" + tokenId + ";;" + damage + ";;" + statusList[status].damageType + ";;" + statusList[status].bodyPart + ";;0")
    }
}

function checkCasting(token){
    state.HandoutSpellsNS.turnActions[token].castCount = 0;
    casting = state.HandoutSpellsNS.turnActions[token];
    log(casting)
    char = getCharName(token)
    if(_.keys(casting.casting.seals).length > 0){
        sendChat("",'/w "' + char + '" Continue casting **' + casting.casting["spellName"] + "**? [Form Seal](!FormHandSeal;;" + token + ")")
    }
    else if(!_.isEmpty(casting.channel)){
        sendChat("", '/w "' + char + '" Channel **' + casting.channel["spellName"] + "** or cancel spell? [Channel](!ChannelSpell;;" + token + ") [Cancel](!CancelSpell;;" + token + ")")
    }
}

function setTurnOrder(){
    var orderList = [];
    var reactorList = [];
    var targetRoll = 0;
    
    _.each(TurnOrder, function(token) {
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

function startTurn(){
    obj = Campaign();
    var nextToken = JSON.parse(obj.get("turnorder"))[0];
    var turnList = JSON.parse(obj.get("turnorder")).slice(1)
    if (nextToken.id === "-1" && !FirstTurn){
        log("starting new round")
        Campaign().set("turnorder", "");
        TurnOrder = [];
        sendChat("", "/desc New Round Start")
        sendChat("", "[Initiative](!RollInit &#64;{selected|token_name}) [Reaction](!ReactInit &#64;{selected|token_id} &#64;{target|Reacting To|token_id})");
        // Start of round functions
        _.each(turnList, function(token) {
            charId = getCharFromToken(token.id);
            resetDodge(charId)
        });
        return;
    }
    else if (nextToken.id === "-1"){
        // log('reset dodge')
        _.each(turnList, function(token) {
            charId = getCharFromToken(token.id);
            resetDodge(charId);
            statusDamage(token.id);
            statusChange(token.id);
        });
        return;
    }
    var charName = getCharName(nextToken.id);
    if (typeof nextToken.pr === "number"){
        // log("character is not reacting")
        sendChat("", "/desc " + charName + "'s Turn");
        checkCasting(nextToken.id);
    }
    else {
        sendChat("System", "/w GM Player Reacted")
    }
    _.each(turnList, function(token){
        if (token.pr === "R: " + charName){
            var reactName = getCharName(token.id);
            sendChat("", reactName + " gets to react");
        }
    })
    FirstTurn = false;
}

//If you want players to roll, make this a global macro (add other stats as needed):
//    @{selected|token_name} rolls a [[ 1d20 + @{selected|Dex} &{tracker} ]] for initiative!

on("chat:message", function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    
    var args = msg.content.split(/\s+/);
    
    if (msg.type == "api" && msg.content.indexOf("!CombatBegins") !== -1 && msg.who.indexOf("(GM)") !== -1) {
        
        
        Campaign().set("initiativepage", false );
        
        if (Combat_Begins.sendChat == true) {
            sendChat("", "/desc Combat Begins!");
        }
        TurnOrder = [];
        NumTokens = 0;
        try{
            _.each(msg.selected, function(selected) {
                // var obj = getObj("graphic", selected._id);
                
                // //Test for players, exit if players roll themself
                
                // var currChar = getObj("character", obj.get("represents")) || "";
                // var CharName = ""
                
                // if (currChar.length != 0) {
    
                //     CharName = currChar.get("name");
                //     CharName = CharName.substring(0, CharName.indexOf(" "))
                    
                //     var pre = "";
                    
                //     if (Combat_Begins.sendChat == false || currChar.get("controlledby") == "") {
                //         pre = "/w GM ";
                //     }
                //     else {
                //         pre = "/w " + CharName + " ";
                //     }
                    
                //     //var string = "I rolled a [[1d" + Combat_Begins.rollValue + initString + "]] for initiative!";
                //     var string = "[Initiative](!RollInit &#64;{selected|token_name}) [Reaction](!ReactInit &#64;{selected|token_id} &#64;{target|Reacting To|token_id})";

                //     sendChat("", pre + string);
                    
           
                // } else {
                    
                //     //handles non-linked tokens. Rolls the die value and uses it.
                //     sendChat(obj.get("name"), "/w GM [Initiative](!RollInit &#64{selected|token_id} &#64{target|token_id})");

                // }
                
                NumTokens = NumTokens + 1
            });
            sendChat("", "[Initiative](!RollInit &#64;{selected|token_name}) [Reaction](!ReactInit &#64;{selected|token_id} &#64;{target|Reacting To|token_id})");
        } catch(err){return;}
        //SendComplete = true
        // Campaign().set("initiativepage", true );
    }
    
    
    if (msg.type == "api" && msg.content.indexOf("!ReactInit") !== -1) {
        // source = msg.selected[0]._id
        selected_id = args[1]
        target_id = args[2]
        
        if (selected_id == 'undefined'){
            sendChat("", "Select one token before clicking Reaction");
            return;
        }
        
        TurnOrder.push({
            id: selected_id,
            pr: target_id,
        });
        
        sourceName = getCharName(selected_id)
        targetName = getCharName(target_id)
        
        sendChat("System", "/w " + sourceName.substring(0, sourceName.indexOf(" ")) + " Reacting to " + targetName);
        // log(TurnOrder)
        // log(NumTokens)
        // log(SendComplete)
        if (TurnOrder.length == NumTokens && NumTokens > 0){
            Campaign().set("initiativepage", true );
            setTurnOrder();
            // Campaign().set("turnorder", JSON.stringify(TurnOrder));
            //SendComplete = false;
            
        }
        
    }
    
    if (msg.type == "api" && msg.content.indexOf("!CombatEnds") !== -1) {
            TurnOrder = [];
            NumTokens = 0;
            Campaign().set("turnorder", "");
            Campaign().set("initiativepage", false );
            sendChat("", "/desc Combat Ends!")
            //if (MovementTracker.MovementTracker == true) { ResetAllPins() };
    };
    
    if (msg.type == "api" && msg.content.indexOf("!DeathInit") !== -1){
        log("One fewer init total")
        NumTokens = NumTokens - 1;
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
        var result = 0;
         _.each(msg.selected, async function(selected) {
            var obj = getObj("graphic", selected._id);

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
                    
                }
                
                var pre = "";
                
                if (Combat_Begins.sendChat == false || currChar.get("controlledby") == "") {
                    pre = "/w GM ";
                }
                
                var string = "[[1d" + Combat_Begins.rollValue + initString + "]]";
                
                let result = await attackRoller(string);
                
            //  	log(result)
                TurnOrder.push({
                    id: selected._id,
                    pr: result[1],
                });
                    
                                
                // sendChat("character|" + obj.get("represents"), "I rolled a [[1d" + Combat_Begins.rollValue + "]] for initiative!", function(ops) {
                //     var rollresult = ops[0];
                //     result = rollresult.inlinerolls[0].results.total;
                //     log(result)
                // });
                log(TurnOrder)
                sendChat("System", pre + CharName + " rolled a [[" + result[0] + "]] for initiative!");
                    
            } else {return;}
            
            
            // log(TurnOrder)
            // log(NumTokens)
            // log(SendComplete)
            if (TurnOrder.length == NumTokens && NumTokens > 0){
                // log(TurnOrder)
                setTurnOrder();
                Campaign().set("initiativepage", true );
                // Campaign().set("turnorder", JSON.stringify(TurnOrder));
                //SendComplete = false;
                
            }
         });
    }
    
    if (msg.type == "api" && msg.content.indexOf("!AdvanceInit") !== -1){
        log("advance init")
        // run end of turn stuff first


        // advance the turn
        var tokenList = JSON.parse(Campaign().get("turnorder"));
        tokenList.push(tokenList.shift())
        Campaign().set("turnorder", JSON.stringify(tokenList));
        startTurn()
    }
});

on("ready", function(){
    on("add:graphic", async function(obj){
        log('add')
        if(obj.get("layer") !== "objects") {return;}
        
        state.HandoutSpellsNS.turnActions[obj.get("id")] = {
                channel: {},
                statuses: {},
                casting: {}, 
                castCount: 0,
        }

        let spirit = await getAttrObj(getCharFromToken(obj.get("id")), "spirit")
        let bind = await getAttrObj(getCharFromToken(obj.get("id")), "Binding")
        obj.set("bar1_link", spirit.get("id"))
        obj.set("bar2_link", bind.get("id"))
        obj.set("showname", true)
    });
    
    on("destroy:graphic", function(obj){
        log('destroy')
        if(obj.get("layer") !== "objects") {return;}
        
        delete state.HandoutSpellsNS.turnActions[obj.get("id")]
    });
});

on("change:campaign:turnorder", function(obj){
    sendChat("", "/w GM Don't do it this way!!!!")
    var tokenList = JSON.parse(Campaign().get("turnorder"));
    tokenList.splice(0, 0, tokenList.pop())
    Campaign().set("turnorder", JSON.stringify(tokenList));
})
