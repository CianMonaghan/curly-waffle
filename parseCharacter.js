'use strict';

// ─── parseCharacter.js ────────────────────────────────────────────────────────
//
// Entry point. Receives the form POST body and returns a fully-built character
// object matching the schema defined in the design doc.
//
// Flow:
//   1. createBlankCharacter     – empty shell with all required fields
//   2. applyRace                – stat bonuses, speed, languages, race features
//   3. applyBackground          – skill profs, language profs, background feature
//   4. applyClass (× N)         – class entry, subclass, features, equipment
//      └─ primary class first   – determines saves, equipment, level-1 HP
//   5. computeAllDerived        – prof_bonus, initiative, AC, HP, saves
//
// Every mutation goes through applyMod() in characterMods.js and is recorded
// in character.active_features with full reversalData.

const {
    loadClassTemplate,
    loadSubclassTemplate,
    loadRaceTemplate,
    loadBackgroundTemplate,
} = require('./templateLoader');

const { applyClass, applyRace, applyBackground } = require('./applyAttachments');
const { computeAllDerived }                       = require('./computeDerived');

const STAT_NAMES = [
    'Strength', 'Dexterity', 'Constitution',
    'Intelligence', 'Wisdom', 'Charisma',
];

// ─── Blank character factory ──────────────────────────────────────────────────

function createBlankCharacter(name, alignment = 'Neutral') {
    return {
        name,
        alignment,
        stats:    STAT_NAMES.map(s => ({ stat: s, score: 10 })),
        hitpoints: { current_hit_points: 0, temp_hp: 0 },
        speed:    30,
        initiative: 0,
        size:     'medium',
        prof_bonus: 2,
        saves:    STAT_NAMES.map(s => ({ stat: s, save: 0 })),
        armor_class: 10,
        languages:  ['Common'],
        race:       null,
        background: null,
        classes:    [],
        subclasses: [],
        features:   [],
        inventory: {
            currency: [
                { currencyName: 'pp', amount: 0 },
                { currencyName: 'gp', amount: 0 },
                { currencyName: 'ep', amount: 0 },
                { currencyName: 'sp', amount: 0 },
                { currencyName: 'cp', amount: 0 },
            ],
            items: [],
        },
        active_features:  [],
        equipped_weapons: [],
    };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Build a Character from the character-creation form data.
 *
 * Expected formData shape (see server/sfsdfs_character (2).json for reference):
 * {
 *   name:       string,
 *   alignment:  string | undefined,
 *   race:       { name: string } | null,
 *   background: { name: string } | null,
 *   classes: [
 *     {
 *       id:       string,
 *       name:     string,          // must match a class template filename
 *       level:    number,
 *       skills:   string[],
 *       decisions: {
 *         primaryClass: boolean,   // true for the one primary class
 *         features: {
 *           "equip_1_0": "b) ...", // equipment choice for group 0
 *           "feat_lvl1_uid1": "Archery", // feature choice at level 1
 *         },
 *         asi: [],
 *       },
 *       subclass: { id: string, name: string } | null,
 *     },
 *     // … additional entries for multiclass characters
 *   ],
 * }
 */
function parseCharacter(formData) {
    const character = createBlankCharacter(
        formData.name      ?? 'Unnamed',
        formData.alignment ?? 'Neutral',
    );

    // ── Race ──────────────────────────────────────────────────────────────
    if (formData.race?.name) {
        try {
            const raceTemplate = loadRaceTemplate(formData.race.name);
            applyRace(character, raceTemplate);
        } catch (e) {
            console.warn(`[parseCharacter] Race skipped — ${e.message}`);
        }
    }

    // ── Background ────────────────────────────────────────────────────────
    if (formData.background?.name) {
        try {
            const bgTemplate = loadBackgroundTemplate(formData.background.name);
            applyBackground(character, bgTemplate);
        } catch (e) {
            console.warn(`[parseCharacter] Background skipped — ${e.message}`);
        }
    }

    // ── Classes ───────────────────────────────────────────────────────────
    // The class with decisions.primaryClass === true is the "first level" class.
    // It grants saving throw proficiencies and starting equipment.
    // Falls back to the first class in the array if none is explicitly marked.
    const classes      = formData.classes ?? [];
    const primaryClass = classes.find(c => c.decisions?.primaryClass === true) ?? classes[0];

    // Apply primary class first so its saves / equipment take precedence,
    // then apply secondary classes in original order.
    const orderedClasses = [
        ...classes.filter(c => c.decisions?.primaryClass === true),
        ...classes.filter(c => c.decisions?.primaryClass !== true),
    ];

    for (const classData of orderedClasses) {
        const isPrimary = classData === primaryClass;

        let classTemplate;
        try {
            classTemplate = loadClassTemplate(classData.name);
        } catch (e) {
            console.warn(`[parseCharacter] Class "${classData.name}" skipped — ${e.message}`);
            continue;
        }

        // Subclass is non-fatal: warn and continue without it if template is missing
        let subclassTemplate = null;
        if (classData.subclass?.name) {
            subclassTemplate = loadSubclassTemplate(classData.name, classData.subclass.name);
        }

        applyClass(character, classTemplate, subclassTemplate, classData, isPrimary);
    }

    // ── Derived stats ─────────────────────────────────────────────────────
    // Must run last — reads from the final state of base fields set above.
    computeAllDerived(character, primaryClass?.name);

    return character;
}

module.exports = { parseCharacter };
