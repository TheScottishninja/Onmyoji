state.HandoutSpellsNS["Random"] = {
    "weaponMag": {
        1:[532, 219, 15,0,0],
        2:[426,426,72,2,0],
        3:[219,532,219,15,0],
        4:[72,426,426,72,2],
        5:[15,219,532,219,15],
        6:[6,133,503,323,35],
        7:[2,72,426,426,72],
        8:[1,35,323,503,133],
        9:[0,15,219,532,219],
        10:[0,6,133,503,323]
    },
    "Naming": {
        "weaponType":{
            "Fist":["Claws", "Gaunlets", "Knuckles", "Gloves"],
            "Lance": ["Lance", "Pike", "Harpoon"],
            "Greatsword": ["Greatsword", "Broadsword", "Claymore"],
            "Spear": ["Spear", "Halberd", "Trident"],
            "Scythe": ["Scythe", "Greatsickle", "Reaver"],
            "Sword": ["Long Sword", "Blade", "Katana"],
            "Thrown": ["Throwing Knife", "Shuriken", "Dart", "Throwing Axe"],
            "Dagger": ["Dagger", "Stiletto", "Shiv", "Short Sword"]
        },
        "toggle": {
            "Enhance Fists":["Swift", "Nimble", "Quickened"],
            "Enhance Lance": ["Blasting", "Charge", "Assault"],
            "Enhance Greatsword": ["Cleaving", "Hordebreaker", "Relentless"],
            "Enhance Spear": ["Reaching", "Lunge", "Farstrike"],
            "Enhance Scythe": ["Cyclone", "Whirling", "Vortex"],
            "Enhance Sword": ["Counter", "Echo", "Dueling"],
            "Enhance Thrown": ["Heartseeker", "Guided", "Conducting"],
            "Enhance Dagger": ["Shadow", "Precise", "Keen"],
            "Ignite Weapon": ["Flaming", "Firey", "Molten", "Ember"],
            "Flood Weapon": ["Tidal", "Misty", "Torrent", "Stream"],
            "Earthen Weapon": ["Rock", "Stone", "Earth", "Mountain"],
            "Metalicize Weapon": ["Steel", "Barbed", "Quicksilver", "Eversharp"],
            "Barken Weapon": ["Ironbark", "Vined", "Blooming", "Thorned"]
        }
    }
}


