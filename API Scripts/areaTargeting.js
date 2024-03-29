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

function getExtentsRadius(targetToken, radius, self=false){
    log("extents")
    log(targetToken)

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
    var ul = [top - radiusP - gridSize / 2, left - radiusP - gridSize / 2]
    if(self){
        ul = [top - radiusP, left - radiusP]
    }
    // lower right of extents
    // lr = [top + radiusP + gridSize / 2, left + radiusP + gridSize / 2]

    return ul
}

state.HandoutSpellsNS.epsilon = 0.001;

function createConeTiles(obj){
    log("create cone tiles")

    targetToken = getObj("graphic", obj.currentAttack.targetType.shape.targetToken)
    radius = obj.currentAttack.targetType.shape.len
    tokendId = obj.tokenId
    spellName = obj.id
    fov = obj.currentAttack.targetType.shape.width

    if(!targetToken.get("name").includes("_facing")){
        log("ERROR: createConeTiles found targetToken that is not a tile")
    }

    // self = (obj.currentAttack.targetType.shape.source != "tile")

    // ul = getExtentsCone(path)
    ul = getExtentsRadius(targetToken, radius, true)

    pageid = targetToken.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    targetTop = targetToken.get("top")
    targetLeft = targetToken.get("left")

    // create a unique id for spell instance
    spellInstance = generateUUID()

    log("start loops")
    for (var i = radius * 2 / 5; i >= 0; i--) {
        for (var j = radius * 2 / 5; j >= 0; j--) {
            top = ul[0] + gridSize * i;
            left = ul[1] + gridSize * j;

            // for cones, don't put token under caster
            if((top == targetTop) && (left == targetLeft)){continue}

            // check in range and not blocked
            blocking = checkBarriers(targetToken.get("id"), [left, top])
            dist = Math.sqrt((top - targetTop) ** 2 + (left - targetLeft) ** 2)
            log(dist)

            // checkFOV
            var x = left - targetLeft
            var y = top - targetTop

            var angle = Math.atan2(y, x) * 180 / Math.PI
            angle += 90
            if(angle > 180){
                angle = -(360 - angle)
            }
            log(angle)
            log(targetToken)
            facing_angle = parseFloat(targetToken.get("rotation")) % 360
            if(facing_angle > 180){
                facing_angle = -(360 - facing_angle)
            }
            log(facing_angle)
            var inFOV = false;
            if(Math.abs(facing_angle - angle) <= (fov/2)){
                inFOV = true;
            }
            if((facing_angle == 180 || angle == 180) && Math.abs(facing_angle + angle) <= (fov/2)){
                // special case where signs prevent proper detection
                inFOV = true;
            }
            log(inFOV)
            if(Math.abs(dist - (radius * gridSize / 5)) < state.HandoutSpellsNS.epsilon && (blocking.length < 1) && inFOV){
                // create the token
                createObj("graphic", 
                {
                    controlledby: "",
                    left: left,
                    top: top,
                    width: gridSize,
                    height: gridSize,
                    name: tokenId + "_" + spellName + "_" + spellInstance,
                    pageid: pageid,
                    imgsrc: obj.tileImage,
                    layer: "objects",
                    bar2_value: tokenId,
                    gmnotes: "areaToken",
                    represents: "-MsjtzqOoChhhSaZPx4c"
                });
            }
        }
    }

    // if target, create a tile under target token
    if(obj.currentAttack.targetType.shape.source == "target"){
        createObj("graphic", 
        {
            controlledby: "",
            left: targetToken.get("left"),
            top: targetToken.get("top"),
            width: gridSize,
            height: gridSize,
            name: tokenId + "_" + spellName + "_" + spellInstance,
            pageid: pageid,
            imgsrc: obj.tileImage,
            layer: "objects",
            bar2_value: tokenId,
            gmnotes: "areaToken",
            represents: "-MsjtzqOoChhhSaZPx4c"
        });
    }

    tiles = findObjs({
        _type: "graphic",
        name: tokenId + "_" + spellName + "_" + spellInstance,
        pageid: pageid
    })

    _.each(tiles, function(tile){
        toBack(tile)
    })

    return tiles
}

