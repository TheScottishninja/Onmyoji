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
            max_value = "0"
        } 
        if (current_value === undefined){
            log(current_value)
            current_value = "0"
        }
        createObj("attribute", {
            characterid: charId,
            name: name,
            current: current_value,
            max: max_value
        })
        let obj = await getAttrObj(charId, name)
    }
    return obj
}

async function getFromHandout(handout, spellName, headers) {
    //pulling from spell handout
    let customTimesHandout = findObjs({_type:"handout", name:handout})[0],//this allows you to skip the need for that if(customTimesHandout &&...). findObjs always returns an array, if there were no results, then getting index 0 of the array will give null.
    ReadFiles = await new Promise(function(resolve,reject){//the await tells the script to pause here and wait for this value to appear. Once a value is returned, the script will continue on its way
        if(customTimesHandout){
            customTimesHandout.get("notes",function(notes){
                // log("in the callback notes is :" + notes);
                resolve(notes);//resolving the promise gives a value that unpauses the script execution
            });
        }else{
            log("Did not find the handout")
            reject(false);//reject also gives a value to the promise to allow the script to continue
        }
    });
    
    var startIdx = ReadFiles.indexOf(spellName) + spellName.length;
    // var endIdx = ReadFiles.indexOf("<p>", startIdx);

    var results = {};
    _.each(headers, function(header){
        var headerStart = ReadFiles.indexOf(header, startIdx);
        var headerEnd = ReadFiles.indexOf(";", headerStart);
        results[header] = ReadFiles.substring(headerStart + header.length + 1, headerEnd);
    });

    return results;
}

function getMods(charid, code){
    regex = []
    for (var i = 0; i < code.length; i++) {
        regex.push("(" + code[i] + "|Z)");
    }
    regex = regex.join("")
    // log(regex)
    let regExp = new RegExp(`^${regex}.*`);
    var mods = [];
    var names = [];
    // Get attributes
    findObjs({
        _type: 'attribute',
        _characterid: charid
    }).forEach(o => {
        const attrName = o.get('name');
        if (regExp.test(attrName)) {
            val = parseInt(o.get('current'))
            if(isNaN(val)){val = 0}
            mods.push(val);
            names.push(attrName.substring(code.length + 1));
        }
        // else if (attrName === `_reporder_${prefix}`) mods.push(o.get('current'));
    });
    return [mods, names];
}

function replaceDigit(code, pos, value) {
    code = code.substring(0, pos) + value + code.substring(pos + 1)
    return code;
}

function getHandoutByName(name){
    var folders = JSON.parse(Campaign().get('_journalfolder'))
    // log(folders)
    var output = {};
    _.each(folders, function(folder){
        if(folder.n === "Handouts"){
            var handouts = folder.i;
            _.each(handouts, function(handout){
               var obj = getObj("handout", handout);
            //   log(obj)
               if(obj != undefined){
                   if(obj.get("name") === name){
                    //   log("found")
                       output = obj;
                   }
               }
            });
        }
    });
    return output;
}

async function getSpellString(macro, replacements){
    let Handout = findObjs({_type:"handout", name:"PowerCard Macros"})[0],
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

    startIdx = ReadFiles.indexOf(macro) + macro.length + 1;
    endIdx = ReadFiles.indexOf("</p>", startIdx)
    spellString = ReadFiles.substring(startIdx, endIdx)

    for(var header in replacements){
        re = new RegExp(header, "g");
        spellString = spellString.replace(re, replacements[header])
    }

    return spellString
}

function setReplaceHandout(spellName, newText){
    replaceHandout = getHandoutByName("PowerCard Replacements");
    replaceHandout.get("notes", function(currentNotes){
        if(currentNotes.includes(spellName)){
            startIdx = currentNotes.indexOf(spellName)
            beforeString = currentNotes.substring(0, startIdx)
            afterString = currentNotes.substring(currentNotes.indexOf("</p>", startIdx))
            replaceHandout.set("notes",beforeString + newText + afterString);
            log("Updated Replacement")
        }
        else {
            
            replaceHandout.set("notes", currentNotes + "<p>" + newText + "</p>");
            log("Added to Replacement")
        }  
    });
}

function setReplaceMods(charid, code){
    var rollAdd = state.HandoutSpellsNS.coreValues.RollAdd;
    var rollDie = state.HandoutSpellsNS.coreValues.RollDie;
    var rollCount = state.HandoutSpellsNS.coreValues.RollCount;
    var critThres = state.HandoutSpellsNS.coreValues.CritThres;
    var pierce = state.HandoutSpellsNS.coreValues.Pierce;

    var digit = 2;
    if(code[0] === "1"){
        digit = 4;
        modType = "AttackMods:"
    }
    else if(code[0] === "2"){
        modType = "DefenceMods:"
    }
    else {
        modType = "UtilityMods:"
    }

    rollCount += getMods(charid, replaceDigit(code, digit, "1"))[0].reduce((a, b) => a + b, 0)
    rollDie += getMods(charid, replaceDigit(code, digit, "2"))[0].reduce((a, b) => a + b, 0)
    rollAdd += getMods(charid, replaceDigit(code, digit, "3"))[0].reduce((a, b) => a + b, 0)
    critThres -= getMods(charid, replaceDigit(code, digit, "5"))[0].reduce((a, b) => a + b, 0)
    pierce += getMods(charid, replaceDigit(code, digit, "6"))[0].reduce((a, b) => a + b, 0)

    attackText = modType + ["RollCount|" + rollCount.toString(),
                            "RollDie|" + rollDie.toString(),
                            "RollAdd|" + rollAdd.toString(),
                            "CritThres|" + critThres.toString(),
                            "Pierce|" + pierce.toString(),
                            "Normal|" + (1 - pierce).toString()].join(";") + ";"

    // log(attackText)
    setReplaceHandout(modType, attackText)
}

function WSendChat(from, tokenId, txt){
    var start = ""
    if(getCharFromToken(tokenId) != "all"){
        start = '/w "' + getCharName(tokenId) + '" '
    }

    sendChat(from, start + txt)
}

function getTokenId(msg){
    // check if message from GM
    if(msg.who.includes("(GM)")){
        // use selected tokenId
        if(!msg.selected){
            sendChat("System", "/w GM ERROR: Must have a token selected")
            return false;
        }
        if(msg.selected.length > 1){
            sendChat("System", "/w GM ERROR: Input expects only one selected token")
            return false;
        }
        log(msg.selected[0]._id)
        return msg.selected[0]._id;
    }

    // get player
    player = findObjs({
        _type: "player",
        _displayname: msg.who
    })[0]

    if(player){
        // player needs speak as their character
        sendChat("System", "/w " + msg.who + " ERROR: Must set speaking as to your character name!")
        return false;
    }

    char = findObjs({
        _type: "character",
        name: msg.who
    })[0]
    player = findObjs({
        _type: "player",
        speakingas: "character|" + char.get("_id")
    })[0]

    // get player's current page
    playerPages = Campaign().get("playerspecificpages")
    if(!playerPages){
        // log("group")
        pageid = Campaign().get("playerpageid")
    }
    else if(player.get("_id") in playerPages){
        // log("solo")
        pageid = playerPages[player.get("_id")]   
    }
    else {
        // log("group")
        pageid = Campaign().get("playerpageid")
    }

    tokenId = findObjs({
        _type: "graphic",
        _pageid: pageid,
        represents: char.get("_id")
    })[0]

    if(tokenId){
        log(tokenId.get("_id"))
        return tokenId.get("_id")
    }
    else {
        sendChat("System", '/w "'  + msg.who + '" You do not have a token on your current page!')
        return false;
    }
}

var attackRoller = async function(txt){
    let results = await new Promise((resolve,reject)=>{
        sendChat('',txt,(ops)=>{
            resolve(ops[0].inlinerolls[0].results);
        });
    });
    nums = [];
    _.each(results.rolls, function(roll){
        log(roll)
        if(roll.type == "R"){
            _.each(roll.results, function(result){
                nums.push("(" + result.v + ")")
            });
        }
        else if(roll.expr == "+"){}
        else {
            var values = roll.expr.split("+")
            _.each(values, function(value){
                if(value != "")
                    nums.push(value)
            })
            // nums.push(roll.expr.replace(/+/, ""))
        }
    });
    return [nums.join("+"), results.total]
    
};

