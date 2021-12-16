// source: https://github.com/Roll20/roll20-api-scripts/blob/master/Collision%20Detection/2.2/Collision%20Detection.js

    
var polygonPaths = [],
    behaviors = {
        DONT_MOVE: 1,
        WARN_PLAYER: 2,
        STOP_AT_WALL: 4
    },
    config = {},
    configDefaults = {
        pathColor: '#ff00ff',
        layer: 'walls',
        behavior: behaviors.STOP_AT_WALL
    };

Object.defineProperties(config, {
    pathColor: {
        get: function() {
            var stPathColor = state.bshields.Collision.config.pathColor;
            
            if (!(stPathColor && (stPathColor.length === 6 || stPathColor.length === 7))) {
                return configDefaults.pathColor;
            }
            
            if (stPathColor.length === 7) {
                stPathColor = stPathColor.substr(1);
            }
            if (isNaN(parseInt(stPathColor, 16))) {
                return configDefaults.pathColor;
            }
            return '#' + stPathColor;
        }
    },
    layer: {
        get: function() {
            var stLayer = state.bshields.Collision.config.layer;
            
            if (!stLayer && stLayer !== 'all' && stLayer !== 'walls' && stLayer !== 'gmlayer' && stLayer !== 'objects' && stLayer !== 'map') {
                return configDefaults.layer;
            }
            return stLayer;
        }
    },
    behavior: {
        get: function() {
            var stBehavior = state.bshields.Collision.config.behavior;
            
            if (!stBehavior) {
                return configDefaults.behavior;
            }
            
            switch (stBehavior.toLowerCase()) {
                case 'don\'t move':
                    return behaviors.DONT_MOVE;
                case 'warn player':
                    return behaviors.WARN_PLAYER;
                case 'stop at wall':
                    return behaviors.STOP_AT_WALL;
                
                case 'don\'t move & warn player':
                    return behaviors.DONT_MOVE | behaviors.WARN_PLAYER;
                case 'warn player & stop at wall':
                    return behaviors.WARN_PLAYER | behaviors.STOP_AT_WALL;
                
                default:
                    return configDefaults.behavior;
            }
        }
    }
});

function addPath(obj) {
    // log("add path")
    var path;
    
    if (obj.get('pageid') === Campaign().get('playerpageid') ||
        obj.get('stroke').toLowerCase() === config.pathColor ||
        (config.layer === 'all' && obj.get('layer') === config.layer)) {


            path = JSON.parse(obj.get('path'));
            if (path.length > 1 && path[1][0] !== 'L') { 
                return; }
            polygonPaths.push(obj);
        }
    

    // log("path has added")
    // var playerIds = obj.get("controlledby") // player that drew line
    // playerIds = playerIds.split(",")
    
    // var target = false
    // _.each(playerIds, function(playerId){
    //     if(playerIsGM(playerId) & "" in state.HandoutSpellsNS.Drawing){
    //         lineLength(obj.get("id"), state.HandoutSpellsNS.Drawing[""])
    //         target = true
    //     }
        
    //     if(playerId in state.HandoutSpellsNS.Drawing){
    //         lineLength(obj.get("id"), state.HandoutSpellsNS.Drawing[playerId])
    //         target = true
    //     }
    // })
    
    // if(target) {obj.remove();}
    // log("done")
}

function destroyPath(obj) {
    polygonPaths = _.reject(polygonPaths, function(path) { return path.id === obj.id; });

    playerIds = obj.get("controlledby").split(",")

    _.each(playerIds, function(playerId){
        if(playerId in state.HandoutSpellsNS.Drawing){
            tokenId = state.HandoutSpellsNS.Drawing[playerId][1]
            var casting = state.HandoutSpellsNS.turnActions[tokenId].casting;
            if(casting.line == obj.get("_id")) {casting["line"] = ""}
        }
    })
}

