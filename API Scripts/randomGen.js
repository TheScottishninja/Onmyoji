async function displayWeapon(weaponName){
    log(weaponName)
    // get the weapon from handout
    var weaponObj = {};
    let handout = findObjs({_type: "handout", name: args[1]})[0]
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

    basicString = "[TTB 'width=100%'][TRB][TDB width=15%][basic](https://raw.githubusercontent.com/TheScottishninja/Onmyoji/main/icons/basic_small.png)" + 
        "[TDE][TDB 'width=20%' 'align=left']**Attack Name**[TDE][TDB 'width=20%' 'align=center']**1d6**[TDE][TRE][TTE]"

    sendChat("System", "!power --!Basic|" + basicString)
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    // var args = msg.content.split(/\s+/);
    var args = msg.content.split(";;");
    
    if (msg.type == "api" && msg.content.indexOf("!WeaponTest") !== -1 && msg.who.indexOf("(GM)")){
        displayWeapon("Test Fist Weapon")
    }
})