state.HandoutSpellsNS.coreValues = {
    RollAdd: 0,
    RollCount: 0,
    RollDie: 0,
    CritThres: 20,
    Pierce: 0.25,
    TalismanDC: {
        0: 4,
        1: 8,
        2: 12,
        3: 16,
        4: 20,
        5: 24,
        6: 28
    },
    HandSealDC: 5,
    DodgeDC: 15,
    CritBonus: 0.5,
    CritRadius: 10,
    HSperTurn: 4,
    FullDodge: 5,
    NonTorsoDodge: 4,
    CounterTypes: {
        "Fire": "Water",
        "Metal": "Fire",
        "Wood": "Metal",
        "Earth": "Wood",
        "Water": "Earth",
        "Bind": "",
        "Drain": ""
    },
    CompoundTypes: {
        "Fire": "Earth",
        "Metal": "Water",
        "Wood": "Fire",
        "Earth": "Metal",
        "Water": "Wood"
    }
}

// state.HandoutSpellsNS["areaCount"] = {}


//------------------- casting functions ------------------------------------------------

async function formHandSeal(tokenId) {
    log('formHandSeal')
    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    hsPerTurn = getAttrByName(getCharFromToken(tokenId), "hsPerTurn")
    log(hsPerTurn)
    if(!hsPerTurn) hsPerTurn = state.HandoutSpellsNS.coreValues.HSperTurn;

    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Seals"]);
    var allSeals = spellStats["Seals"].split(",");

    if(casting.seals.length == 0){
        // forming first seal
        casting.seals = [...allSeals];
    }
    var seal = casting.seals.shift()

    // check if this is the last seal
    var lastSeal = 0;
    if(casting.seals.length == 0){
        lastSeal = 1;
    }
    // check if hand seals remain this turn
    var continueCast = 1;
    var bolster = "";
    _.each(state.HandoutSpellsNS.OnInit[tokenId].reactors, function(reactor){
        if(state.HandoutSpellsNS.OnInit[reactor].type == "Bolster" & bolster == ""){
            state.HandoutSpellsNS.turnActions[reactor].casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
            bolster = reactor;
        }
    });
    state.HandoutSpellsNS.turnActions[tokenId].castCount++
    if(state.HandoutSpellsNS.turnActions[tokenId].castCount >= hsPerTurn){
        if(bolster == ""){
            continueCast = 0;
        }
        else {
            continueCast = 2;
        }
    }

    const replacements = {
        "SEAL": seal,
        "SPELL": casting.spellName,
        "CURRENT": allSeals.length - casting.seals.length,
        "TOTAL": allSeals.length,
        "TOKEN": tokenId,
        "LAST": lastSeal,
        "DIFFICULTY": state.HandoutSpellsNS.coreValues.HandSealDC,
        "CONTINUE": continueCast,
        "BOLSTER": bolster
    }
    setReplaceMods(getCharFromToken(tokenId), "360")
    let spellString = await getSpellString("FormHandSeal", replacements);
    name = getObj("graphic", tokenId).get("name")

    sendChat(name, "!power " + spellString)
}

async function critHandSeal(tokenId){
    log('critHandSeal')

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;

    if(casting.seals.length < 2){
        log("critical cast")
        sendChat("", "!power --Critical Hand Seal:| Cast spell as a critical!")
        state.HandoutSpellsNS.crit[tokenId] = 1;
        selectTarget(tokenId)
    }
    else {
        log('reduce seals')
        casting.seals.shift()
        hsPerTurn = getAttrByName(getCharFromToken(tokenId), "hsPerTurn")
        if(!hsPerTurn) hsPerTurn = 20;

        name = getCharName(tokenId)
        if(state.HandoutSpellsNS.turnActions[tokenId].castCount < hsPerTurn){
            // continue casting
            sendChat("", '!power --whisper|"' + name + '" --Critical Hand Seal:| -1 Hand Seal to cast. [Form Seal](!FormHandSeal;;' + tokenId + ")")
        }
        else {
            sendChat("", '!power --whisper|"' + name + '" --Critical Hand Seal:| -1 Hand Seal to cast. Continue casting next turn.')
        }
    }
}

async function castTalisman(tokenId){
    log('castTalisman')

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;

    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Cost", "Magnitude", "Code"]);

    costs = {
        "Fire": 0,
        "Water": 0,
        "Earth": 0,
        "Metal": 0,
        "Wood": 0
    }

    icons = {
        "Fire": "https://github.com/TheScottishninja/Onmyoji/raw/main/icons/candlebright_small.png",
        "Water": "https://github.com/TheScottishninja/Onmyoji/raw/main/icons/water-drop_small.png",
        "Earth": "https://github.com/TheScottishninja/Onmyoji/raw/main/icons/peaks_small.png",
        "Metal": "https://github.com/TheScottishninja/Onmyoji/raw/main/icons/anvil_small.png",
        "Wood": "https://github.com/TheScottishninja/Onmyoji/raw/main/icons/beech_small.png"
    }

    canCast = true;
    newCurrent = {};
    if(state.HandoutSpellsNS.OnInit[tokenId].type != "Bolster"){

        scalingCosts = casting.scalingCosts.split(",");

        _.each(scalingCosts, function(cost){
            cost = cost.split(" ")
            if(cost.length > 1) costs[cost[1]] += parseInt(cost[0]);
        });

        baseCosts = spellStats["Cost"].split(",");

        _.each(baseCosts, function(cost){
            cost = cost.split(" ")
            if(cost.length > 1) costs[cost[1]] += parseInt(cost[0]);
        });

        // check inventory of talismans
    
        for (var cost in costs){
            currentInv = getAttrByName(getCharFromToken(tokenId), cost.toLowerCase() + "_current")
            if(parseInt(currentInv) >= costs[cost]){
                newCurrent[cost] = parseInt(currentInv) - costs[cost];
            }
            else{
                canCast = false;
            }
        }
    }

    if(!canCast){
        // sendChat("System", "Insufficient Talismans!!")
        WSendChat("System", tokenId, "Insufficient Talismans!!")
    }
    else{
        // get spell cast DC
        var castLvl = parseInt(spellStats["Magnitude"]) + parseInt(casting.scalingMagnitude) - parseInt(getAttrByName(getCharFromToken(tokenId), "Level"))
        var bolster = 0;
        if(state.HandoutSpellsNS.OnInit[tokenId].type == "Bolster"){
            bolster = -1;
        }
        else {
            _.each(state.HandoutSpellsNS.OnInit[tokenId].reactors, function(reactor){
                if(state.HandoutSpellsNS.OnInit[reactor].type == "Bolster")
                    bolster = -1;
            })
        }
        castLvl += bolster;
        log(castLvl)
        
        if (castLvl < 0) castLvl = 0;
        else if(castLvl > 5) {
            // sendChat("System", "Scaled Magnitude too great!!")
            WSendChat("System", tokenId, "Scaled Magnitude too great!!")
            return;
        }
        castDC = state.HandoutSpellsNS.coreValues.TalismanDC[castLvl];

        // remove consumed talimans
        for (var element in newCurrent){
            let currentInv = await getAttrObj(getCharFromToken(tokenId), element.toLowerCase() + "_current")
            currentInv.set("current", newCurrent[element])
        }

        costString = []
        for (var element in costs){
            if(costs[element] > 0) costString.push(costs[element] + ";" + "[x](" + icons[element] + ")")
            else costString.push(";" + "[x](" + icons[element] + ")")
        }
        
        costString = costString.join(";")

        replacements = {
            "PLACEHOLDER": casting.spellName,
            "COST": costString,
            "DIFFICULTY": castDC,
            "TOKEN": tokenId,
        }
        
        setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
        let spellString = await getSpellString("TalismanCast", replacements);
        name = getObj("graphic", tokenId).get("name")

        sendChat(name, "!power " + spellString)
    }
}

// ---------------- targeting --------------------------------