function changePath(obj, prev) {
    log("change path")
    var path;

    //check if there is a cone target
    currentTurn = state.HandoutSpellsNS.currentTurn
    if(!_.isEmpty(currentTurn) && !_.isEmpty(currentTurn.ongoingAttack.currentAttack) && "targetType" in currentTurn.ongoingAttack.currentAttack){
        const targetInfo = currentTurn.ongoingAttack.currentAttack.targetType
        log(targetInfo)
        if("shape" in targetInfo){
            if(targetInfo.shape.type == "cone" & "path" in targetInfo.shape){
                if(obj.get("id") == targetInfo.shape.path){
                    // ensure it lines up with token
                    obj.set({
                        top: getObj("graphic", targetInfo.shape.targetToken).get("top"),
                        left: getObj("graphic", targetInfo.shape.targetToken).get("left")
                    })

                    // update target highlights
                    var targets = getConeTargets(currentTurn.ongoingAttack, targetInfo.shape.targetToken)
                    currentTurn.parseTargets(targets)
                }

            }
            else if(targetInfo.shape.type == "beam" & "path" in targetInfo.shape){
                if(obj.get("id") == targetInfo.shape.path){
                    // ensure it lines up with token
                    obj.set({
                        top: getObj("graphic", targetInfo.shape.targetToken).get("top"),
                        left: getObj("graphic", targetInfo.shape.targetToken).get("left")
                    })

                    // update target highlights
                    var targets = getBeamTargets(currentTurn.ongoingAttack, targetInfo.shape.targetToken)
                    currentTurn.parseTargets(targets)
                }
            }
        }
    }
    
    if (config.layer === 'all') { return; }
    
    if (obj.get('layer') === config.layer && prev.layer !== config.layer) {
        if (obj.get('pageid') !== Campaign().get('playerpageid') ||
            obj.get('stroke').toLowerCase() !== config.pathColor) { return; }
        
        path = JSON.parse(obj.get('path'));
        if (path.length > 1 && path[1][0] !== 'L') { return; }
        polygonPaths.push(obj);
    }
    
    if (obj.get('layer') !== config.layer && prev.layer === config.layer) {
        polygonPaths = _.reject(polygonPaths, function(path) { return path.id === obj.id; });
    }
}

