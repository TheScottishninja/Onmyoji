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
    HandSealDC: 8,
}


//------------------- casting functions ------------------------------------------------

async function formHandSeal(tokenId) {
    log('formHandSeal')
    var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
    hsPerTurn = getAttrByName(getCharFromToken(tokenId), "hsPerTurn")
    if(!hsPerTurn) hsPerTurn = 2;

    let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["Seals"]);
    
    if(casting.seals.length == 0){
        // forming first seal
        casting.seals = spellStats["Seals"].split(",")
    }
    var seal = casting.seals.shift()

    // check if this is the last seal
    var lastSeal = 0;
    if(casting.seals.length === 0){
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

function castTalisman(tokenId){
    log('castTalisman')
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
        formHandSeal(args[1])
    }

    if (msg.type == "api" && msg.content.indexOf("!RemoveCasting") === 0){
        tokenId = args[1]
        state.HandoutSpellsNS.turnActions[tokenId].casting = {};
    }
});