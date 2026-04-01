'use strict';

// ─── featureDispatch.js ───────────────────────────────────────────────────────
//
// Executes a feature's mechanical effect directly on the character using the
// modifier stack system.
//
// The `source` parameter is any object with at minimum { id: string }.
// It can be an item, a class entry, a race template, a background, etc.
// The source.id is used as the source_id for all modifier stack entries,
// which means removeSourceModifiers(character, source.id) undoes everything
// this feature added — regardless of what type of thing the source is.
//
// Usage:
//   dispatchFeature(feature, source, character)
//   dispatchFeature(feature, source, character, slot)   // slot only used by addAttack
//
// Handlers (feature.handler values):
//
//   calcAC     — adds an AC modifier from feature.data.{ base_ac, dex_cap, is_shield }
//   addAttack  — pushes an entry to equipped_weapons from feature.data + source fields
//   statSet    — addStatModifier "set" from feature.data.{ stat, value }
//   statAdd    — addStatModifier "add" from feature.data.{ stat, value }
//
// Adding a new handler:
//   1. Write handleYourThing(feature, source, character, slot)
//   2. Add a case to the switch in dispatchFeature()
//   3. Set handler: "yourThing" and data: { ... } on the feature JSON — anywhere

const { addStatModifier, addACModifier } = require('./characterMods');

// ─── calcAC ───────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   base_ac   {number}       — flat base AC value (required)
//   dex_cap   {number|null}  — max dex bonus: null = unlimited, 0 = none, N = max +N
//   is_shield {boolean}      — true = additive "add" modifier; false = "set" modifier
//
// Works on: armor items, shield items, class features (e.g. Unarmored Defense),
//           spells (e.g. Mage Armor), racial features, etc.

function handleCalcAC(feature, source, character) {
    const data = feature.data ?? {};
    const { base_ac, dex_cap, is_shield } = data;

    if (base_ac == null) {
        console.warn(`[featureDispatch] calcAC feature "${feature.id}" missing base_ac in data`);
        return;
    }

    if (is_shield) {
        // Shield / additive bonus — stacks on top of base AC
        addACModifier(character, source.id, 'add', base_ac);
    } else {
        // Body armor / Unarmored Defense — sets the AC base (highest "set" wins)
        const dexEntry = character.stats.find(s => s.stat === 'Dexterity');
        const dexMod   = Math.floor(((dexEntry?.score ?? 10) - 10) / 2);

        let ac;
        if (dex_cap === null || dex_cap === undefined) {
            ac = base_ac + dexMod;                     // light / unarmored: full dex
        } else if (dex_cap === 0) {
            ac = base_ac;                              // heavy: no dex
        } else {
            ac = base_ac + Math.min(dexMod, dex_cap); // medium: capped dex
        }

        addACModifier(character, source.id, 'set', ac);
    }
}

// ─── addAttack ────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   mode    {"melee"|"ranged"}        — how the attack works (required)
//   dice    {num, sides}              — damage die (overrides source.dice if present)
//   damage  {string}                 — damage string fallback e.g. "1d6" (if no dice)
//   name    {string}                 — display name override
//
// Fallback order for dice: feature.data.dice → source.dice (item) → 1d4
//
// Works on: weapon items, class features (e.g. Unarmed Strike, Natural Weapons),
//           racial features (e.g. Claws, Bite), etc.

function handleAddAttack(feature, source, character, slot) {
    const mode = feature.data?.mode ?? 'melee';
    slot = slot ?? 'main_hand';

    // Dice resolution: feature.data.dice → source.dice → fallback
    let damageDie;
    if (feature.data?.dice) {
        const d = feature.data.dice;
        damageDie = `${d.num}d${d.sides}`;
    } else {
        const dieSource = (mode === 'ranged' && source.dice?.twoHand)
            ? source.dice.twoHand
            : source.dice?.oneHand;
        damageDie = dieSource
            ? `${dieSource.num}d${dieSource.sides}`
            : (feature.data?.damage ?? '1d4');
    }

    character.equipped_weapons.push({
        slot,
        item_id:    source.id,
        feature_id: feature.id,
        name:       feature.data?.name ?? feature.name ?? source.name,
        damage:     damageDie,
        mode,
    });
}

// ─── statSet ──────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   stat   {string}  — full stat name e.g. "Constitution"
//   value  {number}  — value to force the stat to (overrides base if higher)
//
// Works on: magic items (Amulet of Health), class features, racial features, etc.

function handleStatSet(feature, source, character) {
    const { stat, value } = feature.data ?? {};
    if (!stat || value == null) {
        console.warn(`[featureDispatch] statSet feature "${feature.id}" missing stat/value in data`);
        return;
    }
    addStatModifier(character, source.id, stat, 'set', value);
}

// ─── statAdd ──────────────────────────────────────────────────────────────────
//
// feature.data fields:
//   stat   {string}  — full stat name e.g. "Strength"
//   value  {number}  — amount to add (can be negative)
//
// Works on: racial ASIs, class ASIs, magic items, etc.

function handleStatAdd(feature, source, character) {
    const { stat, value } = feature.data ?? {};
    if (!stat || value == null) {
        console.warn(`[featureDispatch] statAdd feature "${feature.id}" missing stat/value in data`);
        return;
    }
    addStatModifier(character, source.id, stat, 'add', value);
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

/**
 * Execute a feature's mechanical effect on the character.
 *
 * @param {object} feature   - Feature object: { id, name, handler, data, trigger }
 * @param {object} source    - The thing this feature belongs to: { id, name?, dice?, ... }
 *                             Can be an item, class, race, background, or any source object.
 *                             source.id is used as the source_id for all modifier entries.
 * @param {object} character - Character to mutate
 * @param {string} [slot]    - Weapon slot ("main_hand"|"off_hand"|"two_hand"); addAttack only
 */
function dispatchFeature(feature, source, character, slot) {
    if (!feature?.handler) return;   // null handler = informational feature, no effect

    switch (feature.handler) {
        case 'calcAC':    return handleCalcAC(feature, source, character);
        case 'addAttack': return handleAddAttack(feature, source, character, slot);
        case 'statSet':   return handleStatSet(feature, source, character);
        case 'statAdd':   return handleStatAdd(feature, source, character);
        default:
            console.warn(`[featureDispatch] Unknown handler: "${feature.handler}" on feature "${feature.id}"`);
    }
}

module.exports = { dispatchFeature };