function createBeamTiles(obj){
    log("create beam tiles")

    targetToken = getObj("graphic", obj.currentAttack.targetType.shape.targetToken)
    radius = obj.currentAttack.targetType.shape.len
    tokendId = obj.tokenId
    spellName = obj.id
    beam_width = obj.currentAttack.targetType.shape.width / 2.0
    if(!targetToken.get("name").includes("_facing")){
        log("ERROR: createBeamTiles found targetToken that is not a tile")
    }

    // self = (obj.currentAttack.targetType.shape.source != "tile")
    fov = 180

    // ul = getExtentsCone(path)
    ul = getExtentsRadius(targetToken, Math.max(radius, 2.0*beam_width), true)

    pageid = targetToken.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    targetTop = targetToken.get("top")
    targetLeft = targetToken.get("left")

    // create a unique id for spell instance
    spellInstance = generateUUID()

    log("start loops")
    for (var i = radius * 2 / 5; i >= 0; i--) {
        for (var j = radius * 2 / 5; j >= 0; j--) {
            top = ul[0] + gridSize * i;
            left = ul[1] + gridSize * j;

            // for cones, don't put token under caster
            if((top == targetTop) && (left == targetLeft)){continue}

            // check in range and not blocked
            blocking = checkBarriers(targetToken.get("id"), [left, top])
            dist = Math.sqrt((top - targetTop) ** 2 + (left - targetLeft) ** 2)
            log(dist)

            // checkFOV
            var x = left - targetLeft
            var y = top - targetTop
            
            var angle = Math.atan2(y, x) * 180 / Math.PI
            // normal vector to angle
            angle += 90
            if(angle > 180){
                angle = -(360 - angle)
            }
            log(angle)
            facing_angle = parseFloat(targetToken.get("rotation")) % 360
            n = {
                x: Math.cos(facing_angle * Math.PI / 180), 
                y: Math.sin(facing_angle * Math.PI / 180)
            }
            if(facing_angle > 180){
                facing_angle = -(360 - facing_angle)
            }
            log(facing_angle)

            var inFOV = false;
            if(Math.abs(facing_angle - angle) <= (fov/2)){
                inFOV = true;
            }
            if((facing_angle == 180 || angle == 180) && Math.abs(facing_angle + angle) <= (fov/2)){
                // special case where signs prevent proper detection
                inFOV = true;
            }
            log(inFOV)

            // check beam radius
            // vector from source to target
            // v = {
            //     x: getObj("graphic", target).get("left") - getObj("graphic", source).get("left"),
            //     y: getObj("graphic", target).get("top") - getObj("graphic", source).get("top")
            // }
            // projection onto normal using dot product
            d = (x * n.x) + (y * n.y)
            
            ndist = Math.abs(d) / gridSize * 5
            log(ndist)
            max_range = Math.max(radius, 2.0*beam_width)
            if(Math.abs(dist - (max_range * gridSize / 5)) < state.HandoutSpellsNS.epsilon && (blocking.length < 1) && inFOV && 
                Math.abs(ndist - beam_width) < state.HandoutSpellsNS.epsilon){
                // create the token
                createObj("graphic", 
                {
                    controlledby: "",
                    left: left,
                    top: top,
                    width: gridSize,
                    height: gridSize,
                    name: tokenId + "_" + spellName + "_" + spellInstance,
                    pageid: pageid,
                    imgsrc: obj.tileImage,
                    layer: "objects",
                    bar2_value: tokenId,
                    gmnotes: "areaToken",
                    represents: "-MsjtzqOoChhhSaZPx4c"
                });
            }
        }
    }

    // if target, create a tile under target token
    if(obj.currentAttack.targetType.shape.source != "self"){
        createObj("graphic", 
        {
            controlledby: "",
            left: targetToken.get("left"),
            top: targetToken.get("top"),
            width: gridSize,
            height: gridSize,
            name: tokenId + "_" + spellName + "_" + spellInstance,
            pageid: pageid,
            imgsrc: obj.tileImage,
            layer: "objects",
            bar2_value: tokenId,
            gmnotes: "areaToken",
            represents: "-MsjtzqOoChhhSaZPx4c"
        });
    }


    tiles = findObjs({
        _type: "graphic",
        name: tokenId + "_" + spellName + "_" + spellInstance,
        pageid: pageid
    })

    _.each(tiles, function(tile){
        toBack(tile)
    })

    return tiles
}