async function selectTarget(tokenId) {
    log('selectTarget')

    var countering = false;
    if(state.HandoutSpellsNS.OnInit[tokenId].type == "Counter"){
        castCounter(state.HandoutSpellsNS.OnInit[tokenId].target, tokenId)
        return
    }

    if(state.HandoutSpellsNS.OnInit[tokenId].type == "Bolster"){
        // if bolstering, original caster gets to target
        tokenId = state.HandoutSpellsNS.OnInit[tokenId].target
    }

    state.HandoutSpellsNS.OnInit[tokenId]["succeedCast"] = true;

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    if(_.isEmpty(casting)){
        log("channeled")
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel;

        let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType", "SpellType", "BodyTarget"]);

        bodyPart = spellStats["BodyTarget"];
        if(spellStats["SpellType"] == "Projectile"){
            bodyPart = "&#63;{Target Body Part|&#64;{target|body_parts}}";
        }
        else if(spellStats["SpellType"] == "Binding"){
            effectBind(tokenId, casting.defender)
            return
        }
        else if(spellStats["SpellType"] == "Exorcism"){
            effectExorcism(tokenId)
            return;
        }
        else if(spellStats["SpellType"] == "Stealth"){
            effectStealth(tokenId)
            return;
        }
        else if(spellStats["SpellType"] == "Barrier"){
            effectBarrier(tokenId)
            return;
        }


        var targetString = "";
        name = getObj("graphic", tokenId).get("name");
        if(spellStats["TargetType"].includes("Radius")) {
            // spell effect area
            targetString = '!AreaTarget;;' + tokenId + ";;" + bodyPart
        }
        else if(spellStats["TargetType"].includes("Single")) {
            // spell effect single target
            targetString = '!power --whisper|"' + name + '" --!target|~C[Select Target](!DefenseAction;;' + tokenId + ";;&#64;{target|token_id};;" + bodyPart + ")~C"
        }
        else {
            log("unhandled target type")
            return;
        }
    }

    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType", "SpellType", "BodyTarget", "DamageType"]);

    if(spellStats["SpellType"] == "Stealth"){
        effectStealth(tokenId)
        return;
    }

    bodyPart = spellStats["BodyTarget"];
    if(spellStats["SpellType"] == "Projectile"){
        bodyPart = "&#63;{Target Body Part|&#64;{target|body_parts}}";
    }

    var targetString = "";
    name = getObj("graphic", tokenId).get("name");
    if(spellStats["SpellType"] == "Spirit Flow"){
        targets = spellStats["TargetType"].split(",")
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

        targetString = '!power --whisper|"' + name + '" --!target|~C[Select Target](!FlowTarget;;' + tokenId + ";;" + attackString + ";;" + healString + ")~C"
        log(targetString)
    }

    else if(spellStats["TargetType"].includes("Radius")) {
        // spell effect area
        targetString = '!power --whisper|"' + name + '" --!target|~C[Select Target](!AreaTarget;;' + tokenId + ";;" + bodyPart + ")~C"
    }
    else if(spellStats["TargetType"].includes("Single")) {
        // spell effect single target
        targetString = '!power --whisper|"' + name + '" --!target|~C[Select Target](!DefenseAction;;' + tokenId + ";;&#64;{target|token_id};;" + bodyPart + ")~C"
    }
    else if(spellStats["TargetType"].includes("Line")){
        // spell effect line
        lineTarget(tokenId)
        targetString = '!power --whisper|"' + name + '" --Use Polyline draw tool to draw spell shape.| --!cast|~C[Cast Spell](!CastLine;;' + tokenId + ")~C"
    }
    else {
        log("unhandled target type")
        return;
    }

    log(state.HandoutSpellsNS.OnInit) 

    if(state.HandoutSpellsNS.OnInit[tokenId].reactors.length > 0){
        // allow for reactions before targetting
        var countered = false;
        _.each(state.HandoutSpellsNS.OnInit[tokenId].reactors, function(reactor){
            if(state.HandoutSpellsNS.OnInit[reactor].type == "Counter"){
                state.HandoutSpellsNS.OnInit[reactor]["attack"] = targetString;
                name = state.HandoutSpellsNS.OnInit[reactor].name
                countered = true
                // sendChat("System", '/w "' + name + '" ' + getCharName(tokenId) + " is casting a " + spellStats["DamageType"] + " spell. Cast your counter!")
                WSendChat("System", tokenId, getCharName(tokenId) + " is casting a " + spellStats["DamageType"] + " spell. Cast your counter!")
            }
        });
        if(countered) return;
    }

    // log(targetString)
    sendChat("System", targetString)
}

//------------------ compounding ------------------------------

// async function checkCompound(tokenId, targetId){
//     var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
//     if(_.isEmpty(casting)){casting = state.HandoutSpellsNS.turnActions[tokenId].channel;}

//     // check if target is a spell or has a living spell on them
//     target = getObj("graphic", targetId)
//     var targetType = ""
//     if(target.get("bar2_value") !== ""){
//         // creature token, check for status
//         targetType = "status"
//         statuses = state.HandoutSpellsNS.turnActions[targetId].statuses
//         if(_.isEmpty(statuses)) {return {};}

//         var types = {};
//         for(var status in statuses){
//             types[status] = statuses[status].damageType;
//         }
//     }
//     else {
//         // spell token, find type
//         targetType = "area"
//         var types = [];
//         if(targetId in state.HandoutSpellsNS.staticEffects){
//             types[targetId] = state.HandoutSpellsNS.staticEffects[targetId].damageType
//             targetType = "static"
//         }
//         else {
//             // look for channeled spell
//             for(var token in state.HandoutSpellsNS.turnActions){
//                 channeled = state.HandoutSpellsNS.turnActions[token].channel
//                 if("areaToken" in channeled){
//                     if(channeled.areaToken == targetId){
//                         let temp_spellStats = await getFromHandout("PowerCard Replacements", channeled.spellName, ["DamageType"]);
//                         types[token] = temp_spellStats["DamageType"]
//                     }
//                 }
//             }
//         }

//         if(types.length < 1){return {};}
//     }

//     let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["DamageType"]);

//     var compound = {};
//     for(var id in types){
//         if(state.coreValues.CompoundTypes[types[id]] == spellStats["DamageType"]){
//             // compounding occurs
//             compound = {
//                 "SpellType": targetType,
//                 "id": id,
//                 "reaction": "generate"
//             }
//         }
//         if(state.coreValues.CounterTypes[types[id]] == spellStats["DamageType"]){
//             // compounding occurs
//             compound = {
//                 "SpellType": targetType,
//                 "id": id,
//                 "reaction": "cancel"
//             }
//         }
//     }

//     return compound

// }

// async function getCompoundMag(target, compound){
//     if(compound.SpellType == "status"){
//         statuses = state.HandoutSpellsNS.turnActions[target].statuses
//         targetStatus = statuses[compound.id]
//         return targetStatus.magnitude;
//     }
//     else if(compound.SpellType == "area"){
//         channeled = state.HandoutSpellsNS.turnActions[compound.id].channel
//         let channelStats = await getFromHandout("PowerCard Replacements", channeled.spellName, ["Magnitude"]);
//         return channeled.scalingMagnitude + parseInt(channelStats["Magnitude"])
//     }
//     else{
//         //static effect
//         static = state.HandoutSpellsNS.staticEffects[compound.id]
//         return static.magnitude;
//     }
// }

// function compoundCancel(target, compound){
//     if(compound.SpellType == "static"){
//         token = getObj("graphic", compound.id)
//         token.remove()
//         delete state.HandoutSpellsNS.staticEffects[compound.id]
//     }
//     else if(compound.SpellType == "status"){
//         targetObj = getObj("graphic", target)
//         currentStatus = targetObj.get("statusmarkers").split(",")
//         idx = currentStatus.indexOf(compound.id)
//         newStatus = currentStatus.splice(idx, 1)
//         delete state.HandoutSpellsNS.turnActions[target].statuses[compound.id]
//         targetObj.set("statusmarkers", newStatus.join(","))
//     }
//     else {
//         // area effect
//         cancelSpell(target)
//     }
// }

// async function effectCompound(tokenId, target){
//     log("effectCompound")

//     var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
//     if(_.isEmpty(casting)){
//         casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
//     }

//     let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType", "Magnitude", "DamageType"]);

//     // handle crits

//     // generating or cancelling
//     if(compound.reaction == "generate"){
//     // get magnitude of target
//         targetMag = getCompoundMag(target, compound)
//         log(targetMag)

//         if(spellStats["SpellType"] == "Area"){
//             // set compound attribute
//             let compoundMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ19_temp_compound")
//             compoundMagObj.set("current", targetMag)

//             // set condition flag
//             casting["Condition"] = 9

//             // remove consumed spell
//             compoundCancel(target, compound)
//         }
//         else if(spellStats["SpellType"] == "Projectile"){
//             if(compound.SpellType == "Area"){
//                 let compoundMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_compound")
//                 compoundMagObj.set("current", targetMag)

//                 state.HandoutSpellsNS.turnActions[compound.id].channel[]
//             }

//         }
//     }
// }

//------------------ reactions --------------------------------

