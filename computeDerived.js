'use strict';

// ─── computeDerived.js ────────────────────────────────────────────────────────
//
// computeAllDerived(character, primaryClassName) must be called after every
// apply or reverse operation. Delegates stat/AC recomputation to characterMods,
// then handles prof_bonus, initiative, HP, and saves.

const { recomputeStats, recomputeAC } = require('./characterMods');

const STAT_NAMES = [
    'Strength', 'Dexterity', 'Constitution',
    'Intelligence', 'Wisdom', 'Charisma',
];

// D&D 5e proficiency bonus by total character level (index 0 = level 1)
const PROF_BY_LEVEL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

const statMod    = score => Math.floor((score - 10) / 2);
const totalLevel = classes => classes.reduce((sum, c) => sum + (c.level || 0), 0);
const profBonus  = level  => PROF_BY_LEVEL[Math.max(0, level - 1)] ?? 2;

/**
 * Recomputes all derived character fields.
 *
 * @param {object} character        - The character object (mutated in place).
 * @param {string} primaryClassName - Name of the primary class (used for HP).
 *                                    Falls back to the first class if not matched.
 */
function computeAllDerived(character, primaryClassName) {
    // Recompute stat scores from modifier stacks, then AC from ac_modifiers
    recomputeStats(character);
    recomputeAC(character);

    // Build a quick stat lookup map from the now-current scores
    const statMap = Object.fromEntries(character.stats.map(s => [s.stat, s.score]));

    const dexMod = statMod(statMap.Dexterity    ?? 10);
    const conMod = statMod(statMap.Constitution ?? 10);

    const level = totalLevel(character.classes);
    const pb    = profBonus(level || 1);

    character.prof_bonus = pb;
    character.initiative = dexMod;

    // ── HP ─────────────────────────────────────────────────────────────────
    // Primary class:    level 1 = max hit die + CON mod
    //                   levels 2+ = avg hit die (floor(hd/2)+1) + CON mod
    // Secondary classes: all levels use average hit die + CON mod (5e multiclass rule)
    const primaryClass =
        character.classes.find(c => c.name.toLowerCase() === (primaryClassName ?? '').toLowerCase())
        ?? character.classes[0];

    let maxHp = 0;
    for (const cls of character.classes) {
        const hd        = cls.class_hp || 0;
        const avgPerLvl = Math.max(1, Math.floor(hd / 2) + 1 + conMod);

        if (cls === primaryClass) {
            const firstLvl = Math.max(1, hd + conMod);
            const restLvls = Math.max(0, cls.level - 1) * avgPerLvl;
            maxHp += firstLvl + restLvls;
        } else {
            maxHp += cls.level * avgPerLvl;
        }
    }
    character.hitpoints.current_hit_points = Math.max(1, maxHp);

    // ── Saving throws ──────────────────────────────────────────────────────
    const saveProfSet = new Set(character.classes.flatMap(c => c.saving_throws ?? []));

    character.saves = STAT_NAMES.map(s => ({
        stat: s,
        save: statMod(statMap[s] ?? 10) + (saveProfSet.has(s) ? pb : 0),
    }));
}

module.exports = { computeAllDerived };