function createAreaTiles(obj){
    log("create tiles")

    targetToken = getObj("graphic", obj.currentAttack.targetType.shape.targetToken)
    radius = obj.currentAttack.targetType.shape.len
    tokenId = obj.tokenId
    spellName = obj.id
    self = (obj.currentAttack.targetType.shape.source != "tile")

    ul = getExtentsRadius(targetToken, radius, self)

    pageid = targetToken.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    targetTop = targetToken.get("top")
    targetLeft = targetToken.get("left")

    // let spellHandout = findObjs({_type: "handout", name: spellName})[0];
    // var imgsrc = spellHandout.get("avatar")
    // imgsrc = imgsrc.replace("med", "thumb")

    // create a unique id for spell instance
    spellInstance = generateUUID()

    log("start loops")
    for (var i = radius * 2 / 5; i >= 0; i--) {
        for (var j = radius * 2 / 5; j >= 0; j--) {
            top = ul[0] + gridSize * i;
            left = ul[1] + gridSize * j;

            blocking = checkBarriers(targetToken.get("id"), [left, top])
            dist = Math.sqrt((top - targetTop) ** 2 + (left - targetLeft) ** 2)
            if(Math.abs(dist - (radius * gridSize / 5)) < state.HandoutSpellsNS.epsilon & blocking.length < 1){
                log("create")
                // create the token
                createObj("graphic", 
                {
                    controlledby: "",
                    left: left,
                    top: top,
                    width: gridSize,
                    height: gridSize,
                    name: tokenId + "_" + spellName + "_" + spellInstance,
                    pageid: pageid,
                    imgsrc: obj.tileImage,
                    layer: "objects",
                    bar2_value: tokenId,
                    gmnotes: "areaToken",
                    represents: "-MsjtzqOoChhhSaZPx4c"
                });
            }
        }
    }

    tiles = findObjs({
        _type: "graphic",
        name: tokenId + "_" + spellName + "_" + spellInstance,
        pageid: pageid
    })

    _.each(tiles, function(tile){
        toBack(tile)
    })

    return tiles
}

