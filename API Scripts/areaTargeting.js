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

function getExtentsRadius(targetToken, radius){
    log("extents")

    // radius is in units, convert to pixels
    pageid = targetToken.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    var radiusP = gridSize * radius / 5

    // for circle area, extents are plus/minus from center
    top = targetToken.get("top")
    left = targetToken.get("left")
    log(top)
    // upper left of extents
    ul = [top - radiusP - gridSize / 2, left - radiusP - gridSize / 2]
    // lower right of extents
    lr = [top + radiusP + gridSize / 2, left + radiusP + gridSize / 2]

    return ul
}

function createAreaTiles(targetToken, radius, tokenId, spellName){
    log("create tiles")
    ul = getExtentsRadius(targetToken, radius)

    pageid = targetToken.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    targetTop = targetToken.get("top")
    targetLeft = targetToken.get("left")

    let spellHandout = findObjs({_type: "handout", name: spellName})[0];
    var imgsrc = spellHandout.get("avatar")
    imgsrc = imgsrc.replace("max", "thumb")

    log("start loops")
    for (var i = radius * 2 / 5; i >= 0; i--) {
        for (var j = radius * 2 / 5; j >= 0; j--) {
            top = ul[0] + gridSize * i;
            left = ul[1] + gridSize * j;

            blocking = checkBarriers(targetToken.get("id"), [left, top])
            dist = Math.sqrt((top - targetTop) ** 2 + (left - targetLeft) ** 2)
            if(dist < radius * gridSize / 5 & blocking.length < 1){
                // create the token
                createObj("graphic", 
                {
                    controlledby: "",
                    left: left,
                    top: top,
                    width: gridSize,
                    height: gridSize,
                    name: tokenId + "_" + spellName,
                    pageid: pageid,
                    imgsrc: imgsrc,
                    layer: "objects",
                    bar2_Value: tokenId
                });
            }
        }
    }

    tiles = findObjs({
        _type: "graphic",
        name: tokenId + "_" + spellName,
        pageid: pageid
    })

    _.each(tiles, function(tile){
        toBack(tile)
    })
}

