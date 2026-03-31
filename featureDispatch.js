'use strict';

// ─── featureDispatch.js ───────────────────────────────────────────────────────
//
// Translates a feature object into an array of applyMod-compatible mod objects.
//
// ALL values come from feature.data or the item object — nothing is hardcoded.
// This means custom homebrew items work automatically: just set handler and data
// on their features and the parser handles them with no code changes.
//
// Usage:
//   const mods = dispatchFeature(feature, item, character);
//   for (const mod of mods) appliedMods.push(applyMod(character, mod));
//
// Handlers (feature.handler values):
//
//   calcAC     — set armor_class from feature.data.{ base_ac, dex_cap, is_shield }
//   addAttack  — add entry to equipped_weapons from item fields + feature.data.mode
//   statSet    — set a stat score from feature.data.{ stat, value }
//   statAdd    — add to a stat score from feature.data.{ stat, value }
//
// Adding a new handler for a homebrew item type:
//   1. Write a function handleYourThing(feature, item, character) returning mod[]
//   2. Add a case to the switch in dispatchFeature()
//   3. Set handler: "yourThing" and data: { ... } on the item's feature JSON

// ─── calcAC ───────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   base_ac   {number}       — the flat base AC of the armor (required)
//   dex_cap   {number|null}  — max dex bonus: null = unlimited, 0 = no dex, N = max +N
//   is_shield {boolean}      — true if this is a shield (additive to current AC)

function handleCalcAC(feature, character) {
    const data = feature.data ?? {};
    const { base_ac, dex_cap, is_shield } = data;

    if (base_ac == null) {
        console.warn(`[featureDispatch] calcAC feature "${feature.id}" missing base_ac in data`);
        return [];
    }

    const dexEntry = character.stats.find(s => s.stat === 'Dexterity');
    const dexMod   = Math.floor(((dexEntry?.score ?? 10) - 10) / 2);

    if (is_shield) {
        // Shield is additive: read current AC and add base_ac to it
        return [{ op: 'scalarSet', path: 'armor_class', value: character.armor_class + base_ac }];
    }

    let ac;
    if (dex_cap === null || dex_cap === undefined) {
        ac = base_ac + dexMod;                        // light: full dex bonus
    } else if (dex_cap === 0) {
        ac = base_ac;                                 // heavy: no dex
    } else {
        ac = base_ac + Math.min(dexMod, dex_cap);    // medium: capped dex
    }

    return [{ op: 'scalarSet', path: 'armor_class', value: ac }];
}

// ─── addAttack ────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   mode  {"melee"|"ranged"}  — determines which dice/range values to use
//
// All other values come from the item object itself (dice, primary_stat, etc.)

function handleAddAttack(feature, item, character) {
    const mode = feature.data?.mode ?? 'melee';

    // Compute best stat modifier from primary_stat list
    const statMap = Object.fromEntries(character.stats.map(s => [s.stat, s.score]));
    const primaryStats = Array.isArray(item.primary_stat) && item.primary_stat.length
        ? item.primary_stat
        : ['Strength'];
    const bestMod = Math.max(
        ...primaryStats.map(s => Math.floor(((statMap[s] ?? 10) - 10) / 2))
    );

    // Pick the correct damage die (ranged weapons may use twoHand die for their damage)
    const dieSource = (mode === 'ranged' && item.dice?.twoHand)
        ? item.dice.twoHand
        : item.dice?.oneHand;
    const damageDie = dieSource
        ? `${dieSource.num}d${dieSource.sides}`
        : '1d4';

    const weaponEntry = {
        id:           feature.id,
        name:         feature.name ?? item.name,
        damage:       damageDie,
        reference_id: { local_id: item.local_id ?? 0 },
    };

    return [{ op: 'listAdd', path: 'equipped_weapons', value: weaponEntry }];
}

// ─── statSet ──────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   stat   {string}  — full stat name e.g. "Constitution"
//   value  {number}  — value to set the stat to

function handleStatSet(feature) {
    const { stat, value } = feature.data ?? {};
    if (!stat || value == null) {
        console.warn(`[featureDispatch] statSet feature "${feature.id}" missing stat/value in data`);
        return [];
    }
    return [{ op: 'statSet', stat, value }];
}

// ─── statAdd ──────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   stat   {string}  — full stat name e.g. "Strength"
//   value  {number}  — amount to add (can be negative)

function handleStatAdd(feature) {
    const { stat, value } = feature.data ?? {};
    if (!stat || value == null) {
        console.warn(`[featureDispatch] statAdd feature "${feature.id}" missing stat/value in data`);
        return [];
    }
    return [{ op: 'statAdd', stat, value }];
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

/**
 * Translate a feature object into an array of mod descriptors for applyMod().
 *
 * @param {object} feature   - Full feature object: { id, name, handler, data, trigger }
 * @param {object} item      - The item this feature belongs to (read-only)
 * @param {object} character - Current character state (read-only within this function)
 * @returns {Array<object>}  - Zero or more mod objects ready for applyMod()
 */
function dispatchFeature(feature, item, character) {
    if (!feature?.handler) return [];   // null handler = informational feature, no mechanical effect

    switch (feature.handler) {
        case 'calcAC':    return handleCalcAC(feature, character);
        case 'addAttack': return handleAddAttack(feature, item, character);
        case 'statSet':   return handleStatSet(feature);
        case 'statAdd':   return handleStatAdd(feature);
        default:
            console.warn(`[featureDispatch] Unknown handler: "${feature.handler}" on feature "${feature.id}"`);
            return [];
    }
}

module.exports = { dispatchFeature };