function getRadiusRange(token1, token2){
        
    var curPageID = findObjs({_type: "campaign"})[0].get("playerpageid");
    var curPage = findObjs({_type: "page", _id: curPageID})[0];
        
    var token1 =  findObjs({_type: "graphic", _pageid: curPageID, _id: token1})[0];
    var token2 =  findObjs({_type: "graphic", _pageid: curPageID, _id: token2})[0];

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
    
//     if (msg.type == "api" && msg.content.indexOf("!AreaTarget") === 0) {
        
//         var tokenId = args[1];
//         tokenId = tokenId.replace(" ", "")
//         var bodyPart = args[2];
        
//         log(args)
//         var tok = getObj("graphic", tokenId);
//         page = getObj("page", tok.get("pageid"))
//         var gridSize = 70 * parseFloat(page.get("snapping_increment"));
        
//         var casting = state.HandoutSpellsNS.turnActions[tokenId].casting
//         log(args.length)
//         if(_.isEmpty(casting)){
//             log(state.HandoutSpellsNS.turnActions[tokenId].channel)
//             casting = state.HandoutSpellsNS.turnActions[tokenId].channel
//             // get channeled area spell info from when it was cast
//             charId = getCharFromToken(tokenId)
//             let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName + "_" + charId, ["TargetType", "Center"])
//             // could check for crit and change radius
//             outRadius = spellStats["TargetType"].split(" ")[1];
//             radius = parseInt(outRadius) - 5
//             targetTop = spellStats["Center"].split(",")[0]
//             targetLeft = spellStats["Center"].split(",")[1]
//         }
//         else if(state.HandoutSpellsNS.crit[tokenId] == 1){
//             log('crit area')
//             let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType"])
//             outRadius = parseInt(spellStats["TargetType"].split(" ")[1]) + state.HandoutSpellsNS.coreValues.CritRadius;
//             radius = parseInt(spellStats["TargetType"].split(" ")[1]) + state.HandoutSpellsNS.coreValues.CritRadius - 5
//             targetTop = tok.get("top")
//             targetLeft = tok.get("left") + gridSize
//         }
//         else {
//             log('regular area')
//             let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName, ["TargetType"])
//             outRadius = parseInt(spellStats["TargetType"].split(" ")[1]);
//             radius = parseInt(spellStats["TargetType"].split(" ")[1]) - 5
//             targetTop = tok.get("top")
//             targetLeft = tok.get("left") + gridSize
//         }

//         //get playerId
//         var playerId = getPlayerFromToken(tokenId)
//         //create rectical token
//         createObj("graphic", 
//         {
//             controlledby: playerId,
//             left: targetLeft,
//             top: targetTop,
//             width: gridSize * 2,
//             height: gridSize * 2,
//             name: tokenId + "_tempMarker",
//             pageid: tok.get("pageid"),
//             imgsrc: "https://s3.amazonaws.com/files.d20.io/images/224919952/9vk474L2bhdjVy4YkcsLww/thumb.png?16221158945",
//             layer: "objects",
//             aura1_radius: radius,
//             showplayers_aura1: true,
//         });
//         target = findObjs({_type: "graphic", name: tokenId + "_tempMarker"})[0];
//         toFront(target);
//         log('token created')
        
//         sendChat("System",'/w "' + getObj("graphic", tokenId).get("name") + '" [Cast Spell](!CastAreaTarget;;' + tokenId + ";;" + bodyPart + ";;" + outRadius + ")");
        
//         state.HandoutSpellsNS.areaCount[tokenId] = 0;
//         state.HandoutSpellsNS.radius[target.get("id")] = outRadius;
//     }
    
//     if (msg.type == "api" && msg.content.indexOf("!CastAreaTarget") === 0) {
//         log("cast target")
//         var attacker = args[1];
//         var radius = parseInt(args[3]);
        
//         var names = [];
//         var loopTargets = [...state.HandoutSpellsNS.targets[attacker]]

//         targetToken = findObjs({
//             _type: "graphic",
//             name: attacker + "_tempMarker",
//         })[0];

//         _.each(loopTargets, function(token){
//             log(state.HandoutSpellsNS.targets[attacker])
//             obj = getObj("graphic", token)
//             s = obj.get("bar2_value")
//             log(s)
//             if(s !== ""){
//                 sendChat("", ["!DefenseAction", attacker, token, args[2]].join(";;"))
//                 names.push(obj.get("name"));
//             }
//             else {
//                 // check if token causes compounding
                
//                 // remove from target list
//                 log("remove invalid token from target list")
//                 var idx = state.HandoutSpellsNS.targets[attacker].indexOf(token);
//                 log(idx)
//                 state.HandoutSpellsNS.targets[attacker].splice(idx, 1)
//             }
//             obj.set("tint_color", "transparent");

//         });
//         log(state.HandoutSpellsNS.targets[attacker])
//         if(state.HandoutSpellsNS.targets[attacker].length == 0){
//             sendChat("", ["!DefenseAction", attacker, "", args[2]].join(";;"))
//         }
//         // sendChat("", "Spell targeted at " + names.join(", "))
//         // state.HandoutSpellsNS.targets = [];
        
//         state.HandoutSpellsNS.areaCount[attacker] = 0;

//         var casting = state.HandoutSpellsNS.turnActions[attacker].casting
//         if(_.isEmpty(casting)){
//             casting = state.HandoutSpellsNS.turnActions[attacker].channel
//             // move the tokens
//             charId = getCharFromToken(attacker)
//             let spellStats = await getFromHandout("PowerCard Replacements", casting.spellName + "_" + charId, ["Center"])
//             center = spellStats["Center"].split(",")
//             log(center)
//             moveTop = parseInt(targetToken.get("top")) - parseInt(center[0])
//             log(moveTop)
//             moveLeft = parseInt(targetToken.get("left")) - parseInt(center[1])
//             log(moveLeft)

//             log("move token")
//             areaTokens = findObjs({
//                 _type: "graphic",
//                 name: attacker + "_" + casting.spellName,
//                 pageid: getObj("graphic", attacker).get("pageid")
//             })
//             log(areaTokens.length)
//             _.each(areaTokens, function(areaToken){
//                 areaToken.set({
//                     "top": areaToken.get("top") + moveTop,
//                     "left": areaToken.get("left") + moveLeft
//                 });
//             })
//         }
//         else {
//              createAreaTiles(targetToken, radius, attacker, casting.spellName)
//         }
//         state.HandoutSpellsNS.targetLoc[attacker] = [targetToken.get("top"), targetToken.get("left")]
//         targetToken.remove();
//         log("target token removed")
//     }

//     if (msg.type == "api" && msg.content.indexOf("!BeamTest") === 0){
//         source = args[1]
//         target = args[2]

//         facing = findObjs({type: "graphic", name: source + "_facing"})[0]
//         log(facing.get("rotation"))
//         angle = (facing.get("rotation") % 360) * (Math.PI / 180)
//         log(angle)
//         log(getRadiusBeam(target, source, angle))
//     }
});