function getRadiusRange(token1, token2){
        
    var curPageID = findObjs({_type: "campaign"})[0].get("playerpageid");
    var curPage = findObjs({_type: "page", _id: curPageID})[0];
        
    var token1 =  findObjs({_type: "graphic", layer:"objects", _pageid: curPageID, _id: token1})[0];
    var token2 =  findObjs({_type: "graphic", layer:"objects", _pageid: curPageID, _id: token2})[0];

    if (token1 && token2)
    {   
        var gridSize = 70 * parseFloat(curPage.get("snapping_increment"));
        var lDist = Math.abs(token1.get("left")-token2.get("left"))/gridSize;
        var tDist = Math.abs(token1.get("top")-token2.get("top"))/gridSize;
        
        return Math.sqrt(lDist ** 2 + tDist ** 2) * parseInt(curPage.get("scale_number"))
        // var dist = 0;
        // if (tDist == lDist)
        // {
        //     dist = tDist;
        // }
        // else if (tDist > lDist)
        // {
        //     dist = lDist+(tDist-lDist);
        // }
        // else
        // {
        //     dist = tDist+(lDist-tDist);
        // }
        // return dist * curPage.get("scale_number");
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

state.HandoutSpellsNS["effectColors"] = {
    "Exorcism": "#ffe599"
}

// state.HandoutSpellsNS.targetLoc = {}

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
        page = getObj("page", tok.get("pageid"))
        var gridSize = 70 * parseFloat(page.get("snapping_increment"));
        
        var casting = state.HandoutSpellsNS.turnActions[tokenId].casting
        log(args.length)
        if(_.isEmpty(casting)){
            log(state.HandoutSpellsNS.turnActions[tokenId].channel)
            casting = state.HandoutSpellsNS.turnActions[tokenId].channel
            // get channeled area spell info from when it was cast
            charId = getCharFromToken(tokenId)
            let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName + "_" + charId, ["TargetType", "Center"])
            // could check for crit and change radius
            outRadius = spellStats["TargetType"].split(" ")[1];
            radius = parseInt(outRadius) - 5
            targetTop = spellStats["Center"].split(",")[0]
            targetLeft = spellStats["Center"].split(",")[1]
        }
        else if(state.HandoutSpellsNS.crit[tokenId] == 1){
            log('crit area')
            let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType"])
            outRadius = parseInt(spellStats["TargetType"].split(" ")[1]) + state.HandoutSpellsNS.coreValues.CritRadius;
            radius = parseInt(spellStats["TargetType"].split(" ")[1]) + state.HandoutSpellsNS.coreValues.CritRadius - 5
            targetTop = tok.get("top")
            targetLeft = tok.get("left") + gridSize
        }
        else {
            log('regular area')
            let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType"])
            outRadius = parseInt(spellStats["TargetType"].split(" ")[1]);
            radius = parseInt(spellStats["TargetType"].split(" ")[1]) - 5
            targetTop = tok.get("top")
            targetLeft = tok.get("left") + gridSize
        }

        //get playerId
        var playerId = getPlayerFromToken(tokenId)
        //create rectical token
        createObj("graphic", 
        {
            controlledby: playerId,
            left: targetLeft,
            top: targetTop,
            width: gridSize * 2,
            height: gridSize * 2,
            name: tokenId + "_tempMarker",
            pageid: tok.get("pageid"),
            imgsrc: "https://s3.amazonaws.com/files.d20.io/images/224919952/9vk474L2bhdjVy4YkcsLww/thumb.png?16221158945",
            layer: "objects",
            aura1_radius: radius,
            showplayers_aura1: true,
        });
        target = findObjs({_type: "graphic", name: tokenId + "_tempMarker"})[0];
        toFront(target);
        log('token created')
        
        sendChat("System",'/w "' + getObj("graphic", tokenId).get("name") + '" [Cast Spell](!CastAreaTarget;;' + tokenId + ";;" + bodyPart + ";;" + outRadius + ")");
        
        state.HandoutSpellsNS.areaCount[tokenId] = 0;
        state.HandoutSpellsNS.radius[target.get("id")] = outRadius;
    }
    
    if (msg.type == "api" && msg.content.indexOf("!CastAreaTarget") === 0) {
        log("cast target")
        var attacker = args[1];
        var radius = parseInt(args[3]);
        
        var names = [];
        var loopTargets = [...state.HandoutSpellsNS.targets[attacker]]

        targetToken = findObjs({
            _type: "graphic",
            name: attacker + "_tempMarker",
        })[0];

        _.each(loopTargets, function(token){
            log(state.HandoutSpellsNS.targets[attacker])
            obj = getObj("graphic", token)
            s = obj.get("bar2_value")
            log(s)
            if(s !== ""){
                sendChat("", ["!DefenseAction", attacker, token, args[2]].join(";;"))
                names.push(obj.get("name"));
            }
            else {
                // check if token causes compounding
                
                // remove from target list
                log("remove invalid token from target list")
                var idx = state.HandoutSpellsNS.targets[attacker].indexOf(token);
                log(idx)
                state.HandoutSpellsNS.targets[attacker].splice(idx, 1)
            }
            obj.set("tint_color", "transparent");

        });
        log(state.HandoutSpellsNS.targets[attacker])
        if(state.HandoutSpellsNS.targets[attacker].length == 0){
            sendChat("", ["!DefenseAction", attacker, "", args[2]].join(";;"))
        }
        // sendChat("", "Spell targeted at " + names.join(", "))
        // state.HandoutSpellsNS.targets = [];
        
        state.HandoutSpellsNS.areaCount[attacker] = 0;

        var casting = state.HandoutSpellsNS.turnActions[attacker].casting
        if(_.isEmpty(casting)){
            casting = state.HandoutSpellsNS.turnActions[attacker].channel
            // move the tokens
            charId = getCharFromToken(attacker)
            let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName + "_" + charId, ["Center"])
            center = spellStats["Center"].split(",")
            log(center)
            moveTop = parseInt(targetToken.get("top")) - parseInt(center[0])
            log(moveTop)
            moveLeft = parseInt(targetToken.get("left")) - parseInt(center[1])
            log(moveLeft)

            log("move token")
            areaTokens = findObjs({
                _type: "graphic",
                name: attacker + "_" + casting.spellName,
                pageid: getObj("graphic", attacker).get("pageid")
            })
            log(areaTokens.length)
            _.each(areaTokens, function(areaToken){
                areaToken.set({
                    "top": areaToken.get("top") + moveTop,
                    "left": areaToken.get("left") + moveLeft
                });
            })
        }
        else {
             createAreaTiles(targetToken, radius, attacker, casting.spellName)
        }
        state.HandoutSpellsNS.targetLoc[attacker] = [targetToken.get("top"), targetToken.get("left")]
        targetToken.remove();
        log("target token removed")
    }
});

