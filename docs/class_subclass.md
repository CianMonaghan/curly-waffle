
Classes should be treated as structured feature producers plus progression metadata. A class object itself stores configuration and progression state; the visible sheet changes come from class-linked feature applications and compute functions.

  What the Class Object Usually Owns
•	Class identity (id, name).
•	Current level in that class.
•	Hit die size and HP progression rules.
•	Proficiency grants (saves, armor, weapons, skills, tools).
•	Feature progression table by level.
•	Optional choices at specific levels (fighting style, subclass pick, etc.).
•	Spellcasting progression metadata (if implemented).

   How Class Selection Modifies the Character (Level 1 Attach)
When the user adds a class at level 1, the editor should translate the class attachment into a sequence of feature applications plus class progression registration.
13.	Create/attach ClassObject to character.Classes.
14.	Apply level 1 class proficiencies as features (save profs, armor/weapons, skill choices).
15.	Apply level 1 class features as features (e.g., Rage, Spellcasting, Second Wind, etc.).
16.	Set or derive hit points based on hit die + CON modifier rules.
17.	Recompute derived values.

  How Class Leveling Changes the Sheet
•	Total level changes -> ProficiencyBonus may change.
•	Class level changes -> class feature unlocks trigger new feature instances.
•	HP max changes -> from hit die progression + CON modifier contribution + feature bonuses.
•	Spellcasting resources (if modeled) change via class progression or features.
•	Attack/save/skill values can change indirectly from new proficiencies or stat changes granted by class features.

   Class-to-Sheet Influence Matrix
Class component                     -> Character sheet impact
Level                               -> total level, proficiency bonus, feature unlocks
Hit die                             -> max HP progression / short-rest resources (if modeled)
Save proficiencies                  -> saving throw proficiency values
Armor/weapon/tool proficiencies     -> prof lists, equipment legality UI
Skill choices                       -> skill profs and sheet totals
Class features                      -> varies; can affect almost any field
Subclass selection gate             -> unlocks subclass feature pipeline
Spellcasting progression metadata   -> slots/resources/spells known/prepared (if implemented)


  Subclass System README - How Subclasses Layer on Top of Classes
Subclasses should not bypass the class system. They are class-scoped feature bundles attached at a class-defined unlock level. The subclass object primarily contributes feature progression and configuration choices.
  
   Subclass Attachment Rules
•	Subclass selection is validated against a parent class.
•	A class can usually have one active subclass path (unless your homebrew permits alternatives).
•	Subclass features unlock at subclass progression levels mapped to class levels.
   
   Subclass Application Mechanics
18.	User selects subclass in editor.
19.	Character stores subclass object linked to parent class progression.
20.	System applies all subclass features currently unlocked by the class's current level.
21.	AppliedFeatureRecords are tagged with subclass source metadata.
22.	Future class level-ups may unlock more subclass features.
   
   Subclass Influence on the Character Sheet
Subclass features can affect any sheet region through modifications. In implementation terms, subclass effects are indistinguishable from other features once translated into modifications.
•	Combat bonuses, extra proficiencies, movement changes.
•	AC formulas or bonuses (e.g., defensive subclass traits).
•	Resource pools and actions.
•	Spell additions or prepared/known spell rules.
•	Skill/tool/language additions.
•	Replacement/override mechanics (if modeled carefully with layers).