async function castCounter(tokenId, reactor) {
    log("castCounter")

    counterSpell = state.HandoutSpellsNS.turnActions[reactor].casting
    let counterSpellStats = await getFromHandout("PowerCard Replacements", counterSpell.spellName, ["DamageType", "Magnitude", "Code"])

    mainSpell = state.HandoutSpellsNS.turnActions[tokenId].casting
    let mainSpellStats = await getFromHandout("PowerCard Replacements", mainSpell.spellName, ["DamageType", "Magnitude", "Code"])
    
    // check the type is a counter
    if(state.HandoutSpellsNS.coreValues.CounterTypes[mainSpellStats["DamageType"]] == counterSpellStats["DamageType"] | 
        state.HandoutSpellsNS.coreValues.CounterTypes[mainSpellStats["DamageType"]] == ""){
        log("getting counter mag")
        counterCode = replaceDigit(counterSpellStats["Code"], 4, "1")
        counterCode = replaceDigit(counterCode, 5, "8")
        rollCount = 0 + getMods(getCharFromToken(reactor), counterCode)[0].reduce((a, b) => a + b, 0)
        baseMag = parseInt(counterSpellStats["Magnitude"])
        if(state.HandoutSpellsNS.crit[reactor] == 1) baseMag = Math.ceil(parseInt(counterSpellStats["Magnitude"]) * (1 + state.HandoutSpellsNS.coreValues.CritBonus))
        counterMag = counterSpell.scalingMagnitude + baseMag + rollCount
    }
    else {
        // sendChat("", "Countered with the wrong type!!")
        WSendChat("System", tokenId, "Countered with the wrong type!!")
        counterMag = 0;
    }

    // remove counter from the list
    idx = state.HandoutSpellsNS.OnInit[tokenId].reactors.indexOf(reactor)
    state.HandoutSpellsNS.OnInit[tokenId].reactors.splice(idx, 1)

    // if all reactors cast, resolve the counter
    if(state.HandoutSpellsNS.OnInit[tokenId].reactors.length < 1){
        // if counter mag > spell mag, fully counter the spell
        rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(mainSpellStats["Code"], 4, "1"))[0].reduce((a, b) => a + b, 0)
        baseMag = parseInt(mainSpellStats["Magnitude"])
        if(state.HandoutSpellsNS.crit[tokenId] == 1) baseMag = Math.ceil(parseInt(mainSpellStats["Magnitude"]) * (1 + state.HandoutSpellsNS.coreValues.CritBonus))
        mainMag = parseInt(mainSpell.scalingMagnitude) + baseMag + parseInt(rollCount)

        // add counter as temp subtraction to caster spell
        let counterMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_counterspell")
        if(counterMagObj.get("current") == "") counterMagObj.set("current", 0)
        counterMagObj.set("current", -1*counterMag + parseInt(counterMagObj.get("current")))

        log(counterMagObj)

        replacements = {
            "ATTACKER": getObj("graphic", tokenId).get("name"),
            "DEFENDER": getObj("graphic", reactor).get("name"),
            "COUNTER": -1* parseInt(counterMagObj.get("current")),
            "MAGNITUDE": mainMag 
        }

        let spellString = await getSpellString("CounterSpell", replacements)
        name = getCharFromToken(reactor)
        sendChat(name, "!power " + spellString)

        // counter is negative
        if(-1* parseInt(counterMagObj.get("current")) >= mainMag){
            counterMagObj.set("current", 0)
        }
        else {
            // continue with casting the spell
            txt = state.HandoutSpellsNS.OnInit[reactor].attack
            log(txt)
            sendChat("", txt) // this currently outputs first
        }
    }
    else {
        // add counter as temp subtraction to caster spell
        let counterMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_counterspell")
        if(counterMagObj.get("current") == "") counterMagObj.set("current", 0)
        counterMagObj.set("current", -1*counterMag + parseInt(counterMagObj.get("current")))

        log(counterMagObj)
    }
}

// ----------------- defense actions ---------------------------

async function defenseAction(tokenId, defenderId, bodyPart){
    log("defenseAction")

    faceTarget(tokenId, defenderId)
    // faceTarget(defenderId, tokenId)

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    if(_.isEmpty(casting)){
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
    }
    else {
        casting["bodyPart"] = bodyPart;    
    }

    // compound = checkCompound(tokenId, defenderId)
    // if(!_.isEmpty(compound)){
    //     effectCompound(tokenId, compound)
    //     return;
    // }

    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType"]);

    if(spellStats["SpellType"] == "Exorcism"){
        effectExorcism(tokenId)
        return;
    }

    if(defenderId == ""){
        // area with no targets
        effectArea(tokenId, "", "")
        return;
    }

    name = getObj("graphic", defenderId).get("name")
    if(!name.includes("Dummy")){
        log("normal")

        dodgeHit = 0;
        if(spellStats["SpellType"] == "Area") dodgeHit = 1;

        remainingDodges = getAttrByName(getCharFromToken(defenderId), "Dodges")
        var followUp = false;
        if(state.HandoutSpellsNS.OnInit[tokenId].type == "Follow"){
            ally = state.HandoutSpellsNS.OnInit[tokenId].target
            if(state.HandoutSpellsNS.OnInit[ally].succeedCast) followUp = true;
        }

        dodgeString = "";
        if(remainingDodges > 0 & !followUp) dodgeString = "[Dodge](!Dodge;;" + tokenId + ";;" + defenderId + ";;" + dodgeHit + ")"

        wardString = "[Ward](!Ward;;" + tokenId + ";;" + defenderId + ")"
        hitString = "[Take Hit](!TakeHit;;" + tokenId + ";;" + defenderId + ")"

        // sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)
        WSendChat("System", defenderId, dodgeString + wardString + hitString)
    }
    else {
        log("dummy")
        wardSpell(tokenId, defenderId)
    }

}

async function wardSpell(tokenId, defenderId){
    log("ward")

    name = getObj("graphic", defenderId).get("name")
    sendChat("System", name + " wards the attack!")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    if(_.isEmpty(casting)){
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
    }
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType"]);

    if(spellStats["SpellType"] == "Area"){
        // area spell effect
        effectArea(tokenId, defenderId, 0)
    }
    else if(spellStats["SpellType"] == "Projectile"){
        // projectile spell effect
        effectProjectile(tokenId, defenderId, 0)
    }
    else if(spellStats["SpellType"] == "Binding"){
        // projectile spell effect
        effectBind(tokenId, defenderId)
    }
    else if(spellStats["SpellType"] == "Spirit Flow"){
        // spirit flow spell effect
        effectSpiritFlow(tokenId, defenderId)
    }
    else {
        // living spell effect
        effectLiving(tokenId, defenderId, 0)
    }
}

async function takeHit(tokenId, defenderId){
    log("takeHit")

    name = getObj("graphic", defenderId).get("name")
    sendChat("System", name + " takes the attack!")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    if(_.isEmpty(casting)){
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
    }
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType"]);

    if(spellStats["SpellType"] == "Area"){
        // area spell effect
        effectArea(tokenId, defenderId, 2)
    }
    else if(spellStats["SpellType"] == "Projectile"){
        // projectile spell effect
        effectProjectile(tokenId, defenderId, 2)
    }
    else if(spellStats["SpellType"] == "Binding"){
        // projectile spell effect
        effectBind(tokenId, defenderId)
    }
    else if(spellStats["SpellType"] == "Spirit Flow"){
        // spirit flow spell effect
        effectSpiritFlow(tokenId, defenderId)
    }
    else {
        // living spell effect
        effectLiving(tokenId, defenderId, 2)
    }
}

async function dodge(tokenId, defenderId){
    log("dodge")

    name = getObj("graphic", defenderId).get("name")
    
    let dodgeObj = await getAttrObj(getCharFromToken(defenderId), "Dodges");
    log(dodgeObj)
    dodgeObj.set("current", parseInt(dodgeObj.get("current")) - 1)

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    if(_.isEmpty(casting)){
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
    }
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType", "Code"]);

    if(spellStats["SpellType"] == "Area"){
        // area spell effect
        command = "EffectArea"
        areaDodge = 1
    }
    else if(spellStats["SpellType"] == "Projectile"){
        // projectile spell effect
        command = "EffectProjectile"
        areaDodge = 0
    }
    else if(spellStats["SpellType"] == "Binding"){
        command = "EffectBind"
        areaDodge = 0
    }
    else if(spellStats["SpellType"] == "Spirit Flow"){
        // spirit flow spell effect
        command = "EffectSpiritFlow"
        areaDodge = 0
    }
    else {
        // living spell effect
        command = "EffectLiving"
        areaDodge = 0
    }


    var fullDodge = 0;
    // maybe change to a char stat
    if(state.HandoutSpellsNS.OnInit[defenderId].type == "Defense") fullDodge = state.HandoutSpellsNS.coreValues.FullDodge

    var torsoMod = 0;
    
    if(!casting.bodyPart.includes("Torso")) torsoMod = state.HandoutSpellsNS.NonTorsoDodge
    log(torsoMod)

    replacements = {
        "DEFENDER": name,
        "AGILITY": getAttrByName(getCharFromToken(defenderId), "Agility"),
        "ATTACKER": tokenId,
        "TARGET": defenderId,
        "COMMAND": command,
        "AREADODGE": areaDodge,
        "DIFFICULTY": state.HandoutSpellsNS.coreValues.DodgeDC,
    }

    setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
    let spellString = await getSpellString("Dodge", replacements);

    sendChat(name, "!power " + spellString)
}

