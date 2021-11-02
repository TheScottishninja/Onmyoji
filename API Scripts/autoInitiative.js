var Combat_Begins = Combat_Begins || {};

Combat_Begins.statName = new Array ("Agility"); //Stats to be added to roll, commas between values
Combat_Begins.rollValue = 20; //rolling 1d20, change if you roll 1dXX
Combat_Begins.sendChat = true; //True if you want the chat log to show their results
Combat_Begins.includeChars = true; //set false if you want to roll for players

state.HandoutSpellsNS.staticEffects = {}
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
    if (currChar.length != 0) {
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
          // token rolled init
          orderList.push(token);
      } 
      else {
          // token reacted to init, try to set turn after target
          reactorList.push(token);
          var sources = [token.id];
          targetRoll = getInitRoll(token.pr, sources);
          if (targetRoll > 0){
              // target rolled, set the turn value
              orderList.push({
                  id: token.id,
                  pr: targetRoll - 0.1,
              });   
          }
          else {
            // react to each other, neither gets to attack
            var char1 = getCharName(token.id);
            sendChat("", char1 + " takes no action this turn!");

            // use the stunned status to prevent attacking for both targets this turn
            orderList.push({
                id: token.id,
                pr: 0,
            });

            state.HandoutSpellsNS.OnInit[token.id].conditions["Stunned"] = {"id": condition_ids["Stunned"]}
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
        if(token.pr == 0){
            token.pr = "No Action"
        }
        else{
            for (i = 0; i < reactorList.length; i++) {
                if (reactorList[i].id == token.id) {
                    var CharName = getCharName(reactorList[i].pr);
                    
                    token.pr = "R: " + CharName;
                }
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
    
    for(reactorId in state.HandoutSpellsNS.OnInit[tokenId].reactors){
        reactor = state.HandoutSpellsNS.OnInit[tokenId].reactors[reactorId]

        if(reactorId == state.HandoutSpellsNS.OnInit[tokenId].turnTarget){
            // reacting to each other, don't set a reaction
            continue;
        }
        
        name = getCharName(reactorId)
        sendChat("", name + " gets to react");

        // if(name == "all") var txt = "";
        // else if(name == "") var txt = "/w GM"
        // else var 
        
        txt = '/w "' + name + '" '

        if(reactor.relation == "foe"){
            // target is foe
            // check if using a weapon
            reactTurn = state.HandoutSpellsNS.OnInit[reactorId]
            if("weaponName" in reactTurn.ongoingAttack){
                // add parry prompt
                sendChat("System",  txt + 'Choose Reaction: [Counter](!AddReact ' + reactorId + " " + tokenId + " Counter) [Full Defense](!AddReact " + reactorId + " " + tokenId + ") [Parry](!AddReact " + reactorId + " " + tokenId + " Parry)")
            }
            else{
                sendChat("System",  txt + 'Choose Reaction: [Counter](!AddReact ' + reactorId + " " + tokenId + " Counter) [Full Defense](!AddReact " + reactorId + " " + tokenId + " Defense)")
            }
        }
        else {
            // target is ally 
            sendChat("System", txt + 'Choose Reaction: [Bolster](!AddReact ' + reactorId + " " + tokenId + " Bolster) [Follow-up](!AddReact " + reactorId + " " + tokenId + " Follow)")
        }

        // recursively set reactions for the reactor
        setReactions(reactorId)
    };

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
        sendChat("", "[Roll](!RollInit) [React](!ReactInit &#64;{target|Reacting To|token_id})");
        sendChat("", "/w GM [DM React](!ReactDM)")
        // Start of round functions
        state.HandoutSpellsNS.TurnOrder = [] //is this needed here?
        _.each(turnList, function(token) {

            charId = getCharFromToken(token.id);
            resetDodge(charId)
            // state.HandoutSpellsNS.turnActions[token.id].castCount = 0;

            state.HandoutSpellsNS.OnInit[token.id].reactors = {}
            state.HandoutSpellsNS.InitReady.push(token.id)
            // statusDamage(token.id);
            // statusChange(token.id);
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
    state.HandoutSpellsNS.currentTurn = state.HandoutSpellsNS.OnInit[nextToken.id]
    if (typeof nextToken.pr === "number"){
        // log("character is not reacting")
        sendChat("", "/desc " + charName + "'s Turn");
        // checkCasting(nextToken.id);
        // setReactions(nextToken.id);
    }
    else {
        state.HandoutSpellsNS.currentTurn.conditions = {"reacting": {"id": "A"}}
        sendChat("System", "/w GM Player Reacted")
    }
    state.HandoutSpellsNS.currentTurn.startTurn()
    // _.each(turnList, function(token){
    //     if (token.pr === "R: " + charName){
    //         var reactName = getCharName(token.id);
    //     }
    // })
    // FirstTurn = false;
}

function remainInit(){
    names = [];
    _.each(state.HandoutSpellsNS.InitReady, function(token){
        names.push(getCharName(token))
    });
    // for(var token in state.HandoutSpellsNS.OnInit){
    //     if(!("type" in state.HandoutSpellsNS.OnInit[token])){
    //         names.push(state.HandoutSpellsNS.OnInit[token].name)
    //     }
    // }
    sendChat("", "/w GM Missing from Init: " + names.join(", "))
}

async function getEquippedWeapon(tokenId, toggleOff){
    // Equip weapons
    nameReg = new RegExp(`repeating_attacks_.{20}_RowID`)
    let result = await new Promise(async function(resolve,reject){
    
        var output = {}
        attrs = findObjs({
            _type: 'attribute',
            _characterid: getCharFromToken(tokenId)
        })
        
        for (var i = 0; i < attrs.length; i++) {
            const o = attrs[i];
            const attrName = o.get('name');
            if (nameReg.test(attrName)) {
                // check if equiped
                val = o.get('current')
                
                let equipState = findObjs({_type: "attribute", name: "repeating_attacks_" + val + "_WeaponEquip"})[0] //assuming to get
                
                if(equipState.get("current") == "Unequip"){
                    log("equipped weapon detected")
                    // create and add weapon to turn
                    let weaponName = findObjs({_type: "attribute", name: "repeating_attacks_" + val + "_WeaponName"})[0] //assuming to get
                    weapon = new Weapon(tokenId)
                    await weapon.init(weaponName.get("current"))
                    
                    output = weapon
                }

                if(toggleOff){
                    // flag to toggle off ability
                    let toggleState = await findObjs({_type: "attribute", name: "repeating_attacks_" + val + "_ToggleState"})[0] //assuming to get
                    toggleState.set("current", "Toggle On")
                }
    
            }
            // else if (attrName === `_reporder_${prefix}`) mods.push(o.get('current'));
        }
        resolve(output)
    })

    return result
}

condition_ids = {
    "Counter": "8",
    "Bolster": "1",
    "Defense": "3",
    "Follow": "2",
    "Stunned": "C",
    "Parry": "D"
}

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
        state.HandoutSpellsNS.InitReady = [];
        state.HandoutSpellsNS["OnInit"] = {};
        state.HandoutSpellsNS["Drawing"] = {};
        state.HandoutSpellsNS["blockedTargets"] = {};
        // try{
        log(msg.selected)
        for (let i = 0; i < msg.selected.length; i++) {
        // msg.selected.forEach(async function(selected){
            var selected = msg.selected[i];
            
            if(selected._type == "graphic"){
                
                // create turn object for each selected
                newTurn = new Turn(selected._id)
    
                // state.HandoutSpellsNS.NumTokens += 1
                newTurn.conditions = {"normal": {"id": "0"}} // so that mods can be found roll init, could handling sneaking?
    
                // move dodge to turn?
                charId = getCharFromToken(selected._id)
                resetDodge(charId);
    
                // Toggle Off abilities
                weapon = await getEquippedWeapon(selected._id, true)
                
                if(!_.isEmpty(weapon)){
                    // equipped weapon found
                    log(weapon.toggle)
                    weapon.toggleOff(weapon.toggle)
                    newTurn.ongoingAttack = weapon
                }
                
                state.HandoutSpellsNS.OnInit[selected._id] = newTurn
                state.HandoutSpellsNS.InitReady.push(selected._id)
                
                // state.HandoutSpellsNS.turnActions[selected._id] = {
                //     channel: {},
                //     statuses: {},
                //     casting: {}, 
                //     castCount: 0
                // }
    
                
                // state.HandoutSpellsNS.crit[selected._id] = 0;
            }                
            
        }
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
            if(selected._type == "graphic"){
                name = getObj("graphic", selected._id).get("name")
                log(name)
                sendChat("", "/w GM [" + name + "](!ReactInit &#64;{target|Reacting To|token_id} " + selected._id + ")")
            }
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
        
        // set turn target and type
        tokenTurn = state.HandoutSpellsNS.OnInit[selected_id]
        tokenTurn.turnType = "Reaction"
        tokenTurn.turnTarget = target_id
        tokenTurn.conditions = {"reacting": {"id": "A"}}
        
        // add reaction to turn of target
        targetBar = getObj("graphic", target_id).get("bar1_link")
        reactorBar = getObj("graphic", selected_id).get("bar1_link")
        var relation = "ally"
        if(targetBar.length != reactorBar.length){relation = "foe"}
        
        targetTurn = state.HandoutSpellsNS.OnInit[target_id]
        targetTurn.reactors[selected_id] = {
            "type": "Reaction",
            "relation": relation
        }
        sendChat("System", '/w "' + tokenTurn.name + '" Reacting to ' + targetTurn.name);

        // remove selected token from ready list
        state.HandoutSpellsNS.InitReady.splice(state.HandoutSpellsNS.InitReady.indexOf(selected_id), 1)

        // state.HandoutSpellsNS.OnInit[selected_id]["type"] = "Reaction"
        // state.HandoutSpellsNS.OnInit[selected_id]["target"] = target_id
        // state.HandoutSpellsNS.OnInit[target_id].reactors.push(selected_id)

        if (state.HandoutSpellsNS.InitReady.length < 1){
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
        // move this to inside of turn!!!
        log('add react')
        reactorId = args[1]
        // selected_id = getTokenId(msg)
        // if(!selected_id){return}
        targetId = args[2]
        type = args[3]
        log(state.HandoutSpellsNS.OnInit)

        state.HandoutSpellsNS.OnInit[targetId].reactors[reactorId].type = type
        state.HandoutSpellsNS.OnInit[reactorId].conditions[type] = {"id": condition_ids[type]}

        name = getCharName(reactorId)
        sendChat("System", '/w "' + name + '" ' + type + " reaction selected.")
        
    }
    
    if (msg.type == "api" && msg.content.indexOf("!CombatEnds") !== -1) {
            state.HandoutSpellsNS.TurnOrder = [];
            // state.HandoutSpellsNS.NumTokens = 0;
            for(var token in state.HandoutSpellsNS.OnInit){
                turn = state.HandoutSpellsNS.OnInit[token]
                // Toggle Off abilities
                weapon = await getEquippedWeapon(token, true)
                
                if(!_.isEmpty(weapon)){
                    // equipped weapon found
                    weapon.toggleOff(weapon.toggle)
                }

                // clear status effects
                tokenObj = getObj("graphic", token)
                tokenObj.set("statusmarkers", "")
            }
            state.HandoutSpellsNS["OnInit"] = {};
            state.HandoutSpellsNS["Drawing"] = {};
            state.HandoutSpellsNS.currentTurn = {}
            Campaign().set("turnorder", "");
            Campaign().set("initiativepage", false );
            // clear the stored classes
            let Handout = findObjs({_type:"handout", name:"ClassStore"})[0]
            Handout.set("notes", "")
            sendChat("", "/desc Combat Ends!")
            //if (MovementTracker.MovementTracker == true) { ResetAllPins() };
    };
    
    if (msg.type == "api" && msg.content.indexOf("!DeathInit") !== -1){
        log("One fewer init total")
        // state.HandoutSpellsNS.NumTokens = state.HandoutSpellsNS.NumTokens - 1;
        state.HandoutSpellsNS.OnInit.remove(args[1])
    }
    
    if (msg.type == "api" && msg.content.indexOf("!RollInit") !== -1) {
        log("RollInit")
        log(msg)

        var rollTargets = []
        if("selected" in msg){
            // use selected to get tokens
            rollTargets = msg.selected
        }
        else {
            // use speaking as to get token
            log(getTokenId(msg))
            rollTargets.push({"_id": getTokenId(msg), "_type": "graphic"})
        }
        log(rollTargets)

        _.each(rollTargets, async function(selected) {
            if(selected._id in state.HandoutSpellsNS.OnInit){
                var obj = getObj("graphic", selected._id);
                
                // get mods for rolled init
                charId = getCharFromToken(selected._id)
                rollDie = getMods(charId, "322")[0].reduce((a, b) => a + b, 0)
                rollAdd = getMods(charId, "323")[0].reduce((a, b) => a + b, 0)
                // something not working here
                // handle +/- mods
                if(rollDie >= 0){ rollDie = "+" + rollDie.toString()}
                if(rollAdd >= 0){ rollAdd = "+" + rollAdd.toString()}
                
                var string = "[[1d(" + Combat_Begins.rollValue + rollDie + ")" + rollAdd + "]]";
                let result = await attackRoller(string);
                
                log(result)
                state.HandoutSpellsNS.TurnOrder.push({
                    id: selected._id,
                    pr: result[1],
                });
                
                // log(state.HandoutSpellsNS.TurnOrder)
                var tokenTurn = state.HandoutSpellsNS.OnInit[selected._id]
                log(tokenTurn.name)

                pre = ""
                if(obj.get("bar1_link") == ""){
                    pre = "/w GM "
                }
                sendChat("System", pre + tokenTurn.name + " rolled a [[" + result[0] + "]] for initiative!");
                
                // set turn type
                tokenTurn.turnType = "Roll"
                tokenTurn.conditions = {"normal": {"id": "0"}}
                tokenTurn.turnTarget = "    "
                
                // remove selected token from ready list
                log(state.HandoutSpellsNS.InitReady)
                state.HandoutSpellsNS.InitReady.splice(state.HandoutSpellsNS.InitReady.indexOf(selected._id), 1)
                
                // log(state.HandoutSpellsNS.NumTokens)
                // log(SendComplete)
                if (state.HandoutSpellsNS.InitReady.length < 1){
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
                if(selected._type == "graphic"){
                    sendChat("System", "This token is not on the initiative list!")
                }
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
            state.HandoutSpellsNS.OnInit[token.id].endTurn()
            if(getObj("graphic", token.id).get("tint_color") != "transparent"){
                // should this be in turn?
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
        let handout = findObjs({_type: "handout", name: "Effect Test"})[0]
        if(handout){
            log("handout found")
            handout.get("notes", function(currentNotes){
                log("in current notes")
                // noteString = currentNotes.substring(5, currentNotes.indexOf("</pre>"))
                noteObj = JSON.parse(currentNotes);
                log(noteObj)
            });
        }
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

on("ready", async function(){
    on("add:graphic", async function(obj){
        log('add')
        if(obj.get("layer") !== "objects") {return;}

        sendChat("", "/w GM [Player](!NewPlayer " + obj.get("id") + ") [NPC](!NewNPC " + obj.get("id") + ")")
        
        state.HandoutSpellsNS.turnActions[obj.get("id")] = {
                channel: {},
                statuses: {},
                casting: {}, 
                castCount: 0,
                weapon: {},
                conditions: {}
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

    let Handout = findObjs({_type:"handout", name:"ClassStore"})[0],
    ReadFiles = await new Promise(function(resolve,reject){//the await tells the script to pause here and wait for this value to appear. Once a value is returned, the script will continue on its way
        if(Handout){
            Handout.get("notes",function(notes){
                // log("in the callback notes is :" + notes);
                resolve(notes);//resolving the promise gives a value that unpauses the script execution
            });
        }else{
            log("Did not find the handout")
            reject(false);//reject also gives a value to the promise to allow the script to continue
        }
    });

    // log(ReadFiles)
    if(ReadFiles != ""){
        log("Class instances loading...")
        var instances = JSON.parse(ReadFiles)
        for(instance in instances){
            // create new turn instance
            newTurn = new Turn(instances[instance])

            weapon = await getEquippedWeapon(instance, false)
            if(!_.isEmpty(weapon)){
                // equipped weapon found
                newTurn.ongoingAttack = weapon
            }

            state.HandoutSpellsNS.OnInit[instance] = newTurn
        }

        // set current turn based on init page
        var nextToken = JSON.parse(Campaign().get("turnorder"))[0];
        state.HandoutSpellsNS.currentTurn = state.HandoutSpellsNS.OnInit[nextToken.id] //double check this is working
    }
});

on("change:campaign:turnorder", function(obj){
    if(!EndTurn){
        sendChat("", "/w GM Don't do it this way!!!!")
        var tokenList = JSON.parse(Campaign().get("turnorder"));
        tokenList.splice(0, 0, tokenList.pop())
        Campaign().set("turnorder", JSON.stringify(tokenList))
    } 
}) 