function changeGraphic(obj, prev) {
    
    //---------------------- Area Target --------------------------------------
    log("graphic change")
    if (obj.get('subtype') !== 'token' ||
    (obj.get('top') === prev.top && obj.get('left') === prev.left) && !obj.get("name").includes("_facing")) { return false; }
    currentTurn = state.HandoutSpellsNS.currentTurn
    // if(obj.get('left')==prev['left'] && obj.get('top')==prev['top']) {
    //     log("no change")
    //     return;
    // }

    // replace this with get radial target
    // get current turn from 
    if(!_.isEmpty(currentTurn) && !_.isEmpty(currentTurn.ongoingAttack) && !_.isEmpty(currentTurn.ongoingAttack.currentAttack)){
        const targetInfo = currentTurn.ongoingAttack.currentAttack.targetType
        log(targetInfo)
        if("shape" in targetInfo){
            if(targetInfo.shape.targetToken == obj.get("id")){
                // moved target is the target token
                // check range with caster
                var distance = getRadiusRange(currentTurn.tokenId, targetInfo.shape.targetToken)
                if(distance > targetInfo.range){
                    // out of range, revert motion
                    obj.set({
                        left: prev['left'],
                        top: prev['top']
                    })
                    if("path" in targetInfo.shape){
                        var facing = getObj("path", targetInfo.shape.path)
                        facing.set("top", obj.get("top"))
                        facing.set("left", obj.get("left"))
                    }
                    WSendChat("System", currentTurn.tokenId, "Target is out of range. Max range: **" + targetInfo.range + "ft**")
                }
                if(targetInfo.shape.type == "radius"){
                    var targets = getRadialTargets(currentTurn.ongoingAttack, targetInfo.shape.targetToken)
                    currentTurn.parseTargets(targets)
                }
                else if(targetInfo.shape.type == "cone" & "path" in targetInfo.shape){
                    var path = getObj("path", targetInfo.shape.path)
                    changePath(path, {"layer": path.get("layer")})
                }
            }
        }
    }

    else {
        //check for moving onto static effects
        // log(state.HandoutSpellsNS.staticEffects)
        const statics = state.HandoutSpellsNS.staticEffects
        if(_.isEmpty(statics)){
            obj.set("tint_color", "transparent");
            // return;
        }
        // for(var areaToken in statics){
        //     var range = getRadiusRange(obj.get("id"), areaToken)
        //     if(range <= statics[areaToken].radius){
        //         // inside effect
        //         obj.set("tint_color", state.HandoutSpellsNS.effectColors[statics])
        //     }
        //     else {
        //         obj.set("tint_color", "transparent")
        //     }
        // }
    }
    
    //--------------------- Collision --------------------------------------------
    var character, l1 = L(P(prev.left, prev.top), P(obj.get('left'), obj.get('top')));
    
    
    // if (obj.get('represents') !== '') {
    //     character = getObj('character', obj.get('represents'));
    //     if (character.get('controlledby') === '') { return false; } // GM-only character
    // } else if (obj.get('controlledby') === '') { return false; } // GM-only token
    
    var collided = false;
    _.each(polygonPaths, function(path) {
        var x = path.get('left') - path.get('width') / 2,
        y = path.get('top') - path.get('height') / 2,
        parts = JSON.parse(path.get('path')),
        pointA = P(parts[0][1] + x, parts[0][2] + y); // this line causes in issue with a random line then shows up
        parts.shift();
        _.each(parts, function(pt) {
            var pointB = P(pt[1] + x, pt[2] + y),
            l2 = L(pointA, pointB),
            denom = (l1.p1.x - l1.p2.x) * (l2.p1.y - l2.p2.y) - (l1.p1.y - l1.p2.y) * (l2.p1.x - l2.p2.x),
            intersect, who, player, vec, norm;
            
            if (denom !== 0) {
                intersect = P(
                    (l1.p1.x * l1.p2.y - l1.p1.y * l1.p2.x) * (l2.p1.x - l2.p2.x) - (l1.p1.x - l1.p2.x) * (l2.p1.x * l2.p2.y - l2.p1.y * l2.p2.x),
                    (l1.p1.x * l1.p2.y - l1.p1.y * l1.p2.x) * (l2.p1.y - l2.p2.y) - (l1.p1.y - l1.p2.y) * (l2.p1.x * l2.p2.y - l2.p1.y * l2.p2.x)
                    );
                    intersect.x /= denom;
                    intersect.y /= denom;
                    
                    if (isBetween(pointA, pointB, intersect) &&
                    isBetween(l1.p1, l1.p2, intersect)) {
                        // Collision event!
                        if ((config.behavior & behaviors.DONT_MOVE) === behaviors.DONT_MOVE) {
                            obj.set({
                            left: Math.round(l1.p1.x),
                            top: Math.round(l1.p1.y)
                        });
                    }
                    
                    if ((config.behavior & behaviors.WARN_PLAYER) === behaviors.WARN_PLAYER) {
                        if (obj.get('represents')) {
                            character = getObj('character', obj.get('represents'));
                            who = character.get('name');
                        } else if (obj.get('controlledby') === 'all') {
                            who = 'all';
                        } else {
                            player = getObj('player', obj.get('controlledby'));
                            who = player.get('displayname');
                        }
                        
                        if (who !== 'all') {
                            sendChat('System', '/w "' + who + '" You are not permitted to move that token into that area.');
                        } else {
                            sendChat('System', 'Token ' + obj.get('name') + ' is not permitted in that area.');
                        }
                    }
                    
                    if ((config.behavior & behaviors.STOP_AT_WALL) === behaviors.STOP_AT_WALL) {
                        // change to grid square
                        vec = P(l1.p2.x - l1.p1.x, l1.p2.y - l1.p1.y);
                        // norm = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
                        vec.x /= Math.abs(vec.x);
                        vec.y /= Math.abs(vec.y);

                        const pageid = obj.get("pageid")
                        const page = getObj("page", pageid)
                        const gridSize = 70 * parseFloat(page.get("snapping_increment"));
                        remainder = P(intersect.x % gridSize, intersect.y % gridSize)

                        // if vec is negative, add gridsize - remainder
                        // if vec is positive, subtract remainder
                        square = P(0, 0)
                        if(vec.x < 0){square.x = gridSize - remainder.x}
                        else {square.x = -1 * remainder.x}
                        if(vec.y < 0){square.y = gridSize - remainder.y}
                        else {square.y = -1 * remainder.y}
                        
                        obj.set({
                            left: intersect.x + square.x + gridSize/2,
                            top: intersect.y + square.y + gridSize/2
                        });
                        
                        // calculate and deal splat damage
                        collided = true;
                    }
                    
                    
                }
            }
            
            pointA = P(pointB.x, pointB.y);
        });
    });

    //-------------------------------- Facing ------------------------------------
    // if(obj.get('left')==prev['left'] && obj.get('top')==prev['top'] && obj.get('rotation')==prev['rotation']) return;
    // log("view change")
    
    if(obj.get("name").includes("_facing")){
        log("facing token change")
        //position must match original token
        token = getObj("graphic", obj.get("name").substring(0, obj.get("name").indexOf("_")));
        if(!obj.get("name").includes("target")){
            obj.set("left", token.get("left"))
            obj.set("top", token.get("top"))
            flipToken(obj.get("id"))
        }
    
        //change direction of token to match facing
        //assume left facing to start
    
        // log(obj.get("rotation"))
        
        //check if there is a cone target
        if(!_.isEmpty(currentTurn) && !_.isEmpty(currentTurn.ongoingAttack) && !_.isEmpty(currentTurn.ongoingAttack.currentAttack)){
            const targetInfo = currentTurn.ongoingAttack.currentAttack.targetType
            log(targetInfo)
            if("shape" in targetInfo){
                if(targetInfo.shape.type == "cone" & "path" in targetInfo.shape){
                    // rotate cone to match facing
                    cone = getObj("path", targetInfo.shape.path)
                    cone.set("rotation", obj.get("rotation"))

                    // update target highlights
                    changePath(cone, {"layer": cone.get("layer")})
                }
                else if(targetInfo.shape.type == "beam" & "path" in targetInfo.shape){
                    // rotate beam to match facing
                    beam = getObj("path", targetInfo.shape.path)
                    beam.set("rotation", obj.get("rotation"))

                    // update target highlights
                    changePath(beam, {"layer": beam.get("layer")})
                }
            }
        }
    }
    else {
        // move facing to token
        var facing = findObjs({
            _type: "graphic",
            _pageid: obj.get("pageid"),
            name: obj.get("id") + "_facing",
        })[0];
    
        if(facing){
            facing.set("top", obj.get("top"))
            facing.set("left", obj.get("left"))
        }
        
        // move cone/beam to token
        if(!_.isEmpty(currentTurn) && !_.isEmpty(currentTurn.ongoingAttack) && !_.isEmpty(currentTurn.ongoingAttack.currentAttack)){
            const targetInfo = currentTurn.ongoingAttack.currentAttack.targetType
            if("shape" in targetInfo){
                if("path" in targetInfo.shape){
                    var facing = getObj("path", targetInfo.shape.path)
                    facing.set("top", obj.get("top"))
                    facing.set("left", obj.get("left"))

                    changePath(facing, {"layer": facing.get("layer")})
                }
            }
        }
        
        //-------------------------- Track Movement -----------------------------------
        // check if move was reset
        
        if(!_.isEmpty(currentTurn)){
            currentMove = parseInt(obj.get("bar3_value"))
            log(currentMove)
            coords = obj.get("lastmove").split(",")
            if(coords[0] == obj.get("left") && coords[1] == obj.get("top")){
                // ctrl+z has been used
                log("Move reset")
        
            }
            else{
                // token has moved, decrement remaining movement
                currentMove -= distFromLastMove(obj, coords)
                obj.set("bar3_value", Math.round(currentMove * 10) / 10)
            }
        }
    }
    
    

    return collided;
}