function getRadialTargets(obj, source){
    const targetInfo = obj.currentAttack.targetType
    log(targetInfo)
    var allTokens = findObjs({
        _type: "graphic",
        _pageid: getObj("graphic", source).get("pageid"),
        layer: "objects",
    });
    
    var targets = [];
    var radius = targetInfo.shape.len
    log(radius)
    if(radius == "melee"){radius = Math.sqrt(50)}
    const includeSource = targetInfo.shape.includeSource
    // var blockedTargets = [];
    // log(obj.tokenId)
    
    for(let i=0; i<allTokens.length; i++){
        token = allTokens[i]
        var targetId = token.get("id")
        var targetGroup = "primary"
        
        if(targetId == obj.tokenId){
            // check source is included
            targetToken = getObj("graphic", targetInfo.shape.targetToken)
            if(includeSource != ""){
                targetGroup = includeSource
            }
            // check if token lines up with targetToken
            else if(token.get("left") == targetToken.get("left") && token.get("top") == targetToken.get("top")){
                continue
            }
        }

        var range = getRadiusRange(targetId, targetInfo.shape.targetToken);
        log(range)
        var blocking = checkBarriers(targetId, targetInfo.shape.targetToken)
        var s = token.get("bar2_value")
        // log(s)
        if (range - radius < state.HandoutSpellsNS.epsilon && (blocking.length < 1) & (s !== "")){
            token.set("tint_color", "#ffff00")
            targets.push(targetGroup + "." + targetId + "." + targetInfo.shape.bodyPart)
        }
        else if(range - radius < state.HandoutSpellsNS.epsilon && (blocking.length > 0) & (s !== "")){
            token.set("tint_color", "transparent")
            targets.push(targetGroup + "." + targetId + "." + targetInfo.shape.bodyPart)
            // blockedTargets.push(token.get("id"))
        }
        else {
            token.set("tint_color", "transparent")
        }

    };

    return targets;
}