// ----------------- spell effects ------------------------------
async function effectSpiritFlow(tokenId, attackId){
    log("effectSpiritFlow")

    state.HandoutSpellsNS.areaCount[tokenId] += 1
    log(state.HandoutSpellsNS.areaCount[tokenId])
    if(state.HandoutSpellsNS.areaCount[tokenId] >= state.HandoutSpellsNS.targets[tokenId].length){
        var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
        let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "BaseDamage", "BodyTarget", "DamageType"]);

        let critMagObj = await getAttrObj(getCharFromToken(tokenId), "1Z6Z1Z_crit_flow_mag")

        if(state.HandoutSpellsNS.crit[tokenId] >= 1){
            baseMag = parseInt(spellStats["Magnitude"])
            critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
            
            critMagObj.set("current", critMag)
            state.HandoutSpellsNS.crit[tokenId] -= 1 
        }

        if(spellStats["Code"].length > 3){digit = 4}
        else {digit = 2}

        
        
        rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], digit, "1"))[0].reduce((a, b) => a + b, 0)
        rollDie = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], digit, "2"))[0].reduce((a, b) => a + b, 0)
        rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], digit, "3"))[0].reduce((a, b) => a + b, 0)
        let damage = await attackRoller("[[(" + spellStats["Magnitude"] + "+" + rollCount + "+" + casting.scalingMagnitude + ")d(" + spellStats["BaseDamage"] + "+" + rollDie + ")+" + rollAdd + "]]")
        log(damage)

        // apply damage to targets
        targets = state.HandoutSpellsNS.targets[tokenId];
        _.each(targets, function(target){
            applyDamage(target, damage[1], spellStats["DamageType"], spellStats["BodyTarget"], 0)
        });
        totalDamage = targets.length * damage[1]
        
        // apply healing
        // healTargets = [...new Set(casting.healTargets)];
        healTargets = casting.healTargets
        healPer = Math.ceil(totalDamage / healTargets.length)
        damagePer = "[[" + damage[0] + "]]"
        healString = "ceil(" + totalDamage + "/" + healTargets.length + ")"
        if(targets.length == 0){
            // no damage, so apply damage directly to heal targets
           healPer = damage[1]
           healString = damage[0]
           damagePer = ""
        }
    
        _.each(healTargets, function(target){
            applyDamage(target, healPer, "Heal", spellStats["BodyTarget"], 0)
        })
        
        
        allTargets = [...healTargets]
        allTargets.push(...targets)

        replacements = {
            "PLACEHOLDER": casting.spellName,
            "TARGETS": allTargets.join(" | "),
            "RECOVER": healString,
            "DAMAGE": damagePer,
            "HEALCOUNT": healTargets.length,
            "ATTACKCOUNT": targets.length
        }
        log(replacements)
        setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
        let spellString = await getSpellString("SpiritFlowEffect", replacements)
        log(spellString)
        sendChat(name, "!power " + spellString)

        critMagObj.set("current", 0)
        state.HandoutSpellsNS.areaCount[tokenId] = 0
    }   
}

async function effectExorcism(tokenId){
    log("effectExorcism")
    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;

    var channeled = false
    if(_.isEmpty(casting)){
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
        channeled = true
    }
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "TargetType", "BaseDamage", "BodyTarget", "DamageType"]);
    var tokenObj = getObj("graphic", tokenId)

    let critMagObj = await getAttrObj(getCharFromToken(tokenId), "1Z4Z1Z_crit_exor_mag")
    var radius = parseInt(spellStats["TargetType"].split(" ")[1])
    if(state.HandoutSpellsNS.crit[tokenId] == 1){
        baseMag = parseInt(spellStats["Magnitude"])
        critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        
        critMagObj.set("current", critMag)
        radius += state.HandoutSpellsNS.coreValues.CritRadius;
        state.HandoutSpellsNS.crit[tokenId] = 0;
    }

    if(!channeled){
        page = getObj("page", tokenObj.get("pageid"))
        var gridSize = 70 * parseFloat(page.get("snapping_increment"));
        var pixelRadius = gridSize * radius / 5;

        let spellHandout = findObjs({_type: "handout", name: casting.spellName})[0];
        var imgsrc = spellHandout.get("avatar")
        imgsrc = imgsrc.replace("max", "thumb")
        log(imgsrc)

        // create area token
        // var playerId = tokenObj.get("controlledby");
        
        createObj("graphic", 
        {
            controlledby: "",
            left: state.HandoutSpellsNS.targetLoc[1],
            top: state.HandoutSpellsNS.targetLoc[0],
            width: pixelRadius*2,
            height: pixelRadius*2,
            name: tokenId,
            pageid: tokenObj.get("pageid"),
            imgsrc: imgsrc,
            layer: "objects",
            bar1_value: casting.spellName,
        });

        target = findObjs({_type: "graphic", name: tokenId})[0];
        toBack(target);
        casting["areaToken"] = target.get("id");
        faceTarget(tokenId, target.get("id"))

        state.HandoutSpellsNS.turnActions[tokenId].channel = state.HandoutSpellsNS.turnActions[tokenId].casting
        log(state.HandoutSpellsNS.targets[tokenId].length )
        if(state.HandoutSpellsNS.targets[tokenId].length > 0){
            _.each(state.HandoutSpellsNS.targets[tokenId], function(target){
                getObj("graphic", target).set("tint_color", "#ffe599")
            });
        }

    }

    rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "1"))[0].reduce((a, b) => a + b, 0)
    rollDie = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "2"))[0].reduce((a, b) => a + b, 0)
    rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "3"))[0].reduce((a, b) => a + b, 0)
    
    let damage = await attackRoller("[[(" + spellStats["Magnitude"] + "+" + rollCount + ")*(" + spellStats["BaseDamage"] + "+" + rollDie + ")+" + rollAdd + "]]")
    log(damage)

    // spell output
    replacements = {
        "PLACEHOLDER": casting.spellName,
        "RADIUS": radius,
        "ROLLDAMAGE": damage[0]
    }

    setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
    let spellString = await getSpellString("ExorcismEffect", replacements)
    log(spellString)
    sendChat(name, "!power " + spellString)

    critMagObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)

    state.HandoutSpellsNS.staticEffects[target.get("id")] = {
            "name": casting.spellName,
            "effectType": "Exorcism",
            "magnitude": parseInt(spellStats["Magnitude"]) + rollCount,
            "damage": damage[1],
            "damageType": spellStats["DamageType"],
            "radius": radius,
            "pageid": target.get("pageid")
        }
    state.HandoutSpellsNS.turnActions[tokenId].casting = {} 

}

