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

function getFolder(id, sources){
    var folders = JSON.parse(Campaign().get('_journalfolder'))
    // log(folders)
    var output = "";
    _.each(folders, function(folder){
        if (sources.includes(folder.n)){
            var handouts = folder.i;
            _.each(handouts, function(handout){
                if(Object.keys(handout).length !== 0){
                    var hId = handout.get("_id")
                    if(hId === id){
                    //   log("found")
                       output = folder.n;
                       log(hId)
                       log(id)
                   }
                }
                
            });
        }
    });
    
    return output;
}

function getCharFromToken(tokenId){
    var obj = getObj("graphic", tokenId);
    var currChar = getObj("character", obj.get("represents")) || "";
    var charID = currChar.get("_id");
    return charID;
}

var generateUUID = (function() {
    "use strict";

    var a = 0, b = [];
    return function() {
        var c = (new Date()).getTime() + 0, d = c === a;
        a = c;
        for (var e = new Array(8), f = 7; 0 <= f; f--) {
            e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
            c = Math.floor(c / 64);
        }
        c = e.join("");
        if (d) {
            for (f = 11; 0 <= f && 63 === b[f]; f--) {
                b[f] = 0;
            }
            b[f]++;
        } else {
            for (f = 0; 12 > f; f++) {
                b[f] = Math.floor(64 * Math.random());
            }
        }
        for (f = 0; 12 > f; f++){
            c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
        }
        return c;
    };
}()),

generateRowID = function () {
    "use strict";
    return generateUUID().replace(/_/g, "Z");
};

if( ! state.HandoutSpellsNS ) {
        state.HandoutSpellsNS = {
            version: 1.0,
            tracked: [],
        };
    }


on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    // var args = msg.content.split(/\s+/);
    var args = msg.content.split(";;");
    
    if (msg.type == "api" && msg.content.indexOf("!TrackFolder") !== -1 && msg.who.indexOf("(GM)")){
        state.HandoutSpellsNS.tracked.push(args[1])
        sendChat("", "/w GM Currently tracked folders: " + state.HandoutSpellsNS.tracked.join(", "))
    }
    
    if (msg.type == "api" && msg.content.indexOf("!UntrackFolder") !== -1 && msg.who.indexOf("(GM)")){
        var index = state.HandoutSpellsNS.tracked.indexOf(args[1])
        if (index > -1) {
          state.HandoutSpellsNS.tracked.splice(index, 1);
        }
        sendChat("", "/w GM Currently tracked folders: " + state.HandoutSpellsNS.tracked.join(", "))
    }
    
    if (msg.type == "api" && msg.content.indexOf("!ViewTracked") !== -1 && msg.who.indexOf("(GM)")){
        sendChat("", "/w GM Currently tracked folders: " + state.HandoutSpellsNS.tracked.join(", "))
    }
    
    if (msg.type == "api" && msg.content.indexOf("!AddSpellToCharacter") === 0 && msg.who.indexOf("(GM)")){
        log(args)
        var spellName = args[1];
        let spellStats = await getFromHandout("PowerCard Replacements", spellName, ["ScalingCost", "ResourceType", "Magnitude", "Cost", "Info", "Scaling", "DamageType", "SpellType", "SpellName"])
        _.each(msg.selected, async function(selected) {
            var tokenId = selected._id;
            var charId = getCharFromToken(tokenId)
            
            if (charId.length == 0) {return;}
            // log(args)
            // arguments: Name Notes
            var rowID = generateRowID();
            var scaling = spellStats["ScalingCost"].split(",")
            log(scaling)
            
            var spellAttr = [];
            if(scaling[0] !== "") {
                // Talisman spell
                var scaleStrings = [];
                for (i=0;i<6;i++) {
                    costs = []
                    _.each(scaling, function(scale){
                        scale = scale.split(" ")
                        val = i * parseInt(scale[0])
                        costs.push(val.toString() + " " + scale[1])
                    });
                    scaleStrings.push("+" + i.toString() + " Mag: " + costs.join(" ") + "," + i.toString() + ">" + costs.join(","))
                }

                replacements = {
                    "PLACEHOLDER": spellName,
                    "SCALINGSELECT": scaleStrings.join(";")
                }
                let spellString = await getSpellString("TalismanPreviewCast", replacements)
                spellAttr = ["Magnitude", "SpellName", "Cost", "SpellType", "Info", "Scaling", "DamageType"]
            }
            else {
                // Hand Seal Spell
                replacements = {
                    "PLACEHOLDER": spellName,
                }
                let spellString = await getSpellString("HSPreviewCast", replacements)
                spellAttr = ["Magnitude", "SpellName", "Cost", "SpellType", "Info", "DamageType"]
            }
            log(spellString)

            createObj("attribute", {
                name: "repeating_spells" + spellStats["ResourceType"] + "_" + rowID + "_RollSpell",
                current: '!power --whisper|"@{selected|token_name}" ' + spellString,
                max: "",
                characterid: charId,
            });

            _.each(spellAttr, function(attr){
                
                log("repeating_spells" + spellStats["ResourceType"] + "_" + rowID + "_" + attr)
                createObj("attribute", {
                    name: "repeating_spells" + spellStats["ResourceType"] + "_" + rowID + "_" + attr,
                    current: spellStats[attr],
                    max: "",
                    characterid: charId
                });
            });
            log('attributes added')
            
            sendChat("System", '/w "' + getObj("graphic", tokenId).get("name") + '" Spell added to character sheet!')
        });    
    }

}); 