function createBeam(obj, source){
    var token = getObj("graphic", source)
    rot = token.get("rotation")
    page = getObj("page", token.get("pageid"))
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    token_width = token.get("width") / gridSize * 5

    targetInfo = obj.currentAttack.targetType
    range = targetInfo.shape.len
    if(range == "melee"){
        // display melee range as 5ft
        range = 5
    }
    range = ((range + 2.5) / 5 * gridSize)
    // range = range / 5 * gridSize
    width = targetInfo.shape.width / 10.0 * gridSize

    beamString = "[\"L\"," + width.toString() + ", 0]," +
        "[\"L\"," + width.toString() + ", " + range.toString() + "]," + 
        "[\"L\",-" + width.toString() + ", " + range.toString() + "]," +
        "[\"L\",-" + width.toString() + ", 0]"

    log(beamString)

    createObj("path", 
        {
            layer: "objects",
            _path: "[[\"M\",0,0]," + beamString + ",[\"L\",0,0]]",
            controlledby: "",
            top: token.get("top"),
            left: token.get("left"),
            width: 2 * width,
            height: 2 * range,
            pageid: token.get("_pageid"),
            fill: "#ebe571",
            rotation: rot,
            stroke_width: 0,
            stroke: "#ebe571"
        });
    
    path = findObjs({_type: "path", _path: "[[\"M\",0,0]," + beamString + ",[\"L\",0,0]]"})[0]

    targetInfo.shape["path"] = path.get("_id")
}

function getRadiusBeam(target, source, angle){
    var tok = getObj("graphic", source);
    page = getObj("page", tok.get("pageid"))
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    // vector from source to target
    v = {
        x: getObj("graphic", target).get("left") - getObj("graphic", source).get("left"),
        y: getObj("graphic", target).get("top") - getObj("graphic", source).get("top")
    }
    // normal vector to angle
    n = {
        x: Math.cos(angle), 
        y: Math.sin(angle)
    }
    // projection onto normal using dot product
    d = (v.x * n.x) + (v.y * n.y)
    
    // var w = getObj("graphic", source).get("width")
    // if(w > gridSize){ 
    //     // double wide targetToken, has an offset
    //     log("tile targetToken")
    //     return Math.abs(d) / gridSize * 5 + 5
    // }
    // else {
    // }
    return Math.abs(d) / gridSize * 5
}

function getBeamTargets(obj, source){
    log("beam get targets")
    const targetInfo = obj.currentAttack.targetType
    var allTokens = findObjs({
        _type: "graphic",
        _pageid: getObj("graphic", source).get("pageid"),
        layer: "objects",
    });

    var tok = getObj("graphic", source);
    page = getObj("page", tok.get("pageid"))
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    
    var targets = [];
    var len = targetInfo.shape.len
    if(len == "melee"){
        // display melee range as 5ft
        len = 5
    }
    var radius = Math.max(len, targetInfo.shape.width / 2.0)
    var beam_width = Math.min(targetInfo.shape.width / 2.0, len / 2.0)
    var angle = tok.get("rotation") * (Math.PI / 180) 

    const includeSource = targetInfo.shape.includeSource
    // var blockedTargets = [];
    // log(obj.tokenId)
    
    for(let i=0; i<allTokens.length; i++){
        token = allTokens[i]
        var targetId = token.get("id")
        var targetGroup = "primary"
        
        if(targetId == obj.tokenId){
            // check source is included
            if(includeSource != ""){
                targetGroup = includeSource
            }
            else {
                continue
            }
        }
    
        var dist = getRadiusBeam(targetId, targetInfo.shape.targetToken, angle);
        var range = getRadiusRange(targetId, targetInfo.shape.targetToken)
        var direction = checkFOV(tok, targetId, 180)
        var blocking = checkBarriers(targetId, targetInfo.shape.targetToken)
        var s = token.get("bar2_value")
        width = token.get("width") / gridSize * 2.5 + beam_width
        log("dist: " + dist.toString())
        log("width: " + beam_width.toString())
        log("range: " + range.toString())

        if (dist - beam_width < state.HandoutSpellsNS.epsilon && (blocking.length < 1) && (s !== "") && 
            range - radius < state.HandoutSpellsNS.epsilon && direction){
            token.set("tint_color", "#ffff00")
            targets.push(targetGroup + "." + targetId + "." + targetInfo.shape.bodyPart)
        }
        else if(dist - beam_width < state.HandoutSpellsNS.epsilon && (blocking.length > 0) && (s !== "") && 
            range - radius < state.HandoutSpellsNS.epsilon && direction){
            token.set("tint_color", "transparent")
            targets.push(targetGroup + "." + targetId + "." + targetInfo.shape.bodyPart)
            // blockedTargets.push(token.get("id"))
        }
        else {
            token.set("tint_color", "transparent")
        }
    };

    return targets;
}

