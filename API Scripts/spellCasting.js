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
    regex = regex.join("") + ".*"
    regExp = new RegExp(`^${regex}`);
    var mods = [];
    var names = [];
    // Get attributes
    findObjs({
        _type: 'attribute',
        _characterid: charid
    }).forEach(o => {
        const attrName = o.get('name');
        if (attrName.search(regExp) === 0) {
            mods.push(o.get('current'));
            names.push(attrName.substring(code.length + 1));
        }
        // else if (attrName === `_reporder_${prefix}`) mods.push(o.get('current'));
    });
    return [mods, names];
}

function replaceDigit(code, pos, value) {
    code[pos] = value;
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
        spellString = spellString.replace(header, replacements[header])
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
    },
    HandSealDC: 0,
    DodgeDC: 15,
}


//------------------- casting functions ------------------------------------------------

async function formHandSeal(tokenId) {
    log('formHandSeal')
    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    hsPerTurn = getAttrByName(getCharFromToken(tokenId), "hsPerTurn")
    if(!hsPerTurn) hsPerTurn = 20;

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
    state.HandoutSpellsNS.turnActions[tokenId].castCount++
    if(state.HandoutSpellsNS.turnActions[tokenId].castCount >= hsPerTurn){
        continueCast = 0;
    }

    const replacements = {
        "SEAL": seal,
        "SPELL": casting.spellName,
        "CURRENT": allSeals.length - casting.seals.length,
        "TOTAL": allSeals.length,
        "TOKEN": tokenId,
        "LAST": lastSeal,
        "DIFFICULTY": state.HandoutSpellsNS.coreValues.HandSealDC,
        "CONTINUE": continueCast
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
        state.HandoutSpellsNS.crit = 1;
        selectTarget(tokenId)
    }
    else {
        log('reduce seals')
        casting.seals.shift()
        hsPerTurn = getAttrByName(getCharFromToken(tokenId), "hsPerTurn")
        if(!hsPerTurn) hsPerTurn = 20;

        if(state.HandoutSpellsNS.turnActions[tokenId].castCount < hsPerTurn){
            // continue casting
            sendChat("", "!power --Critical Hand Seal:| -1 Hand Seal to cast. [Form Seal](!FormHandSeal;;" + tokenId + ")")
        }
        else {
            sendChat("", "!power --Critical Hand Seal:| -1 Hand Seal to cast. Continue casting next turn.")
        }
    }
}

function castTalisman(tokenId){
    log('castTalisman')
}

// ---------------- targeting --------------------------------

async function selectTarget(tokenId) {
    log('selectTarget')

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;

    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType", "SpellType", "BodyTarget"]);

    bodyPart = spellStats["BodyTarget"];
    if(spellStats["SpellType"] == "Projectile"){
        bodyPart = "&#63;{Target Body Part|&#64;{target|body_parts}}";
    }

    var targetString = "";
    name = getObj("graphic", tokenId).get("name");
    if(spellStats["TargetType"].includes("Radius")) {
        // spell effect area
        targetString = '!power --whisper|"' + name + '" --!target|~C[Select Target](!AreaTarget;;' + tokenId + ";;" + bodyPart + ")~C"
    }
    else if(spellStats["TargetType"].includes("Single")) {
        // spell effect single target
        targetString = '!power --whisper|"' + name + '" --!target|~C[Select Target](!DefenseAction;;' + tokenId + ";;&#64;{target|token_id};;" + bodyPart + ")~C"
    }
    else {
        log("unhandled target type")
        return;
    }

    sendChat("System", targetString)
}

// ----------------- defense actions ---------------------------

async function defenseAction(tokenId, defenderId, bodyPart){
    log("defenseAction")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    casting["bodyPart"] = bodyPart;

    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType"]);

    dodgeHit = 0;
    if(spellStats["SpellType"] == "Area") dodgeHit = 1;

    remainingDodges = getAttrByName(getCharFromToken(defenderId), "Dodges")
    dodgeString = "";
    if(remainingDodges > 0) dodgeString = "[Dodge](!Dodge;;" + tokenId + ";;" + defenderId + ";;" + dodgeHit + ")"

    wardString = "[Ward](!Ward;;" + tokenId + ";;" + defenderId + ")"
    hitString = "[Take Hit](!TakeHit;;" + tokenId + ";;" + defenderId + ")"

    name = getObj("graphic", defenderId).get("name")
    sendChat("System", '/w "' + name + '" ' + dodgeString + wardString + hitString)

}