updateFlag = false;

on("change:handout", function(handout){

    var id = handout.get("_id")
    var folders = JSON.parse(Campaign().get('_journalfolder'));
    var sourceFolder = ""
    _.each(folders, function(folder){
        // var folder = JSON.parse(folder);'
        if(typeof(folder) == "object"){
            if(folder.i.includes(id)){
                sourceFolder = folder.n
            }
        }
    })
    if(state.HandoutSpellsNS.tracked.includes(sourceFolder) && !updateFlag){
        var macroString = ""
        handout.get("notes", function(notes) {
            // log(notes); //do something with the character bio here.
            var tableRows = [];
            var rowStart = notes.indexOf("<tr>");
            while(rowStart !== -1){
                cellEnd = notes.indexOf("</td>", rowStart);
                str1 = notes.substring(rowStart + 8, cellEnd);
                rowEnd = Math.min(notes.indexOf("</td>", cellEnd + 9), notes.indexOf("<br>", cellEnd + 9));
                str2 = notes.substring(cellEnd + 9, rowEnd);
                
                tableRows.push({
                    name: str1,
                    value: str2,
                });
                rowStart = notes.indexOf("<tr>", rowEnd);
            }
            //Convert to string for replacement macro
            var testString = handout.get("name") + ":"
            var rowText = testString
            
            for (i = 0; i < tableRows.length; i++) {
                rowText = rowText + tableRows[i].name + "|" + tableRows[i].value + ";"
            };
            log(rowText)
            replaceHandout = getHandoutByName("PowerCard Replacements");
            replaceHandout.get("notes", function(currentNotes){
                if(currentNotes.includes(testString)){
                    startIdx = currentNotes.indexOf(testString)
                    beforeString = currentNotes.substring(0, startIdx)
                    afterString = currentNotes.substring(currentNotes.indexOf("</p>", startIdx), currentNotes.length)
                    replaceHandout.set("notes",beforeString + rowText + afterString);
                    log("Updated Replacement")
                    
                }
                else {           
                    replaceHandout.set("notes", currentNotes + "<p>" + rowText + "</p>");
                    log("Added to Replacement")
                }  
            });

            // update the commands in gm notes
            updateFlag = true;
            spellName = tableRows[1].value;
            handout.set("gmnotes", "<a href=\"`!power {{\n--whisper|&quot;@{selected|token_name}&quot;\n\
            --replacement|" + spellName + "\n\
            --template|SpellInfo|~SpellName$;~DamageType$;~SpellType$;~Magnitude$;~Cost$;~Info$;~Scaling$; \n\
            }}\n/w GM [Add Spell](!AddSpellToCharacter;;" + spellName + ")\">Add To Character</a>");
            // handout.get("gmnotes", function(gmnotes){
            //     log(gmnotes)
            // });
            updateFlag = false;
        });
        
        
    }
});