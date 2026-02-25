Features
Race and background are best treated as attachment descriptors plus feature bundles. They should not manually mutate fields in editor handlers. Attach, emit features, apply modifications, recompute.
  
 Race System
•	Race contributes base movement rules, languages, traits, proficiencies, and potentially stat adjustments (depending on rules version).
•	Sub-race/lineage can be modeled as nested feature providers or additional attachments.
-   speed is also determined by this
•	Race-based AC formulas (natural armor) fit the same AC formula registration system as armor and unarmored defense.
// natural armor as feature under same AC system
{
  type: "acFormulaRegister",
  payload: {
    formulaId: "natural-armor-lizardfolk",
    priority: 6,
    compute: (c) => Math.max(13 + c.sMods.DEX, 10 + c.sMods.DEX) // example modeling
  }
}


 Background System
•	Background usually influences proficiencies, tools, languages, starting equipment, money, and flavor metadata.
•	Background effects are ideal for listAdd/mapDelta modification types.
•	Background replacement = reverse previous background feature instances + apply new background features.
 
  Influence on Character Sheet
Race / Background component     -> Sheet impact
Languages                      -> language list
Skill proficiencies            -> skill values and prof markers
Tool proficiencies             -> prof list / tool section
Movement traits                -> speed and movement notes
Starting items / currency      -> inventory and currency sections
Trait features                 -> feature list / actions / notes
