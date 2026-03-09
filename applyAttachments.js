'use strict';

// ─── applyAttachments.js ──────────────────────────────────────────────────────
//
// Atomic attachment appliers for class, subclass, race, and background.
//
// Every function:
//   1. Generates modification records via applyMod()
//   2. Pushes a single entry into character.active_features
//      containing the full applied record and reversalData.
//
// This means any attachment can later be completely reversed by iterating
// its active_features entry in reverse order and calling reverseMod().

const { applyMod } = require('./characterMods');

// ─── Constants ────────────────────────────────────────────────────────────────

// All known D&D 5e language names used for extraction from feature descriptions.
const KNOWN_LANGUAGES = [
    'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
    'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Deep Speech',
    'Infernal', 'Primordial', 'Sylvan', 'Undercommon',
];

// Short stat abbreviation → full name, used to parse race feature IDs.
const STAT_ABBREV = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInstanceId(sourceId) {
    const d    = new Date();
    const date = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${d.getFullYear()}`;
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `${date}-${sourceId}-${rand}`;
}

/** Build a serialisable summary of an applied mod for the active_features record. */
function summarise(applied) {
    const label = (applied.op === 'statAdd' || applied.op === 'statSet')
        ? `${applied.op}:${applied.stat}`
        : `${applied.op}:${applied.path ?? ''}`;
    return { modification: label, reversalData: applied.reversalData };
}

/** Push the full set of applied mods as one atomic active_features entry. */
function recordActiveFeature(character, featureKey, sourceId, featureId, appliedMods) {
    character.active_features.push({
        feature: featureKey,
        applied_feature_record: [{
            applied_modifications: [{
                feature_instance_id: makeInstanceId(sourceId),
                source_id:           sourceId,
                feature_id:          featureId,
                trigger:             'on-apply',
                applied:             appliedMods.map(summarise),
            }],
        }],
    });
}

// ─── Race feature interpretation ──────────────────────────────────────────────
//
// Race templates store mechanical effects as feature IDs using a convention:
//
//   feat-asi-{stat3}-{amount}   → statAdd (e.g. feat-asi-con-2 → CON +2)
//   speed-{amount}-*            → scalarSet on 'speed'
//   *-lang* (with description)  → listAdd non-Common languages
//
// All other features are informational and stored in character.features only.

function raceFeatureToMods(feature) {
    const id = feature.id ?? '';

    // Ability Score Improvement: feat-asi-str-2, feat-asi-wis-1, etc.
    const asiMatch = id.match(/^feat-asi-(str|dex|con|int|wis|cha)-(\d+)$/i);
    if (asiMatch) {
        const stat = STAT_ABBREV[asiMatch[1].toLowerCase()];
        return [{ op: 'statAdd', stat, value: parseInt(asiMatch[2], 10) }];
    }

    // Speed override: speed-25-dwarf, speed-30-elf, etc.
    const speedMatch = id.match(/^speed-(\d+)-/);
    if (speedMatch) {
        return [{ op: 'scalarSet', path: 'speed', value: parseInt(speedMatch[1], 10) }];
    }

    // Language feature: extract all non-Common language names from description
    if (id.includes('-lang')) {
        const desc = feature.description ?? '';
        const langs = KNOWN_LANGUAGES.filter(l => l !== 'Common' && desc.includes(l));
        return langs.map(lang => ({ op: 'listAdd', path: 'languages', value: lang }));
    }

    return [];  // informational only (darkvision, weapon profs, etc.)
}

// ─── Equipment helpers ────────────────────────────────────────────────────────

/**
 * The form sends decisions like { "equip_1_0": "b) Leather Armor,Longbow,20 Arrows" }.
 * The letter prefix maps to option index: a=0, b=1, c=2, …
 */
function resolveEquipChoice(group, choiceStr) {
    if (!choiceStr) return group.options[0];
    const letter = choiceStr.trim().charAt(0).toLowerCase();
    const idx    = letter.charCodeAt(0) - 97;
    return group.options[idx] ?? group.options[0];
}

function equipChoiceToItems(choice, sourceId, groupIdx) {
    const names = Array.isArray(choice) ? choice : [choice];
    return names.map((name, i) => ({
        id:          `${sourceId}-equip-g${groupIdx}-i${i}`,
        name:        String(name),
        type:        'mundane',
        description: '',
        equipped:    false,
    }));
}

// ─── applyRace ────────────────────────────────────────────────────────────────

/**
 * Atomically applies a race template to a character.
 * Handles: stat bonuses, speed overrides, language additions, feature list.
 */
function applyRace(character, template) {
    const sourceId    = `race-${template.id ?? template.name.toLowerCase().replace(/\s+/g, '_')}`;
    const appliedMods = [];

    for (const feat of (template.features ?? [])) {
        // Mechanical mods first (ASI, speed, languages)
        for (const mod of raceFeatureToMods(feat)) {
            appliedMods.push(applyMod(character, mod));
        }

        // Always add the feature to character.features as an informational record
        appliedMods.push(applyMod(character, {
            op: 'listAdd', path: 'features',
            value: { id: feat.id, name: feat.name, description: feat.description, trigger: feat.trigger },
        }));
    }

    // Set character.race
    appliedMods.push(applyMod(character, {
        op: 'scalarSet', path: 'race',
        value: { id: String(template.id ?? ''), name: template.name },
    }));

    recordActiveFeature(
        character,
        `race:${template.name}`,
        sourceId,
        `race-apply-${template.name.toLowerCase().replace(/\s+/g, '_')}`,
        appliedMods,
    );
}

// ─── applyBackground ──────────────────────────────────────────────────────────

/**
 * Atomically applies a background template to a character.
 * Handles: skill proficiencies (stored as features), language profs, feature list.
 */
function applyBackground(character, template) {
    const sourceId    = `background-${template.id ?? template.name.toLowerCase().replace(/\s+/g, '_')}`;
    const appliedMods = [];

    // Skill proficiencies → stored as informational features (full skill system TBD)
    for (const s of (template.skill_prof ?? [])) {
        if (s.skill && s.prof) {
            appliedMods.push(applyMod(character, {
                op: 'listAdd', path: 'features',
                value: {
                    id:          `${sourceId}-skill-${s.skill.toLowerCase()}`,
                    name:        `Skill Proficiency: ${s.skill}`,
                    description: `Proficiency in the ${s.skill} skill.`,
                    trigger:     'passive',
                },
            }));
        }
    }

    // Language proficiencies
    for (const lang of (template.lang_prof ?? [])) {
        // lang_prof may contain placeholder strings like "lang1" for DM-chosen languages
        if (lang && lang !== 'Common') {
            appliedMods.push(applyMod(character, {
                op: 'listAdd', path: 'languages', value: lang,
            }));
        }
    }

    // Background features
    for (const feat of (template.features ?? [])) {
        appliedMods.push(applyMod(character, {
            op: 'listAdd', path: 'features',
            value: { id: feat.id, name: feat.name, description: feat.description, trigger: feat.trigger },
        }));
    }

    // Set character.background
    appliedMods.push(applyMod(character, {
        op: 'scalarSet', path: 'background',
        value: { id: String(template.id ?? ''), name: template.name },
    }));

    recordActiveFeature(
        character,
        `background:${template.name}`,
        sourceId,
        `background-apply-${template.name.toLowerCase().replace(/\s+/g, '_')}`,
        appliedMods,
    );
}

// ─── Subclass feature application (used internally by applyClass) ──────────────

/**
 * Applies all subclass features that unlock at a specific class level.
 * Returns the array of applied mod records so they can be merged into the
 * parent class's active_features entry.
 */
function applySubclassFeaturesAtLevel(character, subclassTemplate, lvl, parentSourceId, featureDecisions) {
    const raw = subclassTemplate.features?.[String(lvl)];
    if (!raw) return [];
    if (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0) return [];

    const featureList = Array.isArray(raw) ? raw : [raw];
    const mods = [];

    for (const feat of featureList) {
        if (!feat.feature_name) continue;

        let displayName = feat.feature_name;
        if (feat.feature_type === 'choice') {
            // Subclass choices use a separate decision key prefix to avoid collisions
            const decKey = Object.keys(featureDecisions).find(k => k.startsWith(`feat_lvl${lvl}_sc`));
            if (decKey) displayName = `${feat.feature_name}: ${featureDecisions[decKey]}`;
        }

        const entry = {
            id:          feat.id ?? `${parentSourceId}-sc-lvl${lvl}-${feat.feature_name.replace(/\s+/g, '_').toLowerCase()}`,
            name:        displayName,
            description: feat.description ?? '',
            trigger:     'passive',
        };
        mods.push(applyMod(character, { op: 'listAdd', path: 'features', value: entry }));
    }

    return mods;
}

// ─── applyClass ───────────────────────────────────────────────────────────────

/**
 * Atomically applies a class (and its subclass) to a character.
 *
 * isPrimary — the primary class (decisions.primaryClass === true):
 *   • Grants saving throw proficiencies (5e multiclass rule: only first class does)
 *   • Grants starting equipment choices
 *   • Gets max hit die HP at level 1 (vs. average for non-primary levels)
 *
 * Subclass features are applied inline at the appropriate class level and
 * are included in the same active_features entry as the class, so the whole
 * class (including its subclass unlock) reverses atomically.
 */
function applyClass(character, classTemplate, subclassTemplate, classData, isPrimary) {
    const sourceId         = classData.id ?? `class-${classTemplate.name.toLowerCase()}`;
    const level            = classData.level ?? 1;
    const featureDecisions = classData.decisions?.features ?? {};
    const appliedMods      = [];

    // 1. Class entry ───────────────────────────────────────────────────────────
    const classEntry = {
        id:            sourceId,
        name:          classTemplate.name,
        caster:        classTemplate.caster,
        casterStat:    classTemplate.casterStat    ?? null,
        level,
        casterLevel:   classTemplate.casterLevel   ?? null,
        class_hp:      classTemplate.class_hp,
        features:      [],
        skill_prof:    (classData.skills ?? []).map(s => ({ skill: s, prof: true })),
        // 5e multiclass rule: only the primary class grants saving throw profs
        saving_throws: isPrimary ? (classTemplate.saving_throws ?? []) : [],
        spell_list:    classTemplate.spell_list ?? [],
    };
    appliedMods.push(applyMod(character, { op: 'listAdd', path: 'classes', value: classEntry }));

    // 2. Subclass entry ────────────────────────────────────────────────────────
    if (classData.subclass && subclassTemplate) {
        const subclassEntry = {
            id:          classData.subclass.id ?? subclassTemplate.name.toLowerCase().replace(/\s+/g, '_'),
            name:        subclassTemplate.name,
            class:       classTemplate.name,
            description: subclassTemplate.description ?? '',
            features:    [],
        };
        appliedMods.push(applyMod(character, { op: 'listAdd', path: 'subclasses', value: subclassEntry }));
    }

    // 3. Class + subclass features (levels 1 → character level) ───────────────
    for (let lvl = 1; lvl <= level; lvl++) {
        const raw = classTemplate.features?.[String(lvl)];
        if (!raw) continue;
        if (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0) continue;

        const featureList = Array.isArray(raw) ? raw : [raw];

        for (const feat of featureList) {
            if (!feat.feature_name) continue;

            // Subclass unlock: apply subclass features at this level
            if (feat.feature_type === 'subclass') {
                if (subclassTemplate) {
                    appliedMods.push(...applySubclassFeaturesAtLevel(
                        character, subclassTemplate, lvl, sourceId, featureDecisions,
                    ));
                }
                continue;
            }

            // Resolve player choice for 'choice' type features
            let displayName = feat.feature_name;
            if (feat.feature_type === 'choice') {
                const decKey = Object.keys(featureDecisions).find(k => k.startsWith(`feat_lvl${lvl}`));
                if (decKey) displayName = `${feat.feature_name}: ${featureDecisions[decKey]}`;
            }

            const entry = {
                id:          `${sourceId}-lvl${lvl}-${feat.feature_name.replace(/\s+/g, '_').toLowerCase()}`,
                name:        displayName,
                description: feat.description ?? '',
                trigger:     'passive',
            };
            appliedMods.push(applyMod(character, { op: 'listAdd', path: 'features', value: entry }));
        }
    }

    // 4. Starting equipment (primary class only per 5e multiclass rules) ───────
    if (isPrimary) {
        (classTemplate.equipment ?? []).forEach((group, idx) => {
            const chosenStr = featureDecisions[`equip_1_${idx}`] ?? null;
            const choice    = resolveEquipChoice(group, chosenStr);
            const items     = equipChoiceToItems(choice, sourceId, idx);
            for (const item of items) {
                appliedMods.push(applyMod(character, { op: 'listAdd', path: 'inventory.items', value: item }));
            }
        });
    }

    // 5. Atomic record ─────────────────────────────────────────────────────────
    recordActiveFeature(
        character,
        `class:${classTemplate.name}`,
        sourceId,
        `class-apply-${classTemplate.name.toLowerCase()}`,
        appliedMods,
    );
}

module.exports = { applyClass, applyRace, applyBackground };
