'use strict';

const path   = require('path');
const STATIC = path.join(__dirname, 'static_json', 'external_lists');

const fullCasterData    = require(path.join(STATIC, 'full_caster.json'));
const halfCasterData    = require(path.join(STATIC, 'half_caster.json'));
const quarterCasterData = require(path.join(STATIC, 'quarter_caster.json'));
const pactMagicData     = require(path.join(STATIC, 'pact_magic.json'));

const CASTER_TABLES = {
    full_caster:    fullCasterData.spell_slots,
    half_caster:    halfCasterData.spell_slots,
    quarter_caster: quarterCasterData.spell_slots,
};

const MULTICLASS_CONTRIB = {
    full_caster:    lvl => lvl,
    half_caster:    lvl => Math.floor(lvl / 2),
    quarter_caster: lvl => Math.floor(lvl / 3),
};

const SLOT_LEVEL_KEYS = [
    '1st level','2nd level','3rd level','4th level','5th level',
    '6th level','7th level','8th level','9th level',
];

function slotsFromRow(row, existing = []) {
    return SLOT_LEVEL_KEYS
        .map((key, i) => ({
            level:   i + 1,
            max:     parseInt(row[key] ?? '0', 10),
            current: existing.find(s => s.level === i + 1)?.current
                     ?? parseInt(row[key] ?? '0', 10),
        }))
        .filter(s => s.max > 0);
}

// ─── computeDerived.js ────────────────────────────────────────────────────────
//
// computeAllDerived(character, primaryClassName) must be called after every
// apply or reverse operation. Delegates stat/AC recomputation to characterMods,
// then handles prof_bonus, Initiative stat base, MaxHP stat base, saves, and
// spell slots.

const { recomputeStats, recomputeAC, recomputeOneStat } = require('./characterMods');

const STAT_NAMES = [
    'Strength', 'Dexterity', 'Constitution',
    'Intelligence', 'Wisdom', 'Charisma',
];

const PROF_BY_LEVEL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

const statMod    = score => Math.floor((score - 10) / 2);
const totalLevel = classes => classes.reduce((sum, c) => sum + (c.level || 0), 0);
const profBonus  = level  => PROF_BY_LEVEL[Math.max(0, level - 1)] ?? 2;

function computeAllDerived(character, primaryClassName) {
    // Pass 1: recompute all stat scores from their modifier stacks (includes Speed).
    recomputeStats(character);
    recomputeAC(character);

    const statMap = Object.fromEntries(character.stats.map(s => [s.stat, s.score]));
    const dexMod  = statMod(statMap.Dexterity    ?? 10);
    const conMod  = statMod(statMap.Constitution ?? 10);
    const level   = totalLevel(character.classes);
    const pb      = profBonus(level || 1);

    character.prof_bonus = pb;

    // ── Initiative ─────────────────────────────────────────────────────────
    const initEntry = character.stats.find(s => s.stat === 'Initiative');
    if (initEntry) {
        initEntry.base = dexMod;
        recomputeOneStat(initEntry);
    }

    // ── MaxHP ───────────────────────────────────────────────────────────────
    const primaryClass =
        character.classes.find(c => c.name.toLowerCase() === (primaryClassName ?? '').toLowerCase())
        ?? character.classes[0];

    let maxHpBase = 0;
    for (const cls of character.classes) {
        const hd        = cls.class_hp || 0;
        const avgPerLvl = Math.max(1, Math.floor(hd / 2) + 1 + conMod);

        if (cls === primaryClass) {
            const firstLvl = Math.max(1, hd + conMod);
            const restLvls = Math.max(0, cls.level - 1) * avgPerLvl;
            maxHpBase += firstLvl + restLvls;
        } else {
            maxHpBase += cls.level * avgPerLvl;
        }
    }

    const maxHpEntry = character.stats.find(s => s.stat === 'MaxHP');
    if (maxHpEntry) {
        maxHpEntry.base = Math.max(1, maxHpBase);
        recomputeOneStat(maxHpEntry);
    }

    // ── Saving throws ──────────────────────────────────────────────────────
    const saveProfSet = new Set(character.classes.flatMap(c => c.saving_throws ?? []));

    character.saves = STAT_NAMES.map(s => ({
        stat: s,
        save: statMod(statMap[s] ?? 10) + (saveProfSet.has(s) ? pb : 0),
    }));

    // ── Spell Slots ────────────────────────────────────────────────────────
    const regularCasters = character.classes.filter(
        c => c.caster && c.casterType && c.casterType !== 'pact_magic'
    );
    const pactCasters = character.classes.filter(c => c.casterType === 'pact_magic');

    let regularSlots = [];
    if (regularCasters.length === 1) {
        const cls   = regularCasters[0];
        const table = CASTER_TABLES[cls.casterType];
        const row   = table?.[String(cls.level)];
        if (row) regularSlots = slotsFromRow(row, character.spell_slots ?? []);
    } else if (regularCasters.length > 1) {
        const combined = regularCasters.reduce((sum, cls) => {
            const contrib = MULTICLASS_CONTRIB[cls.casterType];
            return sum + (contrib ? contrib(cls.level) : 0);
        }, 0);
        if (combined > 0) {
            const row = fullCasterData.spell_slots[String(Math.min(combined, 20))];
            if (row) regularSlots = slotsFromRow(row, character.spell_slots ?? []);
        }
    }
    character.spell_slots = regularSlots.length ? regularSlots : null;

    let pactSlots = [];
    if (pactCasters.length) {
        const cls = pactCasters[0];
        const row = pactMagicData.spell_slots?.[String(cls.level)];
        if (row) pactSlots = slotsFromRow(row, character.pact_slots ?? []);
    }
    character.pact_slots = pactSlots.length ? pactSlots : null;
}

module.exports = { computeAllDerived };