async function wardSpell(tokenId, defenderId){
    log("ward")

    name = getObj("graphic", defenderId).get("name")
    sendChat("System", name + " wards the attack!")

    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType"]);

    if(spellStats["SpellType"] == "Area"){
        // area spell effect
        effectArea(tokenId, defenderId, 0)
    }
    else if(spellStats["SpellType"] == "Projectile"){
        // projectile spell effect
        effectProjectile(tokenId, defenderId, 0)
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
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType"]);

    if(spellStats["SpellType"] == "Area"){
        // area spell effect
        effectArea(tokenId, defenderId, 2)
    }
    else if(spellStats["SpellType"] == "Projectile"){
        // projectile spell effect
        effectProjectile(tokenId, defenderId, 2)
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
    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["SpellType"]);

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
    else {
        // living spell effect
        command = "EffectLiving"
        areaDodge = 0
    }

    replacements = {
        "DEFENDER": name,
        "AGILITY": getAttrByName(getCharFromToken(defenderId), "Agility"),
        "ATTACKER": tokenId,
        "TARGET": defenderId,
        "COMMAND": command,
        "AREADODGE": areaDodge,
        "DIFFICULTY": state.HandoutSpellsNS.coreValues.DodgeDC,
    }

    setReplaceMods(getCharFromToken(defenderId), "210")
    let spellString = await getSpellString("Dodge", replacements);

    sendChat("", "!power " + spellString)
}

// ----------------- spell effects ------------------------------

async function effectArea(tokenId, defenderId, dodged){
    // incoming flag for is the defender successfully dodged. They will take half damage
}

async function effectProjectile(tokenId, defenderId, hit){
    // hit flag == 2 when take hit
}

async function effectLiving(tokenId, defenderId, hit){
    // hit flag == 2 when take hit
}

// state.HandoutSpellsNS.turnActions = {};

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
        tokenId = args[1];
        spellName = args[2];


        let spellStats = await getFromHandout("PowerCard Replacements", spellName, ["SpellType", "ScalingCost"]);

        if(spellStats["SpellType"] == "HS"){
            castCount = state.HandoutSpellsNS.turnActions[tokenId].castCount;
            hsPerTurn = getAttrByName(getCharFromToken(tokenId), "hsPerTurn")
            if(!hsPerTurn) hsPerTurn = 2;

            if(castCount >= hsPerTurn){
                sendChat("", "All hand seals used for this turn. Cannot start casting a new spell.")
                return;
            }

            state.HandoutSpellsNS.turnActions[tokenId].casting.spellName = spellName;
            state.HandoutSpellsNS.turnActions[tokenId].casting.scalingMagnitude = "";
            state.HandoutSpellsNS.turnActions[tokenId].casting.spellCost = "";
            state.HandoutSpellsNS.turnActions[tokenId].casting.seals = [];

            formHandSeal(tokenId)
        }
        else {
            state.HandoutSpellsNS.turnActions[tokenId].casting.spellName = spellName;
            state.HandoutSpellsNS.turnActions[tokenId].casting.scalingMagnitude = args[3];
            state.HandoutSpellsNS.turnActions[tokenId].casting.spellCost = spellStats["ScalingCost"];
            state.HandoutSpellsNS.turnActions[tokenId].casting.seals = []; 

            castTalisman(tokenId)
        }

    }

    if (msg.type == "api" && msg.content.indexOf("!FormHandSeal") === 0){
        tokenId = args[1].replace(" ", "")
        formHandSeal(tokenId)
    }

    if (msg.type == "api" && msg.content.indexOf("!RemoveCasting") === 0){
        tokenId = args[1].replace(" ", "")
        state.HandoutSpellsNS.turnActions[tokenId].casting = {};
    }

    if (msg.type == "api" && msg.content.indexOf("!SelectTarget") === 0){
        log(args)
        tokenId = args[1].replace(" ", "")
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
        sendChat("", "Temp area")
    }

    if (msg.type == "api" && msg.content.indexOf("!EffectProjectile") === 0){
        sendChat("", "Temp projectile")
    }

    if (msg.type == "api" && msg.content.indexOf("!EffectLiving") === 0){
        sendChat("", "Temp living")
    }
});