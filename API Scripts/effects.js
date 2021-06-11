function knockback(obj){
	log("knockback")
	moveObj = getObj('graphic', obj.target);
	pageid = moveObj.get("pageid")
    page = getObj("page", pageid)
    var gridSize = 70 * parseFloat(page.get("snapping_increment"));

    x1 = parseFloat(moveObj.get("left"))
    y1 = parseFloat(moveObj.get("top"))
    x2 = obj.position[0]
    y2 = obj.position[1]
    log(x1)
    log(y1)

    dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    vecx = (x2 - x1) / dist
    vecy = (y2 - y1) / dist
    log(dist)
    log(vecx)
    log(vecy)

    newLeft = x1 + vecx * obj.distance / 5 * gridSize
    newTop = y1 + vecy * obj.distance / 5 * gridSize

    moveObj.set({
    	"left": newLeft,
    	"top": newTop
    })

    // manually run function for on:change graphic
    bshields.Collision.changeGraphic(moveObj, {"top": y1, "left": x1})
}

on("chat:message", async function(msg) {   
    'use string';
    
    if('api' !== msg.type) {
        return;
    }
    var args = msg.content.split(/\s+/);
    
    if (msg.type == "api" && msg.content.indexOf("!KnockTest") === 0) {
    	tokenId = args[1]
    	top = parseFloat(getObj('graphic', tokenId).get("top"))
    	left = parseFloat(getObj('graphic', tokenId).get("left"))

    	knockback({
    		"target": tokenId,
    		"position": [left, top - 200],
    		"distance": 15
    	})
    }
});