async function effectBind(tokenId, defenderId){
    log("effectBind")
    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;

    if(_.isEmpty(casting)){
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
        sendChat("System", "Channeling **" + casting.spellName + "**")
        return;
    }
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "TargetType", "BaseDamage", "BodyTarget"]);

    let critMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZ61Z_crit_bind_mag")
    
    if(state.HandoutSpellsNS.crit[tokenId] == 1){
        baseMag = parseInt(spellStats["Magnitude"])
        critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        
        critMagObj.set("current", critMag)
        state.HandoutSpellsNS.crit[tokenId] = 0 
    }

    rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "1"))[0].reduce((a, b) => a + b, 0)
    rollDie = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "2"))[0].reduce((a, b) => a + b, 0)
    rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "3"))[0].reduce((a, b) => a + b, 0)
    let damage = await attackRoller("[[(" + spellStats["Magnitude"] + "+" + rollCount + "+" + casting.scalingMagnitude + ")d(" + spellStats["BaseDamage"] + "+" + rollDie + ")+" + rollAdd + "]]")
    log(damage)

    blocking = checkBarriers(tokenId, defenderId)
    reductions = barrierReduce(tokenId, defenderId, damage[1], blocking)
    damage[1] = reductions[0]
    log(damage)
    if(blocking.length > 0){targetName = "Barrier"}
    else {targetName = getObj("graphic", defenderId).get("name")}

     // spell output
    replacements = {
        "TARGET": targetName,
        "PLACEHOLDER": casting.spellName,
        "SCALING": casting.scalingMagnitude,
        "ROLLDAMAGE": damage[0]
    }

    setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
    let spellString = await getSpellString("BindEffect", replacements)
    sendChat(name, "!power " + spellString)

    applyDamage(defenderId, damage[1], "Bind", spellStats["BodyTarget"], 0)

    state.HandoutSpellsNS.turnActions[tokenId].channel = state.HandoutSpellsNS.turnActions[tokenId].casting
    state.HandoutSpellsNS.turnActions[tokenId].channel["damage"] = damage[1]
    state.HandoutSpellsNS.turnActions[tokenId].channel["defender"] = defenderId
    state.HandoutSpellsNS.turnActions[tokenId].casting = {}

    critMagObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)
}

async function effectArea(tokenId, defenderId, dodged){
    // incoming flag for is the defender successfully dodged. They will take half damage
    log("effectArea")
    state.HandoutSpellsNS.areaCount[tokenId] += 1;
    if(defenderId != "") state.HandoutSpellsNS.areaDodge[defenderId] = dodged;
    log(state.HandoutSpellsNS.targets[tokenId].length)
    log(state.HandoutSpellsNS.areaCount[tokenId])
    if(parseInt(getAttrByName(getCharFromToken(tokenId), "spirit")) == 0){
        // sendChat("System", "Cannot cast spells when spirit is depleted!")
        sendChat("System", tokenId, "Cannot cast spells when spirit is depleted!")
        return;
    }
    if(state.HandoutSpellsNS.areaCount[tokenId] >= state.HandoutSpellsNS.targets[tokenId].length) {
        log("in area")
        var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
        var channeled = false
        if(_.isEmpty(casting)){
            casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
            channeled = true
        }
        let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "TargetType", "BaseDamage", "BodyTarget", "DamageType"]);
        var tokenObj = getObj("graphic", tokenId)

        let critMagObj = await getAttrObj(getCharFromToken(tokenId), "1Z2Z1Z_crit_area_mag")
        var radius = parseInt(spellStats["TargetType"].split(" ")[1])
        if(state.HandoutSpellsNS.crit[tokenId] == 1){
            baseMag = parseInt(spellStats["Magnitude"])
            critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
            
            critMagObj.set("current", critMag)
            radius += state.HandoutSpellsNS.coreValues.CritRadius;
            state.HandoutSpellsNS.crit[tokenId] = 0;
        }

        if(!channeled){
            page = getObj("page", tokenObj.get("pageid"))
            var gridSize = 70 * parseFloat(page.get("snapping_increment"));
            var pixelRadius = gridSize * radius / 5;

            let spellHandout = findObjs({_type: "handout", name: casting.spellName})[0];
            var imgsrc = spellHandout.get("avatar")
            imgsrc = imgsrc.replace("max", "thumb")
            log(imgsrc)

            // create area token
            // var playerId = tokenObj.get("controlledby");
            
            createObj("graphic", 
            {
                controlledby: "",
                left: state.HandoutSpellsNS.targetLoc[1],
                top: state.HandoutSpellsNS.targetLoc[0],
                width: pixelRadius*2,
                height: pixelRadius*2,
                name: tokenId,
                pageid: tokenObj.get("pageid"),
                imgsrc: imgsrc,
                layer: "objects",
                bar1_value: casting.spellName,
            });

            target = findObjs({_type: "graphic", name: tokenId})[0];
            toBack(target);
            casting["areaToken"] = target.get("id");
            faceTarget(tokenId, target.get("id"))

            state.HandoutSpellsNS.turnActions[tokenId].channel = state.HandoutSpellsNS.turnActions[tokenId].casting
            state.HandoutSpellsNS.turnActions[tokenId].casting = {}
        }
        else {
            log("move token")
            areaToken = getObj("graphic", casting["areaToken"])
            areaToken.set({
                "top": state.HandoutSpellsNS.targetLoc[0],
                "left": state.HandoutSpellsNS.targetLoc[1]
            });
        }

        rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "1"))[0].reduce((a, b) => a + b, 0)
        rollDie = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "2"))[0].reduce((a, b) => a + b, 0)
        rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "3"))[0].reduce((a, b) => a + b, 0)
        let damage = await attackRoller("[[(" + spellStats["Magnitude"] + "+" + rollCount + "+" + casting.scalingMagnitude + ")d(" + spellStats["BaseDamage"] + "+" + rollDie + ")+" + rollAdd + "]]")
        log(damage)

        // spell output
        replacements = {
            "TARGETS": state.HandoutSpellsNS.targets[tokenId].join(" | "),
            "PLACEHOLDER": casting.spellName,
            "RADIUS": radius,
            "TARGETCOUNT": state.HandoutSpellsNS.targets[tokenId].length,
            "SCALING": casting.scalingMagnitude,
            "ROLLDAMAGE": damage[0]
        }

        setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
        let spellString = await getSpellString("AreaEffect", replacements)
        sendChat(name, "!power " + spellString)

        critMagObj.set("current", 0)
        let counterMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_counterspell")
        counterMagObj.set("current", 0)

        log(state.HandoutSpellsNS.areaDodge)
        var barriers = {};
        for(var target in state.HandoutSpellsNS.areaDodge){
            newDamage = damage[1]
            // check barrier blocked targets
            if(state.HandoutSpellsNS.blockedTargets[tokenId].includes(target)){
                blocking = checkBarriers(tokenId, target)
                for(var barrier in blocking){
                    if(barrier in barriers){
                        // already applied damage to the barrier
                        newDamage = Math.max(0, newDamage - barriers[barrier])
                        blocking.splice(blocking.indexOf(barrier))
                    }
                }

                // new barriers, reduce damage
                newBarriers = barrierReduce(tokenId, target, newDamage, blocking)
                newDamage = newBarriers[0]
                barriers = {...barriers, ...newBarriers[1]};
            }

            applyDamage(target, newDamage, spellStats["DamageType"], spellStats["BodyTarget"], state.HandoutSpellsNS.areaDodge[target])
            
        }

        state.HandoutSpellsNS.areaDodge = {};

    }
}

async function effectProjectile(tokenId, defenderId, hit){
    // hit flag == 2 when take hit
    log("effectProjectile")

    faceTarget(defenderId, tokenId)

    name = getObj("graphic", tokenId).get("name")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "BaseDamage", "DamageType", "BodyTarget"]);

    let critMagObj = await getAttrObj(getCharFromToken(tokenId), "1Z1Z1Z_crit_proj_mag")
    let critPierceObj = await getAttrObj(getCharFromToken(tokenId), "1Z1Z6Z_crit_proj_pierce")

    if(state.HandoutSpellsNS.crit[tokenId] == 1){
        baseMag = parseInt(spellStats["Magnitude"])
        critMag = Math.ceil(baseMag * state.HandoutSpellsNS.coreValues.CritBonus)
        critPierce = 1.0 - state.HandoutSpellsNS.coreValues.Pierce
        
        critMagObj.set("current", critMag)
        critPierceObj.set("current", critPierce)
        state.HandoutSpellsNS.crit[tokenId] = 0 
    }

    rollCount = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "1"))[0].reduce((a, b) => a + b, 0)
    rollDie = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "2"))[0].reduce((a, b) => a + b, 0)
    rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "3"))[0].reduce((a, b) => a + b, 0)
    pierce = state.HandoutSpellsNS.coreValues.Pierce + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "6"))[0].reduce((a, b) => a + b, 0)
    normal = 1.0 - pierce
    let damage = await attackRoller("[[(" + spellStats["Magnitude"] + "+" + rollCount + "+" + casting.scalingMagnitude + ")d(" + spellStats["BaseDamage"] + "+" + rollDie + ")+" + rollAdd + "]]")
    log(damage)

    blocking = checkBarriers(tokenId, defenderId)
    reductions = barrierReduce(tokenId, defenderId, damage[1], blocking)
    damage[1] = reductions[0]
    log(damage)

    replacements = {
        "PLACEHOLDER": casting.spellName,
        "TARGET": getObj("graphic", defenderId).get("name"),
        "BODYPART": casting.bodyPart,
        "SCALING": casting.scalingMagnitude,
        "NORMALD": "ceil((" + damage[0] + ")*" + normal + ")",
        "PIERCED": "floor((" + damage[0] + ")*" + pierce + ")",
    }


    setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
    let spellString = await getSpellString("ProjectileEffect", replacements)
    sendChat(name, "!power " + spellString)

    critMagObj.set("current", 0)
    critPierceObj.set("current", 0)
    let counterMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)

    // deal auto damage
    applyDamage(defenderId, Math.ceil(damage[1] * normal), spellStats["DamageType"], casting.bodyPart, hit)
    applyDamage(defenderId, Math.floor(damage[1] * pierce), "Pierce", casting.bodyPart, hit)

    state.HandoutSpellsNS.turnActions[tokenId].casting = {}
}

