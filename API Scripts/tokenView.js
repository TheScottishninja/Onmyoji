
on("change:graphic", _.debounce((obj,prev)=>{
	log("view change")
    if(obj.get('left')==prev['left'] && obj.get('top')==prev['top'] && obj.get('rotation')==prev['rotation']) return;

    if(obj.get("name").includes("_facing")){
    	//position must match original token
    	token = getObj("graphic", obj.get("name").substring(0, obj.get("name").indexOf("_")));
    	obj.set("left", token.get("left"))
    	obj.set("top", token.get("top"))

    	//change direction of token to match facing
    	//assume left facing to start

    	// log(obj.get("rotation"))
    	if((obj.get("rotation") % 360) < 180){
    		//face right
    		token.set("fliph", true)
    	}
    	else{
    		//face left
    		token.set("fliph", false)
    	}
    }
    else {
    	var facing = findObjs({
            _type: "graphic",
            _pageid: obj.get("pageid"),
            name: obj.get("id") + "_facing",
        })[0];

        if(facing){
        	facing.set("top", obj.get("top"))
        	facing.set("left", obj.get("left"))
        }
    }

}));

on("destroy:graphic", function(obj){
    log('remove facing')

    var facing = findObjs({
        _type: "graphic",
        _pageid: obj.get("pageid"),
        name: obj.get("id") + "_facing",
    })[0];

    if(facing){
    	facing.remove()
    }
});