function createCone(obj, source){
    var token = getObj("graphic", source)
    rot = token.get("rotation")
    page = getObj("page", token.get("pageid"))
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));
    token_width = token.get("width") / gridSize * 5

    targetInfo = obj.currentAttack.targetType
    range = targetInfo.shape.len
    if(range == "melee"){
        // display melee range as 5ft
        range = 5
    }
    range = ((range + 2.5) / 5 * gridSize)
    angle = targetInfo.shape.width / 2
    angle = angle * (Math.PI / 180) 

    x = Math.sin(angle) * range
    y = Math.cos(angle) * range
    // how to account for other angles in z?
    tangent = Math.sqrt(2) * x //
    var curveString = ""
    height = y
    
    log(angle)
    if(angle <= 0.7854){
        log("one")
        z = 2 * range - y
        curveString = "[\"L\"," + x.toString() + ", -" + y.toString() + "]," +
            "[\"Q\",0,-" + z.toString() + ",-" + x.toString() + ",-" + y.toString() + "]"
    }
    else if(angle <= 1.5708){
        log("two")
        // make 2 b curves
        split_angle = angle / 2
        b_x = Math.sin(split_angle) * range
        b_y = Math.cos(split_angle) * range
        z = 2 * range - b_y
        log(x)
        log(y)
        curveString = "[\"L\"," + x.toString() + ",-" + y.toString() + "]," +
            "[\"Q\"," + (Math.sin(split_angle) * z).toString() + ",-" + (Math.cos(split_angle) * z).toString() + ", 0,-" + range.toString() + "],[\"Q\"," +
            (Math.sin(-split_angle) * z).toString() + ", -" + (Math.cos(split_angle) * z).toString() + ", -" + x.toString() + ",-" + y.toString() + "]"
        log(curveString)
        height = range
    }
    else{
        log("three, not handled for now")
        // make two 90 sections and two variable sections
        // corner_angle = Math.PI / 4
        // c_y = Math.cos(corner_angle) * range
        // c_z = 2 * range - c_y
        // log(c_z)
        // // make two sections with remainder
        // split_angle = (angle - (Math.PI / 2)) / 2
        // b_x = Math.cos(split_angle) * range
        // b_y = Math.sin(split_angle) * range
        // // get x and y for 90 degree section
        // z = 2 * range - b_x
        // curveString = "[\"L\"," + b_x.toString() + "," + b_y.toString() + "]," +
        //     "[\"Q\"," + (Math.cos(split_angle/2) * z).toString() + ", " + (Math.sin(split_angle/2) * z).toString() + ", " + range.toString() + ", 0],[\"Q\"," +
        //     (Math.sin(corner_angle) * c_z).toString() + ",-" + (Math.cos(corner_angle) * c_z).toString() + ", 0,-" + range.toString() + "],[\"Q\"," + 
        //     "-" + (Math.sin(corner_angle) * c_z).toString() + ", -" + (Math.cos(corner_angle) * c_z).toString() + ", -" + range.toString() + ", 0]" //,[\"Q\"," +
        //     // (Math.sin(-split_angle) * z).toString() + ", " + (Math.cos(split_angle) * z).toString() + ", " + b_x.toString() + ", " + b_y.toString() + "]"
        // log(curveString)
        // height = range
    }
    // z = Math.sqrt(2 * range * range) - (token.get("width") / 2)
    log(curveString)

    createObj("path", 
        {
            layer: "objects",
            _path: "[[\"M\",0,0]," + curveString + ",[\"L\",0,0]]",
            // controlledby: playerId,
            top: token.get("top"),
            left: token.get("left"),
            width: 2 * x,
            height: 2 * height,
            pageid: token.get("_pageid"),
            fill: "#ebe571",
            rotation: rot,
            stroke_width: 0,
            stroke: "#ebe571"
        });
    
    path = findObjs({_type: "path", _path: "[[\"M\",0,0]," + curveString + ",[\"L\",0,0]]"})[0]

    targetInfo.shape["path"] = path.get("_id")
}