async function displayWeapon(weaponName){
    log(weaponName)
    // get the weapon from handout
    var weaponObj = {};
    let handout = findObjs({_type: "handout", name: weaponName})[0]
    if(handout){
        weaponObj = await new Promise((resolve, reject) => {
            handout.get("notes", function(currentNotes){
                currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                // log(currentNotes)
                resolve(JSON.parse(currentNotes));
            });
        });
        
    }
    else {
        log("Weapon handout '" + weaponName + "'not found!")
        return false;
    }

    rarity = {
        "1": "Common",
        "2": "Uncommon",
        "3": "Rare",
        "4": "Epic",
        "5": "Legendary"
    }

    colors = {
        "1": "#808080",
        "2": "#19fc19",
        "3": "#0997e3",
        "4": "#a909e3",
        "5": "#e39709"
    }

    var stats = ""
    if("stats" in weaponObj){
        stats = "[TTB 'width=100%']"
        for(var i in weaponObj.stats){
            stats += "[TRB][TDB]**" + weaponObj.stats[i].desc + "**[TDE][TRE]"
        }
        stats += "[TTE]"
    }   

    basicAttack = weaponObj.attacks[weaponObj.basicAttack]
    basicString = "[TTB 'width=100%'][TRB][TDB width=10%]" + 
        "[TDE][TDB 'width=55%' 'align=left']**" + basicAttack.attackName +"**[TDE][TDB 'width=35%' 'align=center']**" + 
        weaponObj.magnitude.toString() + "d" + basicAttack.effects.damage.baseDamage + "**[TDE][TRE][TTE]"

    basicDesc = "[TTB][TRB][TDB width=10%]" + 
    "[basic](https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/basic_small.png)[TDE][TDB width=90% colspan=3 align=left]" + 
    basicAttack.desc + "[TDE][TRE][TTE]"

    toggle = weaponObj.attacks[weaponObj.toggle]
    upkeep = weaponObj.attacks[weaponObj.toggle + " Upkeep"]
    
    toggleString = "[TTB 'width=100%'][TRB][TDB width=10%]" + 
    "[TDE][TDB 'width=55%' 'align=left']**" + toggle.attackName +"**[TDE][TDB 'width=35%' 'align=center']**" + upkeep.effects.damage.flatDamage +
    "[basic](https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/blackball_small.png) /turn" + "**[TDE][TRE][TTE]"
    
    toggleDesc = "[TTB width=100%][TRB][TDB width=10%][basic](https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/toggle_small.png)[TDE][TDB width=90% colspan=2 align=left]" + 
    toggle.desc + "[TDE][TRE][TTE]"
    
    burst = weaponObj.attacks[weaponObj.burstAttack]
    burstString = "[TTB 'width=100%'][TRB][TDB width=10%]" + 
    "[TDE][TDB 'width=55%' 'align=left']**" + burst.attackName +"**[TDE][TDB 'width=35%' 'align=center']**" + burst.spiritCost +
    "[basic](https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/blackball_small.png)" + "**[TDE][TRE][TRB][TDB width=10%][TDE][TDB width=55% align=left]" + 
    "**" + weaponObj.magnitude.toString() + "d" + burst.effects.damage.baseDamage + "**[TDE][TDB][TDE][TRE][TTE]"
    
    burstDesc = "[TTB width=100%][TRB][TDB width=10%][basic](https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/burst_small.png)[TDE][TDB width=90% colspan=2 align=left]" + 
    burst.desc + "[TDE][TRE][TTE]"

    sendChat("System", "!power --name|" + weaponObj.weaponName + 
        " --leftsub|" + rarity[weaponObj.magnitude.toString()] +
        " --rightsub|" + weaponObj.weaponType + 
        " --bgcolor|" + colors[weaponObj.magnitude.toString()] +
        " --title|" + state.HandoutSpellsNS.toolTips[weaponObj.weaponType] +
        " --titlefontshadow|none" +
        " --!Stat|" + stats +
        " --!Basic|" + basicString +
        " --!BasicDesc|" + basicDesc +
        " --!Toggle|" + toggleString + 
        " --!ToggleDesc|" + toggleDesc + 
        " --!Burst|" + burstString + 
        " --!BurstDesc|" + burstDesc)
}

function setMagTable(charLvl){
    // get the random mag table by name
    table = findObjs({
        _type: "rollabletable",
        name: "RandomMag"
    })[0]

    if(table){
        // loop through table items
        rows = findObjs({
            _type: "tableitem",
            _rollabletableid: table.get("_id")
        })
        weights = state.HandoutSpellsNS.Random.weaponMag[charLvl]

        _.each(rows, function(row){
            // convert item name to index and get new weight value
            idx = parseInt(row.get("name")) - 1
            row.set("weight", weights[idx])
        })
    }
    else{
        log("Table is not found!")
    }
}