function getRadialTargets(obj, source, includeSource=false){
    const targetInfo = obj.ongoingAttack.currentAttack.targetType
    var allTokens = findObjs({
        _type: "graphic",
        _pageid: getObj("graphic", obj.tokenId).get("pageid"),
        layer: "objects",
    });
    
    var targets = [];
    const radius = targetInfo.shape.width
    // var blockedTargets = [];
    // log(obj.tokenId)
    
    for(let i=0; i<allTokens.length; i++){
        token = allTokens[i]
        var targetId = token.get("id")
        // log(targetId)
        // log(obj.tokenId)
        if(targetId != source | includeSource){
            var range = getRadiusRange(targetId, targetInfo.shape.targetToken);
            log(range)
            var blocking = checkBarriers(targetId, targetInfo.shape.targetToken)
            var s = token.get("bar2_value")
            // log(s)
            if ((range <= radius) & (blocking.length < 1) & (s !== "")){
                token.set("tint_color", "#ffff00")
                targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
            }
            else if((range <= radius) & (blocking.length > 0) & (s !== "")){
                token.set("tint_color", "transparent")
                targets.push("primary." + targetId + "." + targetInfo.shape.bodyPart)
                // blockedTargets.push(token.get("id"))
            }
            else {
                token.set("tint_color", "transparent")
            }
        }
        if(targetId == source){
            log("caster")
            // turn on aura for token
            token.set({
                aura1_radius: targetInfo.shape.width,
                showplayers_aura1: true
            })
        }
    };

    return targets;
}

var changed = false;
// on("change:graphic", _.debounce((obj,prev)=>{
//     log("graphic change")
//     if(obj.get('left')==prev['left'] && obj.get('top')==prev['top']) {
//         log("no change")
//         return;
//     }
//     log(obj.get("top"))
//     log(obj.get("left"))
//     if (obj.get("name").includes("tempMarker")){
//         var allTokens = findObjs({
//             _type: "graphic",
//             _pageid: obj.get("pageid"),
//             layer: "objects",
//         });
        
//         var target = obj
//         var radius = state.HandoutSpellsNS.radius[obj.get("id")]
//         attackerId = target.get("name").substring(0, target.get("name").indexOf("_tempMarker"))
//         log(attackerId)
        
//         state.HandoutSpellsNS.targets[attackerId] = [];
//         state.HandoutSpellsNS.blockedTargets[attackerId] = [];
        
//         _.each(allTokens, function(token){
//             // log(token.get("id"))
//             if(token.get("id") != target.get("id")){
//                 range = getRadiusRange(token.get("id"), target.get("id"));
//                 log(range)
//                 blocking = checkBarriers(token.get("id"), target.get("id"))
//                 s = token.get("bar2_value")
//                 log(s)
//                 if ((range <= radius) & (blocking.length < 1) & (s !== "")){
//                     token.set("tint_color", "#ffff00")
//                     state.HandoutSpellsNS.targets[attackerId].push(token.get("id"))
//                 }
//                 else if((range <= radius) & (blocking.length > 0) & (s !== "")){
//                     token.set("tint_color", "transparent")
//                     state.HandoutSpellsNS.targets[attackerId].push(token.get("id"))
//                     state.HandoutSpellsNS.blockedTargets[attackerId].push(token.get("id"))
//                 }
//                 else {
//                     token.set("tint_color", "transparent")
//                 }
//             }
//         });
//     }
//     else {
//         //check for moving onto static effects
//         statics = state.HandoutSpellsNS.staticEffects
//         log(statics)
//         if(_.isEmpty(statics)){
//             obj.set("tint_color", "transparent");
//             return;
//         }
//         for(var areaToken in statics){
//             var range = getRadiusRange(obj.get("id"), areaToken)
//             if(range <= statics[areaToken].radius){
//                 // inside effect
//                 obj.set("tint_color", state.HandoutSpellsNS.effectColors[statics])
//             }
//             else {
//                 obj.set("tint_color", "transparent")
//             }
//         }
//     }
// }));

on('change:jukeboxtrack', function(track){
    log('track change')
    log(track)

    if(track.get("playing")){
        // show the name of the track playing
        text_box = getObj("text", "-Maa1OoerLRQRnMmRN8E")
        log(text_box)
        text_box.set("text", track.get("title"))
    }
    else{
       text_box = getObj("text", "-Maa1OoerLRQRnMmRN8E").set("text", "No Track playing") 
    }
})
