'use strict';

// ─── applyAttachments.js ──────────────────────────────────────────────────────
//
// Atomic attachment appliers for base stats, race, background, and class.
//
// Every function tags its contributions with a source_id so they can be
// removed in one pass via removeSource(character, sourceId).
//
// No active_features, no reversalData — removal is always a filter by source_id.

const {
    addStatModifier,
    addToList,
    scalarSet,
    recomputeStats,
} = require('./characterMods');

const { dispatchFeature } = require('./featureDispatch');
const { loadItemTemplate } = require('./templateLoader');

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYLOAD_STAT_MAP = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const PICK_TO_STAT = {
    STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
    INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

const STAT_ABBREV = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const slug = str => String(str).replace(/[^a-z0-9]/gi, '_').toLowerCase();

const subtypeArray = feat =>
    Array.isArray(feat.subtype) ? feat.subtype :
    feat.subtype ? [feat.subtype] : [];

// ─── Equipment helpers ────────────────────────────────────────────────────────

function resolveEquipChoice(group, choiceStr) {
    if (!choiceStr) return group.options[0];
    const letter = choiceStr.trim().charAt(0).toLowerCase();
    const idx    = letter.charCodeAt(0) - 97;
    return group.options[idx] ?? group.options[0];
}

function resolveEquipItems(choice, sourceId, groupIdx, chosenOptIdx, equipUid, featureDecisions) {
    const parts = Array.isArray(choice) ? choice : [choice];
    return parts.flatMap((part, partIdx) => {
        let name;

        if (typeof part === 'object' && part !== null && part.choice) {
            const weaponKey = `equip_weapon_${equipUid}_${groupIdx}_${chosenOptIdx}_${partIdx}`;
            name = featureDecisions[weaponKey] || part.text || 'Weapon';
        } else if (typeof part === 'string') {
            const weaponKey = `equip_weapon_${equipUid}_${groupIdx}_${chosenOptIdx}_${partIdx}`;
            name = featureDecisions[weaponKey] || part;
        } else {
            name = String(part);
        }

        const instanceId = `${sourceId}-equip-g${groupIdx}-i${partIdx}`;
        const template   = loadItemTemplate(name);

        if (template) {
            return [{ ...template, id: instanceId }];
        }

        // Fallback stub for items without a JSON file
        return [{
            id:                  instanceId,
            local_id:            null,
            name:                String(name),
            type:                'item',
            description:         '',
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
            features_on_attune:  null,
            features_on_detune:  null,
        }];
    });
}

// ─── applyBaseStats ───────────────────────────────────────────────────────────

/**
 * Sets player-chosen base ability scores directly on stat.base, then recomputes
 * scores. Must run before race so racial ASIs add on top of player-chosen values.
 */
function applyBaseStats(character, stats) {
    for (const [k, fullName] of Object.entries(PAYLOAD_STAT_MAP)) {
        const score = Math.max(1, Math.min(30, Number(stats[k] ?? 10)));
        const entry = character.stats.find(s => s.stat === fullName);
        if (entry) entry.base = score;
    }
    recomputeStats(character);
}

// ─── applyRace ────────────────────────────────────────────────────────────────

/**
 * Applies a race template to the character. All contributions are tagged with
 * sourceId so they can be removed later via removeSource().
 *
 * @param {object} decisions - race.decisions from the payload, keyed by feature id
 */
function applyRace(character, template, decisions = {}) {
    const sourceId = `race-${template.id ?? slug(template.name)}`;

    for (const feat of (template.features ?? [])) {
        const subtypes = subtypeArray(feat);
        const id       = feat.id ?? '';

        // 1. ASI via feature ID convention: feat-asi-con-2, feat-asi-str-1, etc.
        const asiMatch = id.match(/^feat-asi-(str|dex|con|int|wis|cha)-(\d+)$/i);
        if (asiMatch) {
            const stat  = STAT_ABBREV[asiMatch[1].toLowerCase()];
            addStatModifier(character, sourceId, stat, 'add', parseInt(asiMatch[2], 10));
        }

        // 2. Speed override: speed-25-dwarf, speed-30-elf, etc.
        const speedMatch = id.match(/^speed-(\d+)-/);
        if (speedMatch) {
            character.speed = parseInt(speedMatch[1], 10);
        }

        // 3. Fixed proficiencies from prof_to_add
        if (subtypes.includes('prof_addition') && Array.isArray(feat.prof_to_add)) {
            for (const entry of feat.prof_to_add) {
                // Languages (flat strings, not source-tagged individually)
                for (const lang of (entry.lang_prof ?? [])) {
                    if (lang !== 'Common' && !character.languages.includes(lang)) {
                        character.languages.push(lang);
                    }
                }
                // Weapon proficiencies
                if (Array.isArray(entry.weapons) && entry.weapons.length) {
                    addToList(character, 'features', {
                        id:          `${sourceId}-weapon-prof`,
                        name:        'Weapon Proficiency',
                        description: `Proficient with: ${entry.weapons.join(', ')}.`,
                        trigger:     'passive',
                    }, sourceId);
                    for (const weapon of entry.weapons) {
                        addToList(character, 'item_proficiencies', { item: weapon }, sourceId);
                    }
                }
            }
        }

        // 4. External choice decisions (e.g. dwarf tool proficiency pick)
        if (subtypes.includes('external_choice') && decisions[feat.id] != null) {
            const chosen = [].concat(decisions[feat.id]);
            for (const item of chosen) {
                addToList(character, 'features', {
                    id:          `${sourceId}-${feat.id}-${slug(item)}`,
                    name:        `${feat.feature_name}: ${item}`,
                    description: `Proficient with ${item}.`,
                    trigger:     'passive',
                }, sourceId);
                addToList(character, 'tool_proficiencies', { tool: item }, sourceId);
            }
        }

        // 5. Mechanical handler (e.g. Unarmored Defense, Natural Weapon, etc.)
        if (feat.handler) {
            dispatchFeature(feat, { id: sourceId, name: template.name }, character);
        }

        // 6. Informational feature record (always added for every feature)
        addToList(character, 'features', {
            id:          feat.id,
            name:        feat.feature_name,
            description: feat.description ?? '',
            trigger:     feat.trigger ?? 'passive',
        }, sourceId);
    }

    scalarSet(character, 'race', { id: String(template.id ?? ''), name: template.name });
}

// ─── applyBackground ──────────────────────────────────────────────────────────

/**
 * Applies a background template to the character.
 *
 * @param {object} decisions - background.decisions from the payload.
 *   Language choices keyed as lang_<bgId>_<idx>.
 *   Tool choices keyed as tool_<bgId>_<idx>.
 */
function applyBackground(character, template, decisions = {}) {
    const sourceId = `background-${template.id ?? slug(template.name)}`;

    // Skill proficiencies (fixed by template)
    for (const s of (template.skill_prof ?? [])) {
        if (s.skill && s.prof) {
            addToList(character, 'features', {
                id:          `${sourceId}-skill-${slug(s.skill)}`,
                name:        `Skill Proficiency: ${s.skill}`,
                description: `Proficiency in the ${s.skill} skill.`,
                trigger:     'passive',
            }, sourceId);
            addToList(character, 'skill_proficiencies', { skill: s.skill, expertise: false }, sourceId);
        }
    }

    // Languages
    const chosenLangs = Object.entries(decisions)
        .filter(([k]) => /^lang_/.test(k))
        .map(([, v]) => v)
        .filter(v => v && v !== '— choose —');

    const fixedLangs = (template.lang_prof ?? [])
        .filter(e => e.type === 'fixed' && e.value)
        .map(e => e.value);

    for (const lang of [...new Set([...fixedLangs, ...chosenLangs])]) {
        if (lang !== 'Common' && !character.languages.includes(lang)) {
            character.languages.push(lang);
        }
    }

    // Tool proficiencies
    const chosenTools = Object.entries(decisions)
        .filter(([k]) => /^tool_/.test(k))
        .map(([, v]) => v)
        .filter(v => v && v !== '— choose —');

    const fixedTools = (template.tool_prof ?? [])
        .filter(e => e.type === 'fixed' && e.value)
        .map(e => e.value);

    for (const tool of [...new Set([...fixedTools, ...chosenTools])]) {
        addToList(character, 'features', {
            id:          `${sourceId}-tool-${slug(tool)}`,
            name:        `Tool Proficiency: ${tool}`,
            description: `Proficient with ${tool}.`,
            trigger:     'passive',
        }, sourceId);
        addToList(character, 'tool_proficiencies', { tool }, sourceId);
    }

    // Background features
    for (const feat of (template.features ?? [])) {
        if (feat.handler) {
            dispatchFeature(feat, { id: sourceId, name: template.name }, character);
        }
        addToList(character, 'features', {
            id:          feat.id,
            name:        feat.feature_name,
            description: feat.description ?? '',
            trigger:     feat.trigger ?? 'passive',
        }, sourceId);
    }

    scalarSet(character, 'background', { id: String(template.id ?? ''), name: template.name });
}

// ─── Subclass feature application (used internally by applyClass) ─────────────

function applySubclassFeaturesAtLevel(character, subclassTemplate, lvl, parentSourceId, featureDecisions) {
    const raw = subclassTemplate.features?.[String(lvl)];
    if (!raw) return;
    if (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0) return;

    const featureList = Array.isArray(raw) ? raw : [raw];

    for (const feat of featureList) {
        if (!feat.feature_name) continue;

        const subtypes = subtypeArray(feat);

        // Dispatch mechanical handler for subclass features
        if (feat.handler) {
            dispatchFeature(feat, { id: parentSourceId }, character);
        }

        if (subtypes.includes('external_choice')) {
            const decKey = Object.keys(featureDecisions).find(
                k => new RegExp(`^extchoice_lvl${lvl}_uid`).test(k)
            );
            if (decKey && featureDecisions[decKey] != null) {
                const chosen = [].concat(featureDecisions[decKey]);
                for (const item of chosen) {
                    addToList(character, 'features', {
                        id:          `${parentSourceId}-sc-lvl${lvl}-${slug(feat.feature_name)}-${slug(item)}`,
                        name:        `${feat.feature_name}: ${item}`,
                        description: feat.description ?? '',
                        trigger:     'passive',
                    }, parentSourceId);
                }
                continue;
            }
        }

        if (feat.feature_type === 'choice') {
            const decKey = Object.keys(featureDecisions).find(
                k => k.startsWith(`feat_lvl${lvl}_uid`)
            );
            const displayName = decKey && featureDecisions[decKey]
                ? `${feat.feature_name}: ${featureDecisions[decKey]}`
                : feat.feature_name;

            addToList(character, 'features', {
                id:          feat.id ?? `${parentSourceId}-sc-lvl${lvl}-${slug(feat.feature_name)}`,
                name:        displayName,
                description: feat.description ?? '',
                trigger:     'passive',
            }, parentSourceId);
            continue;
        }

        addToList(character, 'features', {
            id:          feat.id ?? `${parentSourceId}-sc-lvl${lvl}-${slug(feat.feature_name)}`,
            name:        feat.feature_name,
            description: feat.description ?? '',
            trigger:     'passive',
        }, parentSourceId);
    }
}

// ─── applyClass ───────────────────────────────────────────────────────────────

/**
 * Applies a class (and its subclass) to a character.
 *
 * isPrimary (decisions.primaryClass === true):
 *   • Grants saving throw proficiencies (5e multiclass rule)
 *   • Grants starting equipment
 *   • Gets max hit die HP at level 1 (vs. average for secondary classes)
 */
function applyClass(character, classTemplate, subclassTemplate, classData, isPrimary) {
    const sourceId         = classData.id ?? `class-${slug(classTemplate.name)}`;
    const level            = classData.level ?? 1;
    const featureDecisions = classData.decisions?.features ?? {};

    const equipUid = (() => {
        const key = Object.keys(featureDecisions).find(k => /^equip_\d+_\d+$/.test(k));
        return key ? key.split('_')[1] : null;
    })();

    // 1. Class entry
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
    addToList(character, 'classes', classEntry, sourceId);

    // Mirror class skill profs to top-level skill_proficiencies
    for (const sp of classEntry.skill_prof) {
        addToList(character, 'skill_proficiencies', { skill: sp.skill, expertise: false }, sourceId);
    }

    // 2. Subclass entry
    if (classData.subclass?.name && subclassTemplate) {
        const subclassEntry = {
            id:          classData.subclass.id ?? slug(subclassTemplate.name),
            name:        subclassTemplate.name,
            class:       classTemplate.name,
            description: subclassTemplate.description ?? '',
            features:    [],
        };
        addToList(character, 'subclasses', subclassEntry, sourceId);
    }

    // 3. Class + subclass features (levels 1 → character level)
    for (let lvl = 1; lvl <= level; lvl++) {
        const raw = classTemplate.features?.[String(lvl)];
        if (!raw) continue;
        if (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0) continue;

        const featureList = Array.isArray(raw) ? raw : [raw];

        for (const feat of featureList) {
            if (!feat.feature_name) continue;

            const subtypes = subtypeArray(feat);

            // Dispatch mechanical handler first — works for any feature type
            // (class abilities that add attacks, set AC via Unarmored Defense, etc.)
            if (feat.handler) {
                dispatchFeature(feat, { id: sourceId, name: classTemplate.name }, character);
            }

            if (feat.feature_type === 'subclass') {
                if (subclassTemplate) {
                    applySubclassFeaturesAtLevel(
                        character, subclassTemplate, lvl, sourceId, featureDecisions,
                    );
                }
                continue;
            }

            if (feat.feature_type === 'asi') continue;

            if (feat.feature_type === 'upgrade') {
                addToList(character, 'features', {
                    id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}-upgrade`,
                    name:        feat.feature_name,
                    description: feat.description ?? '',
                    trigger:     'passive',
                }, sourceId);
                continue;
            }

            if (subtypes.includes('external_choice')) {
                const decKey = Object.keys(featureDecisions).find(
                    k => new RegExp(`^extchoice_lvl${lvl}_uid`).test(k)
                );
                if (decKey && featureDecisions[decKey] != null) {
                    const chosen = [].concat(featureDecisions[decKey]);
                    if (chosen.length > 1 || Array.isArray(featureDecisions[decKey])) {
                        for (const item of chosen) {
                            addToList(character, 'features', {
                                id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}-${slug(item)}`,
                                name:        `${feat.feature_name}: ${item}`,
                                description: feat.description ?? '',
                                trigger:     'passive',
                            }, sourceId);
                        }
                        continue;
                    } else {
                        addToList(character, 'features', {
                            id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}`,
                            name:        `${feat.feature_name}: ${chosen[0]}`,
                            description: feat.description ?? '',
                            trigger:     'passive',
                        }, sourceId);
                        continue;
                    }
                }
            }

            let displayName = feat.feature_name;
            if (feat.feature_type === 'choice') {
                const decKey = Object.keys(featureDecisions).find(
                    k => k.startsWith(`feat_lvl${lvl}_uid`)
                );
                if (decKey && featureDecisions[decKey]) {
                    displayName = `${feat.feature_name}: ${featureDecisions[decKey]}`;
                }
            }

            addToList(character, 'features', {
                id:          `${sourceId}-lvl${lvl}-${slug(feat.feature_name)}`,
                name:        displayName,
                description: feat.description ?? '',
                trigger:     'passive',
            }, sourceId);
        }
    }

    // 4. ASI application
    for (const row of (classData.decisions?.asi ?? [])) {
        for (const pick of (row.picks ?? [])) {
            const stat = PICK_TO_STAT[pick.toUpperCase()];
            if (stat) addStatModifier(character, sourceId, stat, 'add', 1);
        }
    }

    // 5. Starting equipment (primary class only)
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
                character.inventory.items.push(item);
            }
        });
    }
}

module.exports = { applyBaseStats, applyClass, applyRace, applyBackground };
