function getPlayerFromToken(tokenId){
    var obj = getObj("graphic", tokenId);
    var playerID = obj.get("controlledby");
    return playerID[0];
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
        var crit = args[2];
        
        log(args)
        var tok = getObj("graphic", tokenId);
        
        var casting = state.HandoutSpellsNS.turnActions[tokenId].casting
        log(args.length)
        if(args.length > 3){
            log(state.HandoutSpellsNS.turnActions[tokenId].channel)
            casting = state.HandoutSpellsNS.turnActions[tokenId].channel
            tok = getObj("graphic", casting.areaToken);
            log(tok)
        }
        let targetType = await getValueFromHandout("PowerCard Replacements", casting.spellName, "TargetType")
        log(tok)
        
        if(crit === "1"){
            radius = parseInt(targetType.split(" ")[1]) + 10 - 2.5
        }
        else {
            radius = parseInt(targetType.split(" ")[1]) - 2.5
        }
        
        //get playerId
        var playerId = tok.get("controlledby");
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
    	});
    	target = findObjs({_type: "graphic", name: "tempMarker"})[0];
    	toFront(target);
    	log('token created')
    	
    	sendChat("","[Cast Spell](!CastTarget;;" + tokenId + ";;" + crit + ")");
    	
    	state.HandoutSpellsNS.areaCount = 0;
    }
    
    if (msg.type == "api" && msg.content.indexOf("!CastTarget") === 0) {
        var attacker = args[1];
        var crit = args[2];
        var names = [];
        log(state.HandoutSpellsNS.targets)
        _.each(state.HandoutSpellsNS.targets, function(token){
            obj = getObj("graphic", token)
            s = obj.get("bar1_value")
            log(s)
            if(typeof s === "number"){
                sendChat("", ["!DefenseAction", attacker, token, "", crit].join(";;"))
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
    
    // if (msg.type == "api" && msg.content.indexOf("!TargetType") === 0) {
    //     targetType = args[1].split(",");
    //     attacker = args[2]; //token id
        
    //     let spellType = await getValueFromHandout("PowerCard Replacements", 
    //         state.HandoutSpellsNS.turnActions[attacker].casting.spellName, "SpellType")
    //     bodyTarget = "";
    //     if(spellType == "Projectile"){
    //         bodyTarget = "&#63;{Target Body Part|&#64;{target|body_parts}}";
    //     }
        
    //     //select targetting method
    //     if(targetType[0] == "Single"){
    //         target = "&#64;{target|token_id}";
    //         targeting = ["!DefenseAction", attacker, target, bodyTarget].join(";;")
    //         log('here')
    //         sendChat("", targetting)
    //     }
    //     else if(targetType[0] == "Radius"){
    //         //area targeting
    //         sendChat("", ["!AreaTarget", attacker, targetType[1]].join(";;"))
    //     }
    //     else if(targetType[0] == "Multi"){
    //         //multi target
    //     }
    //     else if(targetType[0] == "Cone"){
    //         //cone target
    //     }
    //     else if(targetType[0] == "Beam"){
    //         //beam target
    //     }
    // }
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

