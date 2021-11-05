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
        "[TDE][TDB 'width=65%' 'align=left']**" + basicAttack.attackName +"**[TDE][TDB 'width=25%' 'align=center']**" + 
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
        " --!Stat|" + stats +
        " --!Basic|" + basicString +
        " --!BasicDesc|" + basicDesc +
        " --!Toggle|" + toggleString + 
        " --!ToggleDesc|" + toggleDesc + 
        " --!Burst|" + burstString + 
        " --!BurstDesc|" + burstDesc)
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
})