function checkFOV(facing, tokenId, fov){
	log("checkFOV")
	// var facing = getObj("path", coneId)

	// var viewer = getObj("graphic", viewerId)
	var token = getObj("graphic", tokenId)
    if(token.get("left") == facing.get("left") && token.get("top") == facing.get("top")){ return true}
	// page = getObj("page", token.get("pageid"))

	var x = parseFloat(token.get("left")) - parseFloat(facing.get("left"))
	var y = parseFloat(token.get("top")) - parseFloat(facing.get("top"))

	var angle = Math.atan2(y, x) * 180 / Math.PI
	//angle = (angle + 450) % 360
	angle += 90
	if(angle > 180){
		angle = -(360 - angle)
	}
	log(angle)
	facing_angle = parseFloat(facing.get("rotation")) % 360
	if(facing_angle > 180){
		facing_angle = -(360 - facing_angle)
	}
	// fov = facing.get("limit_field_of_night_vision_total")
	// facing_distance = parseInt(facing.get("night_vision_distance")) / 5 * gridSize
	log(facing_angle)
	// log(fov)
	if(Math.abs(facing_angle - angle) <= (fov/2)){
		return true;
	}
    if((facing_angle == 180 || angle == 180) && Math.abs(facing_angle + angle) <= (fov/2)){
        // special case where signs prevent proper detection
		return true;
	}
	else {
		return false;
	}
}

function getConeTargets(obj, source){
    const targetInfo = obj.currentAttack.targetType
    var allTokens = findObjs({
        _type: "graphic",
        _pageid: getObj("graphic", source).get("pageid"),
        layer: "objects",
    });
    
    var targets = [];
    var radius = targetInfo.shape.len
    if(radius == "melee"){
        // melee measure range to catch diagonals
        radius = Math.sqrt(50)
    }
    var facing_token = getObj("graphic", source)
    // if(!facing_token.get("name").includes("_facing")){
    //     facing_token = findObjs({
    //         _type: "graphic",
    //         _pageid: getObj("graphic", source).get("pageid"),
    //         name: source + "_facing"
    //     })[0]
    //     if(!facing_token){
    //         log("no facing token?")
    //         return
    //     }
    // }
    const includeSource = targetInfo.shape.includeSource
    // var blockedTargets = [];
    // log(obj.tokenId)
    
    for(let i=0; i<allTokens.length; i++){
        token = allTokens[i]
        var targetId = token.get("id")
        var targetGroup = "primary"
        
        if(targetId == obj.tokenId){
            // check source is included
            if(includeSource != ""){
                targetGroup = includeSource
            }
            else {
                continue
            }
        }

        var range = getRadiusRange(targetId, targetInfo.shape.targetToken);
        log(range)
        var blocking = checkBarriers(targetId, targetInfo.shape.targetToken)
        var s = token.get("bar2_value")
        // log(s)
        if (range - radius < state.HandoutSpellsNS.epsilon & (blocking.length < 1) & (s !== "")){
            // check angle
            if(checkFOV(facing_token, targetId, targetInfo.shape.width)){
                token.set("tint_color", "#ffff00")
                targets.push(targetGroup + "." + targetId + "." + targetInfo.shape.bodyPart)
            }
            else{
                token.set("tint_color", "transparent")
            }
        }
        else if(range - radius < state.HandoutSpellsNS.epsilon & (blocking.length > 0) & (s !== "")){
            // check angle
            if(checkFOV(facing_token, targetId, targetInfo.shape.width)){
                token.set("tint_color", "transparent")
                targets.push(targetGroup + "." + targetId + "." + targetInfo.shape.bodyPart)
                // blockedTargets.push(token.get("id"))
            }
            else{
                token.set("tint_color", "transparent")
            }
        }
        else {
            token.set("tint_color", "transparent")
        }
    };

    return targets;
}

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
