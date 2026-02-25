Per your design preference, armor and unarmored defense are implemented the same way under the hood: both register AC formulas via features. The runtime resolves a single base AC formula by priority, then applies additive AC bonuses.
  Why This Model Works
•	Armor, natural armor, and unarmored defense are mutually competing base AC formulas in 5e-like rules.
•	Shields and miscellaneous bonuses are usually additive, not alternative base formulas.
•	Feature-based registration means AC behavior can come from class, subclass, race, item, or spell using one system.
  Character Fields for AC Runtime
character.ActiveACFormulas = [
  // { sourceId, formulaId, priority, compute }
];

character.ActiveACBonuses = [
  // numeric bonuses or source-stamped bonus entries
];
  Equip Armor (User Can Choose What Armor They Wear)
The editor must let the user select a specific armor item from inventory. Equipping armor should not hardcode AC directly. It should activate armor features that register an AC formula and any related bonuses/constraints.
23.	Validate armor item exists in inventory and is of armor type.
24.	If armor category is shield, assign EquippedShieldId; otherwise assign EquippedArmorId.
25.	Reverse previous equipped armor/shield effects for that slot if replacing.
26.	Apply this item's onEquip features (including AC formula or acBonusDelta).
27.	Recompute derived values (ArmorClass, speed penalties, stealth flags, etc.).
10.4 AC Formula Priority (Option A)
Priority winner model: choose the highest-priority active base formula, then add all legal AC bonuses. This matches your selected Option A and keeps overlap handling simpler.
function computeArmorClass(character) {
  let base = 10 + character.sMods.DEX; // default fallback formula
  let bestPriority = -Infinity;

  for (const entry of character.ActiveACFormulas) {
    if (entry.priority > bestPriority) {
      bestPriority = entry.priority;
      base = entry.compute(character);
    }
  }

  for (const bonus of character.ActiveACBonuses) {
    base += typeof bonus === "number" ? bonus : bonus.value;
  }

  character.ArmorClass = base;
}
  Examples of AC Formula Sources
// light armor
compute: (c) => armor.BaseAC + c.sMods.DEX

// medium armor
compute: (c) => armor.BaseAC + Math.min(c.sMods.DEX, armor.DexCap ?? 2)

// heavy armor
compute: (c) => armor.BaseAC

// monk unarmored defense
compute: (c) => 10 + c.sMods.DEX + c.sMods.WIS

// barbarian unarmored defense
compute: (c) => 10 + c.sMods.DEX + c.sMods.CON
  Heavy Armor Penalties as Derived Effects
Do not permanently mutate base Speed when heavy armor STR requirements are not met. Treat penalties as derived/conditional outputs in the compute pipeline or as source-stamped modifiers that can be removed cleanly.
•	This prevents speed corruption when armor is unequipped or STR later changes.
•	It also avoids hidden state bugs during level up/down or item swaps.
