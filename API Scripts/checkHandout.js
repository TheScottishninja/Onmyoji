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


on("chat:message", function(msg) {   
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
        var index = state.HandoutSpellsNS.tracked.indexOf(arg[1])
        if (index > -1) {
          state.HandoutSpellsNS.tracked.splice(index, 1);
        }
        sendChat("", "/w GM Currently tracked folders: " + state.HandoutSpellsNS.tracked.join(", "))
    }
    
    if (msg.type == "api" && msg.content.indexOf("!ViewTracked") !== -1 && msg.who.indexOf("(GM)")){
        sendChat("", "/w GM Currently tracked folders: " + state.HandoutSpellsNS.tracked.join(", "))
    }
    
    if (msg.type == "api" && msg.content.indexOf("!AddToCharacter") === 0 && msg.who.indexOf("(GM)")){
        _.each(msg.selected, async function(selected) {
            var obj = getObj("graphic", selected._id);

            var currChar = getObj("character", obj.get("represents")) || "";
            
            if (currChar.length == 0) {return;}
            // log(args)
            // arguments: Name Notes
            var rowID = generateRowID();
            var charID = currChar.get("_id");
            var resource = args[1];
            var scaling = ""
            
            // create scaling costs
            _.each(args, function(arg){
                if(arg.includes("ScalingCost")){
                    scaling = arg.substring(arg.indexOf("|") + 1, arg.length)
                    scaling = scaling.split(",")
                }
            })
            log(scaling)
            // var scaling = args[3];
            scaleStrings = [];
            if(scaling[0] !== "") {
                for (i=0;i<5;i++) {
                    costs = []
                    _.each(scaling, function(scale){
                        scale = scale.split(" ")
                        val = i * parseInt(scale[0])
                        costs.push(val.toString() + " " + scale[1])
                    });
                    scaleStrings.push("+" + i.toString() + " " + costs.join(" ") + "," + i.toString() + ">" + costs.join(","))
                }
                scaleStrings = ";" + scaleStrings.join(";")
            }
            log(scaleStrings)
            
            log(args)
            spellString = args[2].replace("PLACEHOLDER", "@{selected|token_id}")
            createObj("attribute", {
                name: "repeating_spells" + resource + "_" + rowID + "_RollSpell",
                current: '!power --whisper|"@{selected|token_name}" ' + spellString + scaleStrings,
                max: "",
                characterid: charID
            });
            
            var i;
            for (i = 3; i < args.length; i++) {
                var breakIdx = args[i].indexOf("|");
                var rowName = args[i].substring(0, breakIdx);
                var rowValue = args[i].substring(breakIdx + 1, args[i].length);
                
                log("repeating_spells" + resource + "_" + rowID + "_" + rowName)
                createObj("attribute", {
                    name: "repeating_spells" + resource + "_" + rowID + "_" + rowName,
                    current: rowValue,
                    max: "",
                    characterid: charID
                });
            }
            
            sendChat("", '/w "' + obj.get("name") + '" Spell added to character sheet!')
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
            var savedRows = ["SpellName", "Cost", "DamageType", "Magnitude", "Info", "Scaling", "Seals", "Code", "Duration", "ScalingCost"];
            
            for (i = 0; i < tableRows.length; i++) {
                rowText = rowText + tableRows[i].name + "|" + tableRows[i].value + ";"
                if (savedRows.includes(tableRows[i].name)){
                    macroString = macroString + tableRows[i].name + "|" + tableRows[i].value + ";;"
                }
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
            resourceName = tableRows[0].value;
            spellName = tableRows[1].value;
            code = tableRows[10].value;
            magnitude = tableRows[4].value;
            scaling = tableRows[13].value;
            log(macroString)
            castButtonString = "!AddTurnCasting;PLACEHOLDER;" + spellName
            log(resourceName)
            if(resourceName === "HS"){
                buttonString = '--replacement|' + spellName + " --replacement|RollVars --template|HSPreview|~SpellName$;~DamageType$;~SpellType$;~Magnitude$;~Cost$;~Info$;~Scaling$;" + castButtonString;
            }
            else {
                buttonString = '--replacement|' + spellName + " --replacement|RollVars --template|TalismanPreview|~SpellName$;~DamageType$;~SpellType$;~Magnitude$;~Cost$;~Info$;~Scaling$;" + castButtonString;
            }
            handout.set("gmnotes", "<a href=\"`!power {{\n--whisper|&quot;@{selected|token_name}&quot;\n\
            --replacement|" + spellName + "\n\
            --template|SpellInfo|~SpellName$;~DamageType$;~SpellType$;~Magnitude$;~Cost$;~Info$; \n\
            }}\n/w &quot;@{selected|token_name}&quot; [Add Spell](!AddToCharacter;;" + resourceName + ";;" + buttonString + ";;" + macroString + ")\">Add To Character</a>");
            // handout.get("gmnotes", function(gmnotes){
            //     log(gmnotes)
            // });
            updateFlag = false;
        });
        
        
    }
});