async function rollWeapon(weaponType, charLvl){
    // if weaponType is random, roll for weaponType
    if(weaponType == "Random"){
        weaponTypes = Object.keys(state.HandoutSpellsNS.toolTips)
        weaponType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)]
    }

    // roll rarity based on character level
    setMagTable(parseInt(charLvl))

    let result = await new Promise((resolve,reject)=>{
        sendChat('',"[[1t[RandomMag]]]",(ops)=>{
            resolve(ops[0].inlinerolls[0].results);
        });
    });
    
    magnitude = result.total
    weaponId = generateRowID()

    
    log(weaponType)
    // get the base weapon object
    var weaponObj = {};
    let handout = findObjs({_type: "handout", name: "Basic " + weaponType})[0]
    if(handout){
        weaponObj = await new Promise((resolve, reject) => {
            handout.get("notes", function(currentNotes){
                currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                // log(currentNotes)
                resolve(JSON.parse(currentNotes));
            });
        });
        
    }
    else {
        log("Weapon handout not found!")
        return false;
    }
    weaponObj.magnitude = magnitude

    damageCode = {
        "Fire": "1",
        "Water": "2",
        "Earth": "5",
        "Metal": "4",
        "Wood": "3"
    }
    
    // get weapons stats
    var stats = {};
    let statHandout = findObjs({_type: "handout", name: "Weapon Stats"})[0]
    if(statHandout){
        stats = await new Promise((resolve, reject) => {
            statHandout.get("notes", function(currentNotes){
                currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                // log(currentNotes)
                resolve(JSON.parse(currentNotes));
            });
        });
        
    }
    else {
        log("Weapon handout not found!")
        return false;
    }
    
    // make list of stats available based on rarity of weapon
    var rollStats = []
    for(var i in stats){
        if(parseInt(i) <= magnitude){
            rollStats.push(...stats[i])
        }
    }
    
    // roll stats for weapon and add to weaponObj
    weaponObj["stats"] = {}
    for (let i = 0; i < magnitude; i++) {
        newStat = rollStats[Math.floor(Math.random() * rollStats.length)]
        if(newStat.equipment == "Any" || newStat.equipment == weaponObj.equipmentType){
            weaponObj.stats[weaponId + "_" + i.toString()] = newStat
        }
        else {
            i = i - 1
        }
    }
    
    // roll 50/50 for weapon toggle to be from any list or weapons specific
    if(Math.random() > 0.5){
        // any list
        var toggleList = {};
        let toggleHandout = findObjs({_type: "handout", name: "Any Toggles"})[0]
        if(toggleHandout){
            toggleList = await new Promise((resolve, reject) => {
                toggleHandout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Weapon handout not found!")
            return false;
        }
        
        // get random toggle
        keys = Object.keys(toggleList)
        key = keys[Math.floor(Math.random() * keys.length)]
        toggle = toggleList[key]
        
        // check toggle type
        if(toggle.type == "changeDamage"){
            // change damage type when toggle
            //make copies of attacks and change damage type to element
            newAttacks = {}
            for(var i in weaponObj.attacks){    
                if("damage" in weaponObj.attacks[i].effects){
                    newAttack = JSON.parse(JSON.stringify(weaponObj.attacks[i]))
                    newAttack.effects.damage.damageType = toggle.value
                    newcode = replaceDigit(newAttack.effects.damage.code, 3, damageCode[toggle.value])
                    newAttack.effects.damage.code = newcode
                    newAttack.attackName = toggle.name + " " + newAttack.attackName
                    newAttacks[newAttack.attackName] = newAttack
                }
            }
            for(var i in newAttacks){weaponObj.attacks[i] = newAttacks[i]}
            
            // add new attacks from toggle skills
            for(var i in toggle.attacks){
                if("changeAttack" in toggle.attacks[i].effects){
                    toggle.attacks[i].effects.changeAttack.normal = weaponObj.basicAttack
                    toggle.attacks[i].effects.changeAttack.enhanced = toggle.name + " " + weaponObj.basicAttack
                }
                if("changeBurst" in toggle.attacks[i].effects){
                    toggle.attacks[i].effects.changeBurst.normal = weaponObj.burstAttack
                    toggle.attacks[i].effects.changeBurst.enhanced = toggle.name + " " + weaponObj.burstAttack
                }
                weaponObj.attacks[i] = toggle.attacks[i]
            }
            
            // update toggle ability name, assumed first ability in list
            weaponObj.toggle = Object.keys(toggle.attacks)[0]
            log("elemental")
        }
    }
    else {
        // weapon toggle
        var toggleList = {};
        let toggleHandout = findObjs({_type: "handout", name: weaponType + " Toggles"})[0]
        if(toggleHandout){
            toggleList = await new Promise((resolve, reject) => {
                toggleHandout.get("notes", function(currentNotes){
                    currentNotes = currentNotes.replace(/(<p>|<\/p>|&nbsp;|<br>)/g, "")
                    // log(currentNotes)
                    resolve(JSON.parse(currentNotes));
                });
            });
            
        }
        else {
            log("Weapon handout not found!")
            return false;
        }
        
        // get random toggle
        keys = Object.keys(toggleList)
        key = keys[Math.floor(Math.random() * keys.length)]
        toggle = toggleList[key]
        
        // add new attacks from toggle skills   
        weaponObj.attacks[toggle.toggle.attackName] = toggle.toggle
        weaponObj.toggle = toggle.toggle.attackName
        weaponObj.attacks[toggle.upkeep.attackName] = toggle.upkeep
        if("enhanceBasic" in toggle){
            weaponObj.attacks[toggle.enhanceBasic.attackName] = toggle.enhanceBasic
        }
        if("enhanceBurst" in toggle){
            _.each(toggle.enhanceBurst, function(attack){
                weaponObj.attacks[attack.attackName] = attack
            })
        }
        log("toggle")
    }
    
    // if bonusDamage stat, add to attacks
    for(var stat in weaponObj.stats){
        if(weaponObj.stats[stat].stat.type == "effect"){
            // assign to update each attack
            for(var i in weaponObj.attacks){
                
                if("damage" in weaponObj.attacks[i].effects){
                    // create a template with bonusDamage effect
                    temp = {}
                    temp["bonusDamage_" + stat] = {
                        "scale": weaponObj.stats[stat].stat.code,
                        "scaleMod": weaponObj.stats[stat].stat.mod
                    }
                    weaponObj.attacks[i].effects = Object.assign(temp, weaponObj.attacks[i].effects)
                }
            }            
        }
    }

    // change weapon name
    // weaponObj.weaponName = "Test Weapon 1"
    prefixes = state.HandoutSpellsNS.Random.Naming.toggle[weaponObj.toggle]
    prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    log(prefix)

    weapon_options = state.HandoutSpellsNS.Random.Naming.weaponType[weaponObj.weaponType]
    weapon_option = weapon_options[Math.floor(Math.random() * weapon_options.length)]

    log(weapon_option)
    weaponObj.weaponName = prefix + " " + weapon_option

    // create new handout
    createObj("handout", {
        name: weaponObj.weaponName + "_" + weaponId
    });
    let newHandout = findObjs({_type: "handout", name: weaponObj.weaponName + "_" + weaponId})[0]
    if(newHandout){
        newHandout.set("notes", JSON.stringify(weaponObj))        
    }
    else {
        log("Weapon handout not found!")
        return false;
    }

    sendChat("System", "/w GM " + weaponObj.weaponName + " created! [Display](!DisplayWeapon;;" + 
        weaponObj.weaponName + "_" + weaponId + ") [Add to Character](!AddWeaponToCharacter;;" + weaponObj.weaponName + "_" + 
        weaponId + ") [Delete](!DeleteWeapon;;" + newHandout.get("id") + ")")
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    // var args = msg.content.split(/\s+/);
    var args = msg.content.split(";;");
    
    if (msg.type == "api" && msg.content.indexOf("!DisplayWeapon") !== -1 && msg.who.indexOf("(GM)")){
        displayWeapon(args[1])
    }

    if (msg.type == "api" && msg.content.indexOf("!RandomWeapon") !== -1 && msg.who.indexOf("(GM)")){
        
        if(msg.selected.length > 0 && msg.selected[0]._type == "graphic"){
            tokenId = msg.selected[0]._id
            charLvl = parseInt(getAttrByName(getCharFromToken(tokenId), "Level"))
            rollWeapon(args[1], charLvl)
        }
        else{
            log("No token selected")
        }
    }

    if (msg.type == "api" && msg.content.indexOf("!DeleteWeapon") !== -1 && msg.who.indexOf("(GM)")){
        handout = getObj("handout", args[1])
        handout.remove()
        sendChat("System", "/w GM Weapon deleted")
    }
})