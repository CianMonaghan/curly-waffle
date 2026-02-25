Features do not directly mutate arbitrary Character fields. Instead, a feature holds one or more Modification definitions (or builds them at runtime from context) and delegates mutation to Character.applyModification. This is the key abstraction that makes the editor extensible and invertible.

   Feature Structure (Conceptual)
// JavaScript conceptual shape
const feature = {
  id: "feature-id",
  name: "Feature Name",
  trigger: "onAdd" | "onRemove" | "onEquip" | "onUnequip" | "onAttune" | "onUnattune",
  buildModifications(context) {
    // returns array of modification objects
    return [
      { type: "statDelta", payload: { stat: "STR", delta: 2 } },
      { type: "listAdd", payload: { path: "Languages", value: "Elvish" } }
    ];
  }
};

In practice, a feature can be static (predefined modifications) or contextual (builds modifications based on a user choice, item quality, selected subclass option, level, etc.).
   Feature Application Lifecycle
1.	Editor requests feature application (e.g., class selected, item equipped, race attached).
2.	Character generates a feature instance ID and source metadata.
3.	Feature.buildModifications(context) returns a list of modifications.
4.	Each modification is applied through Character.applyModification(mod).
5.	applyModification returns reversalData describing how to undo that exact application.
6.	Character stores AppliedFeatureRecord(instanceId, sourceId, featureId, appliedMods+reversalData).
7.	ComputeAllDerived runs to refresh sheet outputs.

Modifications Are Stored Per Feature Instance
A feature template can be applied multiple times (different sources, different levels, separate item copies). The system must track each application independently. Reversal is instance-based, not template-based.
•	Example: two different magic items each add +1 AC. Removing one should only remove one bonus.
•	Example: leveling down should reverse only features gained at that level.
•	Example: changing subclass path should reverse previous subclass feature instances without affecting class core features.

  Modification Types and Their Effect on the Sheet
Each modification type maps to a category of sheet changes. The exact set can grow, but the important design rule is that each type has symmetric apply/reverse behavior.
•	statDelta: increments/decrements ability score or similar numeric field; impacts scores, modifiers, saves, skills, attacks, AC (if DEX/CON/WIS involved), HP, etc.
•	statSet / statOverride-like behavior: sets a field to a value or minimum/override semantics; must be layered carefully to avoid overlap bugs.
•	listAdd / listRemove: languages, proficiencies, immunities, known options, tags.
•	mapSet / mapDelete / mapDelta: currency, counters, keyed bonuses, proficiency flags, per-skill states.
•	acFormulaRegister / acFormulaUnregister: registers a base AC calculator (armor, natural armor, monk/barbarian unarmored defense, mage armor-like effects).
•	acBonusDelta: additive AC bonuses (shield, ring, defense style, magic bonuses depending on modeling choice).
  
   
   Example: Feature Influencing Multiple Sheet Areas
// Example feature: "Tough" (+1 CON, +5 max HP, +1 save bonus to CON)
{
  id: "toughness-training",
  buildModifications() {
    return [
      { type: "statDelta", payload: { stat: "CON", delta: 1 } },
      { type: "pathDelta", payload: { path: "MaxHpBonus", delta: 5 } },
      { type: "saveBonusDelta", payload: { stat: "CON", delta: 1 } }
    ];
  }
}

// Consequences on sheet after ComputeAllDerived:
// - CON score changes
// - CON modifier may change
// - Max HP changes (possibly from both bonus and new CON mod contribution)
// - CON save changes


