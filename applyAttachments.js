'use strict';

// ─── applyAttachments.js ──────────────────────────────────────────────────────
//
// Atomic attachment appliers for base stats, race, background, and class.
//
// Every function:
//   1. Generates modification records via applyMod()
//   2. Pushes a single entry into character.active_features
//      containing the full applied record and reversalData.
//
// This means any attachment can later be completely reversed by iterating
// its active_features entry in reverse order and calling reverseMod().

const { applyMod }        = require('./characterMods');
const { loadItemTemplate } = require('./templateLoader');

// ─── Constants ────────────────────────────────────────────────────────────────

// Short stat abbreviation → full name used in payload stats object
const PAYLOAD_STAT_MAP = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

// Short stat abbreviation → full name used in ASI picks array
const PICK_TO_STAT = {
    STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
    INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

// Short stat abbreviation → full name used in race feature IDs (feat-asi-con-2, etc.)
const STAT_ABBREV = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert any string to a safe lowercase slug for use in feature IDs. */
const slug = str => String(str).replace(/[^a-z0-9]/gi, '_').toLowerCase();

/** Normalize a subtype field to an array regardless of whether it's a string or array. */
const subtypeArray = feat =>
    Array.isArray(feat.subtype) ? feat.subtype :
    feat.subtype ? [feat.subtype] : [];

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
//   feat-asi-{stat3}-{amount}   → statAdd  (e.g. feat-asi-con-2 → CON +2)
//   speed-{amount}-*            → scalarSet on 'speed'
//
// Language proficiencies are now handled directly via prof_to_add.lang_prof
// in applyRace, so the old description-parsing lang extraction is removed.

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

    return [];  // all other features are handled below or are informational only
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

/**
 * Build inventory items from a chosen equipment option, substituting weapon
 * selects from featureDecisions where the template has a choice/category part.
 *
 * @param {*}      choice         - The resolved option from the template (string, array, or object)
 * @param {string} sourceId       - Class source ID for item ID generation
 * @param {number} groupIdx       - Equipment group index
 * @param {number} chosenOptIdx   - Index of the chosen option letter (a=0, b=1, …)
 * @param {string} equipUid       - Frontend box UID extracted from equip_* decision keys
 * @param {object} featureDecisions - Full feature decisions map for weapon lookups
 */
function resolveEquipItems(choice, sourceId, groupIdx, chosenOptIdx, equipUid, featureDecisions) {
    const parts = Array.isArray(choice) ? choice : [choice];
    return parts.flatMap((part, partIdx) => {
        let name;

        if (typeof part === 'object' && part !== null && part.choice) {
            // Weapon-category choice object: { choice: "martial_weapons", text: "Martial Weapon" }
            const weaponKey = `equip_weapon_${equipUid}_${groupIdx}_${chosenOptIdx}_${partIdx}`;
            name = featureDecisions[weaponKey] || part.text || 'Weapon';
        } else if (typeof part === 'string') {
            // Could be a fixed item ("Chain mail") or a weapon category ("simple weapon")
            // Try weapon decision lookup first; fall back to the string itself
            const weaponKey = `equip_weapon_${equipUid}_${groupIdx}_${chosenOptIdx}_${partIdx}`;
            name = featureDecisions[weaponKey] || part;
        } else {
            name = String(part);
        }

        const instanceId = `${sourceId}-equip-g${groupIdx}-i${partIdx}`;
        const template   = loadItemTemplate(name);

        if (template) {
            return [{ ...template, id: instanceId, equipped: false }];
        }

        // Fallback for items without a JSON file (armor, packs, ammo bundles, etc.)
        return [{
            id:                  instanceId,
            local_id:            null,
            name:                String(name),
            type:                'item',
            description:         '',
            equipped:            false,
            features_on_obtain:  null,
            features_on_lose:    null,
            features_on_equip:   null,
            features_on_unequip: null,
            dice:                null,
            range:               null,
            primary_stat:        null,
            martial:             null,
            improvised:          null,
            attack_bonus:        null,
            damage_bonus:        null,
            prof:                null,
            attuned:             null,
            features_on_attune:  null,
            features_on_detune:  null,
        }];
    });
}

// ─── applyBaseStats ───────────────────────────────────────────────────────────

/**
 * Applies player-chosen base ability scores to the character before any
 * racial or class modifiers. Recorded atomically so it can be reversed
 * when editing a character.
 */
function applyBaseStats(character, stats) {
    const appliedMods = [];
    for (const [k, fullName] of Object.entries(PAYLOAD_STAT_MAP)) {
        const score = Math.max(1, Math.min(30, Number(stats[k] ?? 10)));
        appliedMods.push(applyMod(character, { op: 'statSet', stat: fullName, value: score }));
    }
    recordActiveFeature(character, 'base:stats', 'base-stats', 'base-stats-apply', appliedMods);
}

// ─── applyRace ────────────────────────────────────────────────────────────────

/**
 * Atomically applies a race template to a character.
 * Handles: stat bonuses, speed overrides, language additions from prof_to_add,
 * weapon proficiency features, external_choice decisions (e.g. tool proficiency),
 * and informational feature records for everything else.
 *
 * @param {object} decisions - race.decisions from the payload, keyed by feature id
 */
function applyRace(character, template, decisions = {}) {
    const sourceId    = `race-${template.id ?? slug(template.name)}`;
    const appliedMods = [];

    for (const feat of (template.features ?? [])) {
        const subtypes = subtypeArray(feat);

        // 1. Mechanical mods: ASI and speed via feature ID convention
        for (const mod of raceFeatureToMods(feat)) {
            appliedMods.push(applyMod(character, mod));
        }

        // 2. Fixed proficiencies from prof_to_add
        if (subtypes.includes('prof_addition') && Array.isArray(feat.prof_to_add)) {
            for (const entry of feat.prof_to_add) {
                // Languages: add directly (skip Common — it's the default)
                for (const lang of (entry.lang_prof ?? [])) {
                    if (lang !== 'Common' && !character.languages.includes(lang)) {
                        appliedMods.push(applyMod(character, {
                            op: 'listAdd', path: 'languages', value: lang,
                        }));
                    }
                }
                // Weapon proficiencies: store as a feature + write to item_proficiencies
                if (Array.isArray(entry.weapons) && entry.weapons.length) {
                    appliedMods.push(applyMod(character, {
                        op: 'listAdd', path: 'features',
                        value: {
                            id:          `${sourceId}-weapon-prof`,
                            name:        'Weapon Proficiency',
                            description: `Proficient with: ${entry.weapons.join(', ')}.`,
                            trigger:     'passive',
                        },
                    }));
                    for (const weapon of entry.weapons) {
                        appliedMods.push(applyMod(character, {
                            op: 'listAdd', path: 'item_proficiencies', value: weapon,
                        }));
                    }
                }
            }
        }

        // 3. External choice decisions (e.g. dwarf tool proficiency pick)
        if (subtypes.includes('external_choice') && decisions[feat.id] != null) {
            const chosen = [].concat(decisions[feat.id]);
            for (const item of chosen) {
                appliedMods.push(applyMod(character, {
                    op: 'listAdd', path: 'features',
                    value: {
                        id:          `${sourceId}-${feat.id}-${slug(item)}`,
                        name:        `${feat.feature_name}: ${item}`,
                        description: `Proficient with ${item}.`,
                        trigger:     'passive',
                    },
                }));
                appliedMods.push(applyMod(character, {
                    op: 'listAdd', path: 'tool_proficiencies', value: item,
                }));
            }
        }

        // 4. Informational feature record (always added for every feature)
        appliedMods.push(applyMod(character, {
            op: 'listAdd', path: 'features',
            value: {
                id:          feat.id,
                name:        feat.feature_name,
                description: feat.description ?? '',
                trigger:     feat.trigger ?? 'passive',
            },
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
        `race-apply-${slug(template.name)}`,
        appliedMods,
    );
}

// ─── applyBackground ──────────────────────────────────────────────────────────

/**
 * Atomically applies a background template to a character.
 * Handles: skill proficiencies, chosen languages, chosen/fixed tool proficiencies,
 * and background feature records.
 *
 * @param {object} decisions - background.decisions from the payload.
 *   Language choices are keyed as lang_<bgId>_<idx> (matching the select element IDs).
 *   Tool choices are keyed as tool_<bgId>_<idx>.
 */
function applyBackground(character, template, decisions = {}) {
    const sourceId    = `background-${template.id ?? slug(template.name)}`;
    const appliedMods = [];

    // Skill proficiencies (fixed by template)
    for (const s of (template.skill_prof ?? [])) {
        if (s.skill && s.prof) {
            appliedMods.push(applyMod(character, {
                op: 'listAdd', path: 'features',
                value: {
                    id:          `${sourceId}-skill-${slug(s.skill)}`,
                    name:        `Skill Proficiency: ${s.skill}`,
                    description: `Proficiency in the ${s.skill} skill.`,
                    trigger:     'passive',
                },
            }));
            appliedMods.push(applyMod(character, {
                op: 'listAdd', path: 'skill_proficiencies',
                value: { skill: s.skill, expertise: false },
            }));
        }
    }

    // Languages: player-chosen (decisions keys matching /^lang_/) + template fixed entries
    const chosenLangs = Object.entries(decisions)
        .filter(([k]) => /^lang_/.test(k))
        .map(([, v]) => v)
        .filter(v => v && v !== '— choose —');

    const fixedLangs = (template.lang_prof ?? [])
        .filter(e => e.type === 'fixed' && e.value)
        .map(e => e.value);

    for (const lang of [...new Set([...fixedLangs, ...chosenLangs])]) {
        if (lang !== 'Common') {
            appliedMods.push(applyMod(character, {
                op: 'listAdd', path: 'languages', value: lang,
            }));
        }
    }

    // Tool proficiencies: player-chosen (decisions keys matching /^tool_/) + template fixed entries
    const chosenTools = Object.entries(decisions)
        .filter(([k]) => /^tool_/.test(k))
        .map(([, v]) => v)
        .filter(v => v && v !== '— choose —');

    const fixedTools = (template.tool_prof ?? [])
        .filter(e => e.type === 'fixed' && e.value)
        .map(e => e.value);

    for (const tool of [...new Set([...fixedTools, ...chosenTools])]) {
        appliedMods.push(applyMod(character, {
            op: 'listAdd', path: 'features',
            value: {
                id:          `${sourceId}-tool-${slug(tool)}`,
                name:        `Tool Proficiency: ${tool}`,
                description: `Proficient with ${tool}.`,
                trigger:     'passive',
            },
        }));
        appliedMods.push(applyMod(character, {
            op: 'listAdd', path: 'tool_proficiencies', value: tool,
        }));
    }

    // Background features
    for (const feat of (template.features ?? [])) {
        appliedMods.push(applyMod(character, {
            op: 'listAdd', path: 'features',
            value: {
                id:          feat.id,
                name:        feat.feature_name,
                description: feat.description ?? '',
                trigger:     feat.trigger ?? 'passive',
            },
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
        `background-apply-${slug(template.name)}`,
        appliedMods,
    );
}

// ─── Subclass feature application (used internally by applyClass) ──────────────

/**
 * Applies all subclass features that unlock at a specific class level.
 * Returns the array of applied mod records to be merged into the parent
 * class's active_features entry.
 *
 * Decision key convention for external choices: extchoice_lvl${lvl}_uid${uid}
 * String value → single choice appended to feature name.
 * Array value  → one feature entry per item.
 */
function applySubclassFeaturesAtLevel(character, subclassTemplate, lvl, parentSourceId, featureDecisions) {
    const raw = subclassTemplate.features?.[String(lvl)];
    if (!raw) return [];
    if (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0) return [];

    const featureList = Array.isArray(raw) ? raw : [raw];
    const mods = [];

    for (const feat of featureList) {
        if (!feat.feature_name) continue;

        const subtypes = subtypeArray(feat);

        // External choice: find extchoice_lvl${lvl}_uid* key
        if (subtypes.includes('external_choice')) {
            const decKey = Object.keys(featureDecisions).find(
                k => new RegExp(`^extchoice_lvl${lvl}_uid`).test(k)
            );
            if (decKey && featureDecisions[decKey] != null) {
                const chosen = [].concat(featureDecisions[decKey]);
                for (const item of chosen) {
                    mods.push(applyMod(character, {
                        op: 'listAdd', path: 'features',
                        value: {
                            id:          `${parentSourceId}-sc-lvl${lvl}-${slug(feat.feature_name)}-${slug(item)}`,
                            name:        `${feat.feature_name}: ${item}`,
                            description: feat.description ?? '',
                            trigger:     'passive',
                        },
                    }));
                }
                continue;
            }
        }

        // Inline choice subtype
        if (feat.feature_type === 'choice') {
            const decKey = Object.keys(featureDecisions).find(
                k => k.startsWith(`feat_lvl${lvl}_uid`)
            );
            const displayName = decKey && featureDecisions[decKey]
                ? `${feat.feature_name}: ${featureDecisions[decKey]}`
                : feat.feature_name;

            mods.push(applyMod(character, {
                op: 'listAdd', path: 'features',
                value: {
                    id:          feat.id ?? `${parentSourceId}-sc-lvl${lvl}-${slug(feat.feature_name)}`,
                    name:        displayName,
                    description: feat.description ?? '',
                    trigger:     'passive',
                },
            }));
            continue;
        }

        // All other subclass features: informational entry
        mods.push(applyMod(character, {
            op: 'listAdd', path: 'features',
            value: {
                id:          feat.id ?? `${parentSourceId}-sc-lvl${lvl}-${slug(feat.feature_name)}`,
                name:        feat.feature_name,
                description: feat.description ?? '',
                trigger:     'passive',
            },
        }));
    }

    return mods;
}

// ─── applyClass ───────────────────────────────────────────────────────────────

/**
 * Atomically applies a class (and its subclass) to a character.
 *
 * Handles:
 *  - Class and subclass entries
 *  - All feature types: passive, external_choice (string or array), choice, asi, upgrade, subclass
 *  - ASI application from decisions.asi picks
 *  - Starting equipment with weapon select substitution (primary class only)
 *
 * isPrimary — the primary class (decisions.primaryClass === true):
 *   • Grants saving throw proficiencies (5e multiclass rule)
 *   • Grants starting equipment
 *   • Gets max hit die HP at level 1 (vs. average for non-primary levels)
 */
function applyClass(character, classTemplate, subclassTemplate, classData, isPrimary) {
    const sourceId         = classData.id ?? `class-${slug(classTemplate.name)}`;
    const level            = classData.level ?? 1;
    const featureDecisions = classData.decisions?.features ?? {};
    const appliedMods      = [];

    // Extract the frontend box UID from equipment decision keys (e.g. "equip_1_0" → uid "1")
    // This is needed to look up weapon select decisions for equipment options.
    const equipUid = (() => {
        const key = Object.keys(featureDecisions).find(k => /^equip_\d+_\d+$/.test(k));
        return key ? key.split('_')[1] : null;
    })();

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
        saving_throws: isPrimary ? (classTemplate.saving_throws ?? []) : [],
        spell_list:    classTemplate.spell_list ?? [],
    };
    appliedMods.push(applyMod(character, { op: 'listAdd', path: 'classes', value: classEntry }));

    // Mirror class skill profs to top-level skill_proficiencies array
    for (const sp of classEntry.skill_prof) {
        appliedMods.push(applyMod(character, {
            op: 'listAdd', path: 'skill_proficiencies',
            value: { skill: sp.skill, expertise: false },
        }));
    }

    // 2. Subclass entry ────────────────────────────────────────────────────────
    if (classData.subclass?.name && subclassTemplate) {
        const subclassEntry = {
            id:          classData.subclass.id ?? slug(subclassTemplate.name),
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

            const subtypes = subtypeArray(feat);

            // Subclass unlock: apply subclass features at this level
            if (feat.feature_type === 'subclass') {
                if (subclassTemplate) {
                    appliedMods.push(...applySubclassFeaturesAtLevel(
                        character, subclassTemplate, lvl, sourceId, featureDecisions,
                    ));
                }
                continue;
            }

            // ASI: choices are applied from decisions.asi after this loop
            if (feat.feature_type === 'asi') continue;

            // Upgrade: add informational entry only; the original feature already
            // holds all expanded choices under its original extchoice_lvl* key
            if (feat.feature_type === 'upgrade') {
                appliedMods.push(applyMod(character, {
                    op: 'listAdd', path: 'features',
                    value: {
                        id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}-upgrade`,
                        name:        feat.feature_name,
                        description: feat.description ?? '',
                        trigger:     'passive',
                    },
                }));
                continue;
            }

            // External choice: extchoice_lvl${lvl}_uid* key holds a string or array
            if (subtypes.includes('external_choice')) {
                const decKey = Object.keys(featureDecisions).find(
                    k => new RegExp(`^extchoice_lvl${lvl}_uid`).test(k)
                );
                if (decKey && featureDecisions[decKey] != null) {
                    const chosen = [].concat(featureDecisions[decKey]);
                    if (chosen.length > 1 || Array.isArray(featureDecisions[decKey])) {
                        // Multiple selections: one feature entry per item
                        for (const item of chosen) {
                            appliedMods.push(applyMod(character, {
                                op: 'listAdd', path: 'features',
                                value: {
                                    id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}-${slug(item)}`,
                                    name:        `${feat.feature_name}: ${item}`,
                                    description: feat.description ?? '',
                                    trigger:     'passive',
                                },
                            }));
                        }
                        continue;
                    } else {
                        // Single selection: append to feature name
                        appliedMods.push(applyMod(character, {
                            op: 'listAdd', path: 'features',
                            value: {
                                id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}`,
                                name:        `${feat.feature_name}: ${chosen[0]}`,
                                description: feat.description ?? '',
                                trigger:     'passive',
                            },
                        }));
                        continue;
                    }
                }
            }

            // Inline choice: feat_lvl${lvl}_uid* key
            let displayName = feat.feature_name;
            if (feat.feature_type === 'choice') {
                const decKey = Object.keys(featureDecisions).find(
                    k => k.startsWith(`feat_lvl${lvl}_uid`)
                );
                if (decKey && featureDecisions[decKey]) {
                    displayName = `${feat.feature_name}: ${featureDecisions[decKey]}`;
                }
            }

            appliedMods.push(applyMod(character, {
                op: 'listAdd', path: 'features',
                value: {
                    id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}`,
                    name:        displayName,
                    description: feat.description ?? '',
                    trigger:     'passive',
                },
            }));
        }
    }

    // 4. ASI application ──────────────────────────────────────────────────────
    // Each ASI row in decisions.asi has a picks array with two stat abbreviations.
    // Each pick is a +1 to that stat (two identical picks = +2 to one stat).
    for (const row of (classData.decisions?.asi ?? [])) {
        for (const pick of (row.picks ?? [])) {
            const stat = PICK_TO_STAT[pick.toUpperCase()];
            if (stat) appliedMods.push(applyMod(character, { op: 'statAdd', stat, value: 1 }));
        }
    }

    // 5. Starting equipment (primary class only per 5e multiclass rules) ───────
    if (isPrimary) {
        (classTemplate.equipment ?? []).forEach((group, idx) => {
            const choiceKey    = Object.keys(featureDecisions).find(k => k === `equip_${equipUid}_${idx}`);
            const chosenStr    = choiceKey ? featureDecisions[choiceKey] : null;
            const chosenOptIdx = chosenStr
                ? (chosenStr.trim().toLowerCase().charCodeAt(0) - 97)
                : 0;
            const choice = resolveEquipChoice(group, chosenStr);
            const items  = resolveEquipItems(choice, sourceId, idx, chosenOptIdx, equipUid, featureDecisions);
            for (const item of items) {
                appliedMods.push(applyMod(character, { op: 'listAdd', path: 'inventory.items', value: item }));
            }
        });
    }

    // 6. Atomic record ─────────────────────────────────────────────────────────
    recordActiveFeature(
        character,
        `class:${classTemplate.name}`,
        sourceId,
        `class-apply-${slug(classTemplate.name)}`,
        appliedMods,
    );
}

module.exports = { applyBaseStats, applyClass, applyRace, applyBackground, recordActiveFeature };