function distFromLastMove(obj, points){
    // log(moveString)
    // log(obj)

    var x0 = obj.get("left")
    var y0 = obj.get("top")

    var page = getObj("page", obj.get("pageid"))
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));

    var dist = 0;

    for (let i = points.length - 1; i >= 0; i-=2) {
        y1 = parseInt(points[i])
        x1 = parseInt(points[i-1])
        
        dist += Math.sqrt((x1 - x0)**2 + (y1 - y0)**2) / gridSize * 5
        log(dist)
        x0 = x1
        y0 = y1
    }

    return dist
}

function P(x, y) { return { x: x, y: y}; }
function L(p1, p2) { return { p1: p1, p2: p2 }; }

function isBetween(a, b, c) {
    var withinX = (a.x <= c.x && c.x <= b.x) || (b.x <= c.x && c.x <= a.x),
        withinY = (a.y <= c.y && c.y <= b.y) || (b.y <= c.y && c.y <= a.y);
    return withinX && withinY;
}

function registerEventHandlers() {
    _.each(findObjs({ type: 'path' }), addPath)
    on('add:path', addPath);
    on('destroy:path', destroyPath);
    on('change:path', changePath);
    on('change:graphic', changeGraphic);
}

function checkInstall() {
    if (!state.bshields ||
        !state.bshields.Collision ||
        !state.bshields.Collision.version ||
            state.bshields.Collision.version !== version) {
        state.bshields = state.bshields || {};
        state.bshields.Collision = {
            version: version,
            gcUpdated: 0,
            config: {}
        }
    }
    checkGlobalConfig();
}

function checkGlobalConfig() {
    var gc = globalconfig && globalconfig.collisiondetection,
        st = state.bshields.Collision;
    
    if (gc && gc.lastsaved && gc.lastsaved > st.gcUpdated) {
        st.gcUpdated = gc.lastsaved;
        st.config.pathColor = gc['Path Color'];
        st.config.layer = gc.Layer;
        st.config.behavior = gc.Behavior;
    }
}

on('ready', function() {
    'use strict';
    
    // bshields.Collision.checkInstall();
    registerEventHandlers();
});