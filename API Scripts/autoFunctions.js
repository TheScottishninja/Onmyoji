
function applyDamage(tokenId, damageAmount, damageType, bodyPart){
	const charId = spellCasting.getCharFromToken(tokenId)

	if(bodyPart.length > 1) {
		bodyPart = bodyPart[Math.floor(Math.random() * bodyPart.length)];
	}

	if(damageType != "Bind"){
		spirit = spellCasting.getAttrObj(charId, "spirit")
		if(spirit.get("current") > 0 & damageType != "Pierce"){
			//replace with get resists later
			const resist = 0.0;
			const spiritArmor = getAttrByName(charId, "SpiritArmor")

			var damage = (1 - resist) * damageAmount - spiritArmor
			spirit.set("current", Math.min(0, spirit.get("current") - damage))

			if(spirit.get("current") == 0){
				// cancel spellcasting when spirit hits 0
				cancelSpells(tokenId)
			}
		}
		else{
			// damage dealt to body part
			bodyPart = bodyPart.toLowerCase()
			bodyPart = bodyPart.replace(" ", "_")
			var health = spellcasting.getAttrObj(charId, "health_" + bodyPart)
			const physicalArmor = getAttrByName(charId, "PhysicalArmor")

			var damage = damageAmount - physicalArmor
			health.set("current", Math.min(0, health.get("current")))

			// roll for an injury
		}
	}
	else {
		// bind damage dealt
		binding = getAttrObj(charId, "Binding")
		binding.set("current", binding.get("current") + damageAmount)
	}
}

on("change:graphic:bar1_value", function(obj){
    // on damage or healing to spirit
    currentSpirit = obj.get("bar1_value")
    charId = spellcasting.getCharFromToken(obj.get("id"))

    binding = getAttrObj(charId, "Binding")
    binding.set("max", currentSpirit)
});

on("change:graphic:bar2_value change:graphic:bar2_max", function(obj) {
	charId = spellcasting.getCharFromToken(obj.get("id"))

    binding = getAttrObj(charId, "Binding")
    
	speedReduce = binding.get("current") / binding.get("max")

    // update movement speed
    movement = getAttrObj(charId, "Move")
    moveBase = getAttrByName(charId, "Move_base")
    // how to get other movement mods?
    movement.set("current", Math.floor(speedReduce * moveBase))
});