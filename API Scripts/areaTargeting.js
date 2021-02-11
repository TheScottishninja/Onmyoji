function getPlayerFromToken(tokenId){
    var obj = getObj("graphic", tokenId);
    var currChar = getObj("character", obj.get("represents")) || "";
    var playerID = currChar.get("controlledby");
    return playerID;
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

function getRadiusRange(token1, token2){
        
    var curPageID = findObjs({_type: "campaign"})[0].get("playerpageid");
    var curPage = findObjs({_type: "page", _id: curPageID})[0];
        
    var token1 =  findObjs({_type: "graphic", layer:"objects", _pageid: curPageID, _id: token1})[0];
    var token2 =  findObjs({_type: "graphic", layer:"objects", _pageid: curPageID, _id: token2})[0];
    if (token1 && token2)
    {
        var gridSize = 70;
        var lDist = Math.abs(token1.get("left")-token2.get("left"))/gridSize;
        var tDist = Math.abs(token1.get("top")-token2.get("top"))/gridSize;
        var dist = 0;
        if (tDist == lDist)
        {
            dist = tDist;
        }
        else if (tDist > lDist)
        {
            dist = lDist+(tDist-lDist);
        }
        else
        {
            dist = tDist+(lDist-tDist);
        }
        return dist * curPage.get("scale_number");
    }
    else
    {
        if (!token1)
        {
            log("Token not found "+ token1 );
            
        }
        if (!token2)
        {
            log("Token not found "+ token2 );
            
        }
    }
}

var targetType = ["Single"];
on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    // var args = msg.content.split(/\s+/);
    var args = msg.content.split(";;");
    
    if (msg.type == "api" && msg.content.indexOf("!AreaTarget") === 0) {
        
        var tokenId = args[1];
        tokenId = tokenId.replace(" ", "")
        var bodyPart = args[2];
        
        log(args)
        var tok = getObj("graphic", tokenId);
        
        var casting = state.HandoutSpellsNS.turnActions[tokenId].casting
        log(args.length)
        if(_.isEmpty(casting)){
            log(state.HandoutSpellsNS.turnActions[tokenId].channel)
            casting = state.HandoutSpellsNS.turnActions[tokenId].channel
            tok = getObj("graphic", casting.areaToken);
            log(tok.get("width"))
            radius = tok.get("width") / 70 * 2;
        }
        else if(state.HandoutSpellsNS.crit == 1){
            log('crit area')
            let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType"])
            radius = parseInt(spellStats["TargetType"].split(" ")[1]) + state.HandoutSpellsNS.coreValues.CritRadius - 2.5
        }
        else {
            log('regular area')
            let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType"])
            radius = parseInt(spellStats["TargetType"].split(" ")[1]) - 2.5
        }

        //get playerId
        var playerId = getPlayerFromToken(tokenId)
        //create rectical token
        createObj("graphic", 
        {
            controlledby: playerId,
            left: tok.get("left")+70,
            top: tok.get("top"),
            width: 70,
            height: 70,
            name: "tempMarker",
            pageid: tok.get("pageid"),
            imgsrc: "https://s3.amazonaws.com/files.d20.io/images/187401034/AjTMrQLnUHLv9HWlwBQzjg/thumb.png?1608754234",
            layer: "objects",
            aura1_radius: radius,
            showplayers_aura1: true,
        });
        target = findObjs({_type: "graphic", name: "tempMarker"})[0];
        toFront(target);
        log('token created')
        
        sendChat("System",'/w "' + getObj("graphic", tokenId).get("name") + '" [Cast Spell](!CastTarget;;' + tokenId + ";;" + bodyPart + ")");
        
        state.HandoutSpellsNS.areaCount = 0;
    }
    
    if (msg.type == "api" && msg.content.indexOf("!CastTarget") === 0) {
        var attacker = args[1];
        
        var names = [];
        log(state.HandoutSpellsNS.targets)
        _.each(state.HandoutSpellsNS.targets, function(token){
            obj = getObj("graphic", token)
            s = obj.get("bar1_value")
            log(typeof s)
            if(typeof s === "number"){
                sendChat("", ["!DefenseAction", attacker, token, args[2]].join(";;"))
                names.push(obj.get("name"));
            }
            else {
                // remove from target list
                var idx = state.HandoutSpellsNS.targets.indexOf(token);
                log(idx)
                state.HandoutSpellsNS.targets.splice(idx, 1)
            }
            obj.set("tint_color", "transparent");
        });
        log(state.HandoutSpellsNS.targets)
        // sendChat("", "Spell targeted at " + names.join(", "))
        // state.HandoutSpellsNS.targets = [];
        
        targetToken = findObjs({
            _type: "graphic",
            name: "tempMarker",
        })[0];
        
        state.HandoutSpellsNS.targetLoc = [targetToken.get("top"), targetToken.get("left")];
        
        targetToken.remove();
    }
});

var changed = false;
on("change:graphic", _.debounce((obj,prev)=>{
    if(obj.get('left')==prev['left'] && obj.get('top')==prev['top']) return;
    if (obj.get("name") == "tempMarker"){
        var allTokens = findObjs({
            _type: "graphic",
            _pageid: obj.get("pageid"),
            layer: "objects",
        });
        
        var target = findObjs({
            _type: "graphic", 
            name: "tempMarker",
        })[0];
        log(target)
        
        state.HandoutSpellsNS.targets = [];
        
        _.each(allTokens, function(token){
            // log(token.get("id"))
            if(token.get("id") != target.get("id")){
                range = getRadiusRange(token.get("id"), target.get("id"));
                if (range <= radius){
                    token.set("tint_color", "#ffff00")
                    state.HandoutSpellsNS.targets.push(token.get("id"))
                }
                else {
                    token.set("tint_color", "transparent")
                }
            }
        });
    }
}));

