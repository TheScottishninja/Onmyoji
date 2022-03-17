state.HandoutSpellsNS.toolTips = {
    "Sword": "Sword: Deals bonus damage when attacking during a Reaction",
    "Fist": "Fist: Gets an extra attack each action",
    "Scythe": "Scythe: Attack in melee targets in a half circle arc",
    "Greatsword": "Greatsword: Attack melee targets in a quarter circle arc",
    "Lance": "Lance: Deals bonus damage when moving before an attack",
    "Spear": "Spear: Attaks have a range of 10ft",
    "Dagger": "Dagger: Deals bonus damage when attack from out of view of the target",
    "Thrown": "Thrown: The weapon returns to you at the start of the next turn dealing damage to a melee target",
    "Tower Shield": "Tower Shield: Choose an ally when attacking. That ally gains bonus damage this turn if they follow-up",
    "Greataxe": "Greataxe: Deals bonus damage based on your initiative roll.",
    "Crossbow": "Crossbow: Deals bonus damage based on distance to the target.",
    "Hammer": "Hammer: Deals partial damage when a target successfully dodges.",
    "Slingshot": "Slingshot: Attacks ricochet to a secondary target.",
    "Bow": "Bow: Fires arrows of spirit energy or can fire elemental talismans.",
    "Projectile": "Projectile: Instantaneous spell that can target specific body parts. On Crit, 50% of the damage will pierce the targets Ward.",
    "Area": "Area: Area of Effect spell that leaves behind elemental tiles. Targets that dodge still recieve half damage from the attack. Spell can be channeled to continue the effect, but failure to channel or dismiss has negative consequences. On Crit, spell radius is increased by 5ft.",
    "Living": "Living: Damage over time spell that continuously attacks and damages the target at the start of their turn until the duration is over. On Crit, two instances of the spell are added to targets.",
    "Exorcism": "Exorcism: Static area of effect spell that deals very high flat damage to targets that end their turn in the area. Spell is channeled to maintain the effect.",
    "Barrier": "Barrier: Defensive wall spell effect. When a barrier is between a spellcaster and target, the effect is applied to the barrier rather than the target. The spell can be channeled to maintain and regains 50% of missing strength on successful channel.",
    "Binding": "Binding: Channeled spell effect that reduces the movement speed of the target based on the Bind damage and target's current spirit."
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


function updateReplacement(identifier, rows){
    //Convert to string for replacement macro

    var name = identifier + ":"
    var rowText = name
    
    for (i = 0; i < rows.length; i++) {
        rowText = rowText + rows[i].name + "|" + rows[i].value + ";"
    };
    log(rowText)
    replaceHandout = getHandoutByName("PowerCard Replacements"); //fix this!!!!!!!
    replaceHandout.get("notes", function(currentNotes){
        if(currentNotes.includes(name)){
            startIdx = currentNotes.indexOf(name)
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
}

function deleteReplacement(identifier){

    var name = identifier + ":"
    replaceHandout = getHandoutByName("PowerCard Replacements");
    replaceHandout.get("notes", function(currentNotes){
        if(currentNotes.includes(name)){
            startIdx = currentNotes.indexOf(name)
            beforeString = currentNotes.substring(0, startIdx)
            afterString = currentNotes.substring(currentNotes.indexOf("</p>", startIdx), currentNotes.length)
            newString = beforeString + afterString
            newString = newString.replace("<p></p>", "")
            replaceHandout.set("notes", newString);
            log("Removed " + identifier + " from Replacement")
            
        }
        else {           
            log("Item not in replacements")
        }  
    });
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    // var args = msg.content.split(/\s+/);
    var args = msg.content.split(";;");

    if (msg.type == "api" && msg.content.indexOf("!RandomSpell") !== -1 && msg.who.indexOf("(GM)")){
        log("random spell")

        // get the spell journal folder
        var folders = JSON.parse(Campaign().get('_journalfolder'))
        
        var output = "";
        for (let i = 0; i < folders.length; i++) {
            folder = folders[i]
            if (folder.n == "Spells"){
                var handouts = folder.i;
                
                // select a handout a random
                var rIdx = Math.floor(Math.random() * handouts.length)
                handout = getObj("handout", handouts[rIdx])

                // display spell preview
                log(handout.get("name"))

                var spellObj = await new Promise((resolve, reject) => {
                    handout.get("notes", function(currentNotes){
                        currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                        // log(currentNotes)
                        resolve(JSON.parse(currentNotes));
                    });
                });

                //--------------- spell range ------------------------------------------

                var range = "melee"
                for(var attack in spellObj.attacks){
                    if("primary" in spellObj.attacks[attack].targetType.range){
                        range = spellObj.attacks[attack].targetType.range.primary
                        break
                    }
                }

                if(range != "melee"){range += "ft"}

                // attributes["SpellRange"] = range

                //--------------- spell damage type ------------------------------------------
                var damageType = "-"
                for(var attack in spellObj.attacks){
                    if("damage" in spellObj.attacks[attack].effects){
                        damageType = spellObj.attacks[attack].effects.damage.damageType
                        break
                    }
                    else if("status" in spellObj.attacks[attack].effects){
                        damageType = spellObj.attacks[attack].effects.status.damageType
                        break
                    }
                    else if("bind" in spellObj.attacks[attack].effects){
                        damageType = "Bind"
                        break
                    }
                }
                // attributes["DamageType"] = damageType

                //-------------- casting -----------------------------------------------------

                var scaling = ""
                var costString = ""
                if("seals" in spellObj){
                    // hand seal spell
                    costString = spellObj.seals.length.toString() + " [x](" + state.HandoutSpellsNS.coreValues.CostIcons[spellObj.seals[0].hands] + ")"
                }
                else {
                    // set cost type and number
                    costs = []
                    for(var cost in spellObj.costs){
                        costs.push(spellObj.costs[cost] + " [x](" + state.HandoutSpellsNS.coreValues.CostIcons[cost] + ")")
                    }
                    costString = costs.join(" ")

                    // set scaling info
                    scalingCost = []
                    for(var cost in spellObj.scalingCost){
                        scalingCost.push("+" + spellObj.scalingCost[cost].toString() + " [x](" + state.HandoutSpellsNS.coreValues.CostIcons[cost] + ")")
                    }

                    scaling = "For each " + scalingCost.join(" ") + ", +1 magnitude"
                }

                sendChat("System", "!power --name|" + spellObj.name + 
                    " --leftsub|" + damageType +
                    " --rightsub|" + spellObj.type + 
                    " --title|" + state.HandoutSpellsNS.toolTips[spellObj.type] +
                    " --titlefontshadow|none" +
                    " --Magnitude:|" + spellObj.magnitude.toString() + 
                    " --Cost:|" + costString + 
                    " --Scaling:|" + scaling + 
                    " --Range:|" + range +
                    " --!Desc|" + spellObj.attacks.Base.desc)
                
                sendChat("System", "/w GM Add **" + handout.get("name") + "** to character? [Add Spell](!AddSpellToCharacter;;" + handout.get("name") + ")")
                break
            }
        }

    }
    
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

    if (msg.type == "api" && msg.content.indexOf("!ChangeChar") !== -1 && msg.who.indexOf("(GM)")){
        tokenId = args[1]
        charId = getCharFromToken(tokenId)
        char = getObj("character", charId)
        attr = await getAttrObj(charId, args[2])
        sendChat("", "/w GM " + args[2] + " current value: " + attr.get("current"))
        attr.set("current", args[3])
        sendChat("", "/w GM " + args[2] + " set to " + attr.get("current"))
    }
    
    // if (msg.type == "api" && msg.content.indexOf("!AddSpellToCharacter") === 0 && msg.who.indexOf("(GM)")){
    //     log(args)
    //     var spellName = args[1];
    //     let spellStats = await getFromHandout("PowerCard Replacements", spellName, ["ScalingCost", "ResourceType", "Magnitude", "Cost", "Info", "Scaling", "DamageType", "SpellType", "SpellName"])
    //     _.each(msg.selected, async function(selected) {
    //         var tokenId = selected._id;
    //         var charId = getCharFromToken(tokenId)
            
    //         if (charId.length == 0) {return;}
    //         // log(args)
    //         // arguments: Name Notes
    //         var rowID = generateRowID();
    //         var scaling = spellStats["ScalingCost"].split(",")
    //         log(scaling)
            
    //         var spellAttr = [];
    //         if(scaling[0] !== "") {
    //             // Talisman spell
    //             var scaleStrings = [];
    //             for (i=0;i<6;i++) {
    //                 costs = []
    //                 _.each(scaling, function(scale){
    //                     scale = scale.split(" ")
    //                     val = i * parseInt(scale[0])
    //                     costs.push(val.toString() + " " + scale[1])
    //                 });
    //                 scaleStrings.push("+" + i.toString() + " Mag: " + costs.join(" ") + "," + i.toString() + ">" + costs.join(","))
    //             }

    //             replacements = {
    //                 "PLACEHOLDER": spellName,
    //                 "SCALINGSELECT": scaleStrings.join(";")
    //             }
    //             let spellString = await getSpellString("TalismanPreviewCast", replacements)
    //             spellAttr = ["Magnitude", "SpellName", "cost_num", "cost_type", "SpellType", "Info", "Scaling", "DamageType"]
    //         }
    //         else {
    //             // Hand Seal Spell
    //             replacements = {
    //                 "PLACEHOLDER": spellName,
    //             }
    //             let spellString = await getSpellString("HSPreviewCast", replacements)
    //             spellAttr = ["Magnitude", "SpellName", "cost_num", "cost_type", "SpellType", "Info", "DamageType"]
    //         }
    //         log(spellString)

    //         // split Cost
    //         costList = spellStats["Cost"].split(" ")
    //         spellStats["cost_num"] = costList[0]
    //         spellStats["cost_type"] = costList[1]

    //         name = getObj("graphic", tokenId).get("name")

    //         createObj("attribute", {
    //             name: "repeating_spells" + spellStats["ResourceType"] + "_" + rowID + "_RollSpell",
    //             current: '!power --whisper|"' + name + '" ' + spellString,
    //             max: "",
    //             characterid: charId,
    //         });

    //         _.each(spellAttr, function(attr){
                
    //             log("repeating_spells" + spellStats["ResourceType"] + "_" + rowID + "_" + attr)
    //             createObj("attribute", {
    //                 name: "repeating_spells" + spellStats["ResourceType"] + "_" + rowID + "_" + attr,
    //                 current: spellStats[attr],
    //                 max: "",
    //                 characterid: charId
    //             });
    //         });
    //         log('attributes added')
            
    //         sendChat("System", '/w "' + getObj("graphic", tokenId).get("name") + '" Spell added to character sheet!')
    //     });    
    // }

    if (msg.type == "api" && msg.content.indexOf("!AddWeaponToCharacter") === 0 && msg.who.indexOf("(GM)")){
        log(args)
        
        // get the weapon from handout
        var spellObj = {};
        let handout = findObjs({_type: "handout", name: args[1]})[0]
        if(handout){
            spellObj = await new Promise((resolve, reject) => {
                handout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Weapon handout '" + args[1] + "'not found!")
            return false;
        }

        _.each(msg.selected, async function(selected) {
        
            if(selected._type == "graphic"){

                var tokenId = selected._id;
                var charId = getCharFromToken(tokenId)
                
                if (charId.length == 0) {return;}
                // arguments: Name Notes
                var rowID = generateRowID();
                var attributes = {};
                
                //--------------- basic weapon properties --------------------------------
                attributes["WeaponName"] = spellObj.name
                attributes["WeaponID"] = args[1]
                attributes["WeaponType"] = spellObj.type
                attributes["WeaponMag"] = spellObj.magnitude
                attributes["WeaponTypeTip"] = state.HandoutSpellsNS.toolTips[spellObj.type]
                attributes["WeaponEquip"] = "Equip"
                attributes["RowID"] = rowID

                if(spellObj.type == "Bow"){
                    spellObj.basicAttack += "_Impact"
                    spellObj.burstAttack += "_Impact"
                }

                //--------------- weapon stats ------------------------------------------
                if("stats" in spellObj){
                    stats = []
                    for(var i in spellObj.stats){
                        stats.push(spellObj.stats[i].desc)
                    }
                    attributes["WeaponStats"] = stats.join(", ")
                }
                
                //---------------- basic attack ---------------------------------------
                var basicAttack = spellObj.attacks[spellObj.basicAttack]
                attributes["BasicAttackName"] = basicAttack.attackName
                attributes["BasicAttackDamage"] = spellObj.magnitude + "d" + basicAttack.effects.damage.baseDamage
                attributes["BasicAttackCost"] = ""
                attributes["BasicNotes"] = basicAttack.desc
                
                // combine attack properties into a string
                // damageType, range, # targets
                var props = []
                // damageType
                props.push(basicAttack.effects.damage.damageType) 
                
                // range
                ranges = basicAttack.targetType.range
                rangeString = []
                for(var target in ranges){
                    rangeString.push(ranges[target])
                }
                props.push(rangeString.join("/"))
                
                // targets
                if("tokens" in basicAttack.targetType){
                    targetString = []
                    targets = basicAttack.targetType.tokens
                    for(var target in targets){
                        if(targets[target] != "0"){
                            targetString.push(targets[target])
                        }
                    }
                    props.push("Target: " + targetString.join("/"))
                }
                else {
                    // assume using shape
                    props.push(basicAttack.targetType.shape.type)
                }
                
                attributes["BasicAttackProperties"] = props.join(", ")
                
                //--------------- Toggle Ability ------------------------------------
                toggleSkill = spellObj.attacks[spellObj.toggle]
                attributes["ToggleState"] = "Toggle On"
                attributes["ToggleAttackName"] = toggleSkill.attackName
                attributes["ToggleNotes"] = toggleSkill.desc
                
                // get cost from upkeep
                upkeep = spellObj.attacks[spellObj.toggle + " Upkeep"]
                attributes["ToggleAttackCost"] = upkeep.effects.damage.flatDamage + " Spirit/turn"
                attributes["ToggleAttackProperties"] = ""
                
                //---------------- Burst Attack -------------------------------------
                burst = spellObj.attacks[spellObj.burstAttack]
                attributes["BurstAttackName"] = burst.attackName
                attributes["BurstAttackDamage"] = spellObj.magnitude + "d" + burst.effects.damage.baseDamage
                attributes["BurstAttackCost"] = burst.spiritCost + " Spirit"
                attributes["BurstNotes"] = burst.desc
                
                // combine attack properties into a string
                // damageType, range, # targets
                var props = []
                // damageType
                props.push(burst.effects.damage.damageType) 
                
                // range
                ranges = burst.targetType.range
                rangeString = []
                for(var target in ranges){
                    rangeString.push(ranges[target])
                }
                props.push(rangeString.join("/"))
                
                // targets
                if("tokens" in burst.targetType){
                    targetString = []
                    targets = burst.targetType.tokens
                    for(var target in targets){
                        if(targets[target] != "0"){
                            targetString.push(targets[target])
                        }
                    }
                    props.push("Target: " + targetString.join("/"))
                }
                else {
                    // assume using shape
                    props.push(burst.targetType.shape.type)
                }
                log(props)
                
                attributes["BurstAttackProperties"] = props.join(", ")
    
                // create attribute on character
    
                for(var attr in attributes){
                    
                    log("repeating_attacks_" + rowID + "_" + attr)
                    createObj("attribute", {
                        name: "repeating_attacks_" + rowID + "_" + attr,
                        current: attributes[attr],
                        max: "",
                        characterid: charId
                    });
                }
                log('attributes added')
                
                sendChat("System", '/w "' + getObj("graphic", tokenId).get("name") + '" ' + spellObj.name + ' added to character sheet!')
            }
        });    
    }

    if (msg.type == "api" && msg.content.indexOf("!AddSpellToCharacter") === 0 && msg.who.indexOf("(GM)")){
        log(args)
        
        // get the weapon from handout
        var spellObj = {};
        let handout = findObjs({_type: "handout", name: args[1]})[0]
        if(handout){
            spellObj = await new Promise((resolve, reject) => {
                handout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Weapon handout '" + args[1] + "'not found!")
            return false;
        }

        _.each(msg.selected, async function(selected) {
        
            if(selected._type == "graphic"){

                var tokenId = selected._id;
                var charId = getCharFromToken(tokenId)
                
                if (charId.length == 0) {return;}
                // arguments: Name Notes
                var rowID = generateRowID();
                var attributes = {};
                
                //--------------- basic spell properties --------------------------------
                attributes["SpellName"] = spellObj.name
                attributes["SpellID"] = args[1]
                attributes["SpellType"] = spellObj.type
                attributes["Magnitude"] = spellObj.magnitude
                // attributes["WeaponTypeTip"] = state.HandoutSpellsNS.toolTips[spellObj.weaponType]
                // attributes["WeaponEquip"] = "Equip"
                attributes["RowID"] = rowID
                attributes["Info"] = spellObj.attacks.Base.desc

                //--------------- spell range ------------------------------------------

                var range = "melee"
                for(var attack in spellObj.attacks){
                    if("primary" in spellObj.attacks[attack].targetType.range){
                        range = spellObj.attacks[attack].targetType.range.primary
                        break
                    }
                }

                if(range != "melee"){range += "ft"}

                attributes["SpellRange"] = range

                //--------------- spell damage type ------------------------------------------
                var damageType = "-"
                for(var attack in spellObj.attacks){
                    if("damage" in spellObj.attacks[attack].effects){
                        damageType = spellObj.attacks[attack].effects.damage.damageType
                        break
                    }
                    else if("status" in spellObj.attacks[attack].effects){
                        damageType = spellObj.attacks[attack].effects.status.damageType
                        break
                    }
                    else if("bind" in spellObj.attacks[attack].effects){
                        damageType = "Bind"
                        break
                    }
                }
                attributes["DamageType"] = damageType

                //-------------- casting -----------------------------------------------------

                var repeating = ""
                if("seals" in spellObj){
                    // hand seal spell
                    repeating = "repeating_spellsHS_"

                    // set number of hands
                    attributes["cost_type"] = spellObj.seals[0].hands

                    // set number of hand seals
                    attributes["cost_num"] = spellObj.seals.length
                }
                else {
                    // talisman spell
                    repeating = "repeating_spellsT_"

                    // set cost type and number
                    for(var cost in spellObj.costs){
                        attributes["cost_" + cost] = cost
                        attributes["cost_num_" + cost] = spellObj.costs[cost]
                    }

                    // set scaling info
                    scalingCost = []
                    for(var cost in spellObj.scalingCost){
                        scalingCost.push("+" + spellObj.scalingCost[cost].toString() + " " + cost)
                    }

                    attributes["Scaling"] = "For each " + scalingCost.join(" ") + ", +1 magnitude"
                }
    
                for(var attr in attributes){
                    
                    log(repeating + rowID + "_" + attr)
                    createObj("attribute", {
                        name: repeating + rowID + "_" + attr,
                        current: attributes[attr],
                        max: "",
                        characterid: charId
                    });
                }
                log('attributes added')
                
                sendChat("System", '/w "' + getObj("graphic", tokenId).get("name") + '" ' + spellObj.name + ' added to character sheet!')
            }
        });    
    }
}); 

updateFlag = false;

// on("change:handout", function(handout){

//     var id = handout.get("_id")
//     var folders = JSON.parse(Campaign().get('_journalfolder'));
//     var sourceFolder = ""
//     _.each(folders, function(folder){
//         // var folder = JSON.parse(folder);'
//         if(typeof(folder) == "object"){
//             if(folder.i.includes(id)){
//                 sourceFolder = folder.n
//             }
//         }
//     })
//     if(state.HandoutSpellsNS.tracked.includes(sourceFolder) && !updateFlag){
//         var macroString = ""
//         handout.get("notes", function(notes) {
//             // log(notes); //do something with the character bio here.
//             var tableRows = [];
//             var rowStart = notes.indexOf("<tr>");
//             while(rowStart !== -1){
//                 cellEnd = notes.indexOf("</td>", rowStart);
//                 str1 = notes.substring(rowStart + 8, cellEnd);
//                 rowEnd = Math.min(notes.indexOf("</td>", cellEnd + 9), notes.indexOf("<br>", cellEnd + 9));
//                 str2 = notes.substring(cellEnd + 9, rowEnd);
                
//                 tableRows.push({
//                     name: str1,
//                     value: str2,
//                 });
//                 rowStart = notes.indexOf("<tr>", rowEnd);
//             }

//             updateReplacement(handout.get("name"), tableRows)
            
//             // update the commands in gm notes
//             updateFlag = true;
//             spellName = tableRows[1].value;
//             handout.set("gmnotes", "<a href=\"`!power {{\n--whisper|&quot;@{selected|token_name}&quot;\n\
//             --replacement|" + spellName + "\n\
//             --template|SpellInfo|~SpellName$;~DamageType$;~SpellType$;~Magnitude$;~Cost$;~Info$;~Scaling$; \n\
//             }}\n/w GM [Add Spell](!AddSpellToCharacter;;" + spellName + ") " + spellName + " to " + "@{selected|token_name}\">Add To Character</a>");
//             // handout.get("gmnotes", function(gmnotes){
//             //     log(gmnotes)
//             // });
//             updateFlag = false;
//         });

//         tableItem = findObjs({
//             _type: "tableitem",
//             name: '[' + handout.get("name") + '](http://journal.roll20.net/handout/' + handout.get("_id") + ')'
//         })[0]

//         if(!tableItem){
//             rollTable = findObjs({
//                 _type: "rollabletable",
//                 name: sourceFolder
//             })[0]

//             if(!rollTable){
//                 // create table 
//                 createObj("rollabletable", {
//                     name: sourceFolder,
//                     showplayers: false
//                 });

//                 rollTable = findObjs({
//                     _type: "rollabletable",
//                     name: sourceFolder
//                 })[0]

//                 log("table created")
//             }

//             createObj("tableitem",{
//                 _rollabletableid: rollTable.get("_id"),
//                 name: '[' + handout.get("name") + '](http://journal.roll20.net/handout/' + handout.get("_id") + ')',
//             })

//             log("added table item")
//         }

//     }
// });

on("destroy:handout", async function(handout){

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

    if(state.HandoutSpellsNS.tracked.includes(sourceFolder)){
        deleteReplacement(handout.get("_id"))
    }

    // remove weapon/spell from character sheets
    await attackRemove(handout.get("name"))

});

function playerReminder(obj, prev){
    
}

on('ready',function(){
    'use strict';

    on('chat:message',function(msg){
        if('api' === msg.type && msg.content.match(/^!random-journal/) && playerIsGM(msg.playerid) ){ 
            let path=msg.content.replace(/^!random-journal\s*/,''),
                journals=JSON.parse(Campaign().get('journalfolder')),
                obj = findObjs({
                    id: _.chain(path.split('/'))
                        .reject(_.isEmpty)
                        .reduce((m,p)=>(_.filter(m,(o)=>_.isObject(o) && o.n===p)[0]||{i:[]}).i, journals)
                        .reject(_.isObject)
                        .sample()
                        .value()
                })[0];

            if(obj){
                sendChat('RandomJournal',`/w gm <a style="text-decoration:underline;padding: .1em .5em; border-radius: .5em;display:inline-block;border:1px solid #ccc;background-color:#eee;" href="http://journal.roll20.net/${obj.get('type')}/${obj.id}">${path.length ? `<b>${path}</b>: `:''}${obj.get('name')}</a>`);
            } else {
                sendChat('RandomJournal', `/w gm <b>Error:</b> No journal entries found in <code>${path||'[Root]'}</code>.`);
            }
        }
    });

    on('change:player:_online', function(obj, prev){
        if(obj.get('online') === true && prev._online === false){
            // remind player to set speaking as
            log("player online")
            setTimeout(function(){
                var who = obj.get('displayname');
                sendChat("Reminder", '/w "' + who + '" Change speaking as to character name 👇👇👇');
            }, 10000)
        }
    })
});