async function effectLiving(tokenId, defenderId, hit){
    // hit flag == 2 when take hit
    log("effectLiving")

    name = getObj("graphic", tokenId).get("name")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "Status", "Duration", "BaseDamage", "DamageType", "BodyTarget"]);

    var repeat = 1
    if(state.HandoutSpellsNS.crit[tokenId] == 1) repeat = 2;

    blocking = checkBarriers(tokenId, defenderId)
    if(blocking.length > 0){
        target = findObjs({
            _type: "graphic",
            name: blocking[0]
        })[0]
        targetName = "Barrier"
    }
    else {
        target = getObj("graphic", defenderId)
        targetName = target.get("name")
    }
    targetId = target.get("id")

    // get current statuses
    currentStatus = target.get("statusmarkers")
    currentStatus = currentStatus.split(",")

    for (var i = 0; i < repeat; i++) {
        // get spell duration
        rollAdd = 0 + getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "3"))[0].reduce((a, b) => a + b, 0)
        let duration = await attackRoller("[[" + spellStats["Duration"] + "+" + rollAdd.toString() + "]]")
        allMarkers = JSON.parse(Campaign().get("token_markers"));
        statusCode = "";
        _.each(allMarkers, function(marker){
            if(marker.name == spellStats["Status"]) statusCode = marker.tag
        });
        log(duration)
        statusId = statusCode + "@" + duration[1].toString()

        // check if defender has existing status of same type
        idx = 0;
        log(state.HandoutSpellsNS.turnActions[targetId])
        statusObj = state.HandoutSpellsNS.turnActions[targetId].statuses;
        
        for (var status in statusObj){
            if (status.includes(statusId)){
                statusIdx = parseInt(status.split("_")[1])
                if (statusIdx >= idx) idx = startIdx + 1;
            }
        }

        // add status to state

        rollCount = getMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 4, "1"))[0].reduce((a, b) => a + b, 0)
        totalMag = parseInt(spellStats["Magnitude"]) + rollCount + parseInt(casting.scalingMagnitude);
        statusObj[statusId + "_" + idx.toString()] = {
            "spellName": casting.spellName,
            "damageTurn": parseInt(spellStats["BaseDamage"]),
            "magnitude": totalMag,
            "damageType": spellStats["DamageType"],
            "bodyPart": spellStats["BodyTarget"]
        }

        // add status marker
        currentStatus.push(statusId)

        // output power card
        replacements = {
            "PLACEHOLDER": casting.spellName,
            "STATUS": spellStats["Status"],
            "SCALE": casting.scalingMagnitude,
            "TARGET": targetName,
            "DURATION": duration[0]
        }
        
        setReplaceMods(getCharFromToken(tokenId), spellStats["Code"])
        let spellString = await getSpellString("LivingEffect", replacements)
        sendChat(name, "!power " + spellString)
    }
    
    target.set("statusmarkers", currentStatus.join(","))
    state.HandoutSpellsNS.crit[tokenId] = 0;
    let counterMagObj = await getAttrObj(getCharFromToken(tokenId), "1ZZZ1Z_temp_counterspell")
    counterMagObj.set("current", 0)
}

//---------------channeling----------------------------------------

async function channelSpell(tokenId, cancel){
    log("channelSpell")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Magnitude", "Code", "SpellType"]);

     // get spell cast DC
    castLvl = parseInt(spellStats["Magnitude"]) + parseInt(casting.scalingMagnitude) - parseInt(getAttrByName(getCharFromToken(tokenId), "Level"))
    
    if (castLvl < 0) castLvl = 0;
    else if(castLvl > 6) {
        sendChat("System", "Scaled Magnitude too great!!")
        return;
    }
    castDC = state.HandoutSpellsNS.coreValues.TalismanDC[castLvl];
    if(spellStats["SpellType"] != "Area" & cancel == 1){
        castDC = 0;
    }

    replacements = {
        "PLACEHOLDER": casting.spellName,
        "CONCENTRATION": getAttrByName(getCharFromToken(tokenId), "Concentration"),
        "DIFFICULTY": castDC,
        "TOKEN": tokenId,
    }

    if(cancel == 1){
        setReplaceMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 5, "7"))
        let spellString = await getSpellString("CancelSpell", replacements)
    }
    else {
        setReplaceMods(getCharFromToken(tokenId), replaceDigit(spellStats["Code"], 5, "6"))
        let spellString = await getSpellString("ChannelSpell", replacements)
    }
    log(spellString)
    sendChat(getObj("graphic", tokenId).get("name"), "!power " + spellString)
}

async function cancelSpell(tokenId){
    log("cancelSpell")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].channel;
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType", "BodyTarget"]);
    if(spellStats["SpellType"] == "Area"){
        log("remove area")
        var areaToken = getObj("graphic", casting.areaToken)
        log(areaToken)
        // remove spell
        areaToken.remove();
    }
    else if (spellStats["SpellType"] == "Exorcism"){
        log("remove exorcism")
        var areaToken = getObj("graphic", casting.areaToken)
        log(areaToken)
        // remove spell
        areaToken.remove();
        delete state.HandoutSpellsNS.staticEffects[casting.areaToken]
    }
    else if(spellStats["SpellType"] == "Stealth"){
        removeStealth(tokenId)
        return;
    }

    else if(spellStats["SpellType"] == "Barrier"){
        log("remove barrier")
        var lineToken = getObj("graphic", casting.lineToken)
        var line = getObj("path", casting.line)
        lineToken.remove()
        line.remove()
    }

    else {
        log("cancel binding")
        applyDamage(casting.defender, -casting.damage, "Bind", spellStats["BodyTarget"], 0)
    }
    
    state.HandoutSpellsNS.turnActions[tokenId].channel = {};
    state.HandoutSpellsNS.crit[tokenId] = 0;
}

// state.HandoutSpellsNS.areaDodge = {};

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    // var args = msg.content.split(/\s+/);
    var args = msg.content.split(";;");
    
    if (msg.type == "api" && msg.content.indexOf("!Test") !== -1 && msg.who.indexOf("(GM)")){
        
        state.HandoutSpellsNS.turnActions[args[1]].casting = {
            "spellName": "Water Spear",
            "scalingMagnitude": "",
            "scalingCosts": "",
            "seals": [],
        };
        
        formHandSeal(args[1])
    }

    if (msg.type == "api" && msg.content.indexOf("!AddTurnCasting") === 0){
        log(args)
        // tokenId = args[1];
        tokenId = getTokenId(msg)
        if(!tokenId){return}
        spellName = args[1];

        var currentSpirit = getAttrByName(getCharFromToken(tokenId), "spirit")
        if(parseInt(currentSpirit) == 0){
            sendChat("System", "Spirit is depleted!! Cannot cast new spells!")
            return;
        }

        let spellStats = await getFromHandout("PowerCard Replacements", spellName, ["ResourceType", "ScalingCost", "SpellType"]);
        
        if(spellStats["ResourceType"].includes("HS")){
            castCount = state.HandoutSpellsNS.turnActions[tokenId].castCount;
            hsPerTurn = getAttrByName(getCharFromToken(tokenId), "hsPerTurn")
            if(!hsPerTurn) hsPerTurn = state.HandoutSpellsNS.coreValues.HSperTurn;;

            if(castCount >= hsPerTurn){
                sendChat("", "All hand seals used for this turn. Cannot start casting a new spell.")
                return;
            }

            state.HandoutSpellsNS.turnActions[tokenId].casting["spellName"] = spellName;
            state.HandoutSpellsNS.turnActions[tokenId].casting["scalingMagnitude"] = 0;
            state.HandoutSpellsNS.turnActions[tokenId].casting["scalingCosts"] = "";
            state.HandoutSpellsNS.turnActions[tokenId].casting["seals"] = [];

            if(spellStats["SpellType"] == "Stealth"){
                stealthSpiritView(tokenId)
                name = getCharName(tokenId)
                sendChat("System", '!power --whisper|"' + name + '" --Must be outside of vision to cast|~C[Form Seal](!FormHandSeal;;' + tokenId + ") [Cancel](!CancelStealthView " + tokenId + ")~C")
                return;
            }
            formHandSeal(tokenId)
        }
        else {
            scaling = args[2].split(">")
            state.HandoutSpellsNS.turnActions[tokenId].casting["spellName"] = spellName;
            state.HandoutSpellsNS.turnActions[tokenId].casting["scalingMagnitude"] = scaling[0];
            state.HandoutSpellsNS.turnActions[tokenId].casting["scalingCosts"] = scaling[1];
            state.HandoutSpellsNS.turnActions[tokenId].casting["seals"] = [];

            castTalisman(tokenId)
        }

    }

    if (msg.type == "api" && msg.content.indexOf("!FormSealButton") === 0){
        tokenId = args[1].replace(" ", "")
        name = getCharName(tokenId)
        sendChat("System", '!power --whisper|"' + name + '" --!seal|~C[Form Seal](!FormHandSeal;;' + tokenId + ")~C")
    }

    if (msg.type == "api" && msg.content.indexOf("!FormHandSeal") === 0){
        log('from chat formHandSeal')
        tokenId = args[1].replace(" ", "")
        formHandSeal(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!BolsterTalisman") === 0){
        tokenId = args[1].replace(" ", "")
        castTalisman(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!RemoveCasting") === 0){
        log("removeCasting")
        // tokenId = args[1].replace(" ", "")
        tokenId = getTokenId(msg)
        if(!tokenId){return}

        var bolstered = false
        for (var i = state.HandoutSpellsNS.OnInit[tokenId].reactors.length - 1; i >= 0; i--) {
            reactor = state.HandoutSpellsNS.OnInit[tokenId].reactors[i]
            if(state.HandoutSpellsNS.OnInit[reactor].type == "Bolster"){
                log("bolster reaction")
                bolstered = true
                //allow bolster's to try casting
                casting = state.HandoutSpellsNS.turnActions[tokenId].casting
                state.HandoutSpellsNS.turnActions[reactor].casting = casting
                log(casting.spellName)
                let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["ResourceType", "Seals"]);
                log(spellStats["ResourceType"])
                name = getCharName(reactor)
                if(spellStats["ResourceType"].includes("HS")){
                    //continue casting hand seals
                    remaining = casting.seals.length
                    allSeals = spellStats["Seals"].split(",")
                    casting.seals = allSeals.splice(allSeals.length - remaining - 1) 

                    sendChat("System", '!power --whisper|"' + name + '" --Bolster|Continue forming seals! --!seal|~C[Form Seal](!FormHandSeal;;' + reactor + ")~C")
                }
                else{
                    sendChat("System", '!power --whisper|"' + name + '" --Bolster|Retry spell check! --!cast|~C[Cast Spell](!BolsterTalisman;;' + reactor + ")~C")                    
                }
                state.HandoutSpellsNS.OnInit[tokenId].reactors.splice(i, 1);
                break;
            }
        }

        if(!bolstered) state.HandoutSpellsNS.turnActions[tokenId].casting = {};

        if(state.HandoutSpellsNS.OnInit[tokenId].type == "Counter"){
            counterTarget = state.HandoutSpellsNS.OnInit[tokenId].target
            log(state.HandoutSpellsNS.OnInit[counterTarget].reactors)
            var idx =  state.HandoutSpellsNS.OnInit[counterTarget].reactors.indexOf(tokenId)
            state.HandoutSpellsNS.OnInit[counterTarget].reactors.splice(idx, 1)

            if(state.HandoutSpellsNS.OnInit[counterTarget].reactors.length < 1){
                var txt = state.HandoutSpellsNS.OnInit[tokenId].attack
                log(txt)
                sendChat("System", txt)   
            }
        }

        if(state.HandoutSpellsNS.OnInit[tokenId].type == "Bolster"){
            // check if anyone else is bolstering target
            sendChat("System", "!RemoveCasting;;" + state.HandoutSpellsNS.OnInit[tokenId].target)
        }
    }

    if (msg.type == "api" && msg.content.indexOf("!SelectTarget") === 0){
        log(args)
        tokenId = args[1].replace(" ", "")
        selectTarget(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!CriticalTalisman") === 0){
        tokenId = args[1].replace(" ", "")
        state.HandoutSpellsNS.crit[tokenId] = 1;
        selectTarget(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!CritHandSeal") === 0){
        tokenId = args[1].replace(" ", "")
        critHandSeal(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!DefenseAction") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        bodyPart = args[3]
        log(args)
        defenseAction(tokenId, defenderId, bodyPart)
    }

    if (msg.type == "api" && msg.content.indexOf("!Dodge") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        dodge(tokenId, defenderId)
    }

    if (msg.type == "api" && msg.content.indexOf("!Ward") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        wardSpell(tokenId, defenderId)
    }

    if (msg.type == "api" && msg.content.indexOf("!TakeHit") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        takeHit(tokenId, defenderId)
    }

    if (msg.type == "api" && msg.content.indexOf("!EffectArea") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        dodgeVal = args[3].replace(" ", "")
        effectArea(tokenId, defenderId, dodgeVal)
    }

    if (msg.type == "api" && msg.content.indexOf("!EffectProjectile") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        effectProjectile(tokenId, defenderId)
    }

    if (msg.type == "api" && msg.content.indexOf("!EffectLiving") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        effectLiving(tokenId, defenderId)
    }

    if (msg.type == "api" && msg.content.indexOf("!EffectBind") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        effectBind(tokenId, defenderId)
    }

    if (msg.type == "api" && msg.content.indexOf("!CastLine") === 0){
        tokenId = args[1].replace(" ", "")
        effectBarrier(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!ChannelSpell") === 0){
        tokenId = args[1].replace(" ", "")
        channelSpell(tokenId, 0)
    }

    if (msg.type == "api" && msg.content.indexOf("!CriticalChannel") === 0){
        tokenId = args[1].replace(" ", "")
        state.HandoutSpellsNS.crit[tokenId] = 1;
        sendChat("", "!SelectTarget;;" + tokenId + ";;")
    }

    if (msg.type == "api" && msg.content.indexOf("!CancelSpell") === 0){
        tokenId = args[1].replace(" ", "")
        channelSpell(tokenId, 1)
    }
    
    if (msg.type == "api" && msg.content.indexOf("!RemoveArea") === 0){
        log(args)
        tokenId = args[1].replace(" ", "")
        cancelSpell(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!FlowTarget") === 0){
        log(args)
        tokenId = args[1].replace(" ", "")
        attackIds = args[2].replace(" ", "")
        healIds = args[3].replace(" ", "")


        state.HandoutSpellsNS.turnActions[tokenId].casting["healTargets"] = healIds.split(",")
        if(attackIds != ""){
            state.HandoutSpellsNS.targets[tokenId] = attackIds.split(",")
            state.HandoutSpellsNS.areaCount[tokenId] = 0;
            _.each(state.HandoutSpellsNS.targets[tokenId], function(attackId){
                defenseAction(tokenId, attackId, "")
            })
        }
        else {
            state.HandoutSpellsNS.targets[tokenId] = []
            state.HandoutSpellsNS.areaCount[tokenId] = 0;
            effectSpiritFlow(tokenId, attackIds)
        }
    }

    if (msg.type == "api" && msg.content.indexOf("!EffectSpiritFlow") === 0){
        tokenId = args[1].replace(" ", "")
        defenderId = args[2].replace(" ", "")
        effectSpiritFlow(tokenId, defenderId)
    }
    
    if (msg.type == "api" && msg.content.indexOf("!FailChannel") === 0){
        tokenId = args[1].replace(" ", "")
        // add bolster for channeling
        casting = state.HandoutSpellsNS.turnActions[tokenId].channel
        let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType", "BodyTarget"]);
        if(spellStats["SpellType"] != "Area"){
            cancelSpell(tokenId)
        }
        else {
            sendChat("", "/w gm [Roll Bad Stuff](#Area-Fail)")
            state.HandoutSpellsNS.turnActions[tokenId].channel = {}
        }
        
    }
});

