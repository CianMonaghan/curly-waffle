'use strict';

// ─── characterMods.js ─────────────────────────────────────────────────────────
//
// Modifier stack system. Every mechanical effect is tagged with a source_id.
// Removing a source = filtering by source_id — no reversalData, no index tracking.
//
// Stat resolution:
//   natural = clamp(base + sum(adds), 1, 20)
//   score   = max(natural, max(set values))  — "set" type overrides if higher
//
// AC resolution:
//   base         = max(set modifier values)  if any exist
//                  else 10 + dexMod          (unarmored)
//   armor_class  = base + sum(add modifier values)
//
// Exported API:
//   addStatModifier(character, sourceId, stat, type, value)
//   addACModifier(character, sourceId, type, value)
//   removeSourceModifiers(character, sourceId)
//   recomputeStats(character)
//   recomputeAC(character)
//   addToList(character, path, value, sourceId)
//   removeFromList(character, path, sourceId)
//   removeSource(character, sourceId)
//   scalarSet(character, path, value)

// ─── Path helpers ─────────────────────────────────────────────────────────────

function getAtPath(obj, pathStr) {
    return pathStr.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function setAtPath(obj, pathStr, val) {
    const parts  = pathStr.split('.');
    const last   = parts.pop();
    const parent = parts.reduce((o, k) => o[k], obj);
    parent[last] = val;
}

// ─── Stat resolution ──────────────────────────────────────────────────────────

const statMod = score => Math.floor((score - 10) / 2);

// Only these six stats are clamped to [1, 20]. Speed, Initiative, MaxHP are not.
const PRIMARY_STATS = new Set([
    'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma',
]);

function recomputeOneStat(entry) {
    const adds    = entry.modifiers.filter(m => m.type === 'add').reduce((s, m) => s + m.value, 0);
    const sets    = entry.modifiers.filter(m => m.type === 'set').map(m => m.value);
    const raw     = entry.base + adds;
    const natural = PRIMARY_STATS.has(entry.stat)
        ? Math.min(20, Math.max(1, raw))   // primary stats: clamp [1, 20]
        : Math.max(0, raw);                // Speed / Initiative / MaxHP: floor at 0 only
    entry.score   = sets.length ? Math.max(natural, Math.max(...sets)) : natural;
}

function recomputeStats(character) {
    for (const entry of character.stats) {
        recomputeOneStat(entry);
    }
}

// ─── AC resolution ────────────────────────────────────────────────────────────

function recomputeAC(character) {
    const dexEntry = character.stats.find(s => s.stat === 'Dexterity');
    const dex      = statMod(dexEntry?.score ?? 10);
    const setMods  = character.ac_modifiers.filter(m => m.type === 'set');
    const addTotal = character.ac_modifiers.filter(m => m.type === 'add').reduce((s, m) => s + m.value, 0);
    const base     = setMods.length ? Math.max(...setMods.map(m => m.value)) : (10 + dex);
    character.armor_class = base + addTotal;
}

// ─── Modifier stack ops ───────────────────────────────────────────────────────

/**
 * Add a modifier to a stat's modifier stack, then recompute that stat's score.
 * @param {string} type - "add" (stacks with others) | "set" (overrides if higher than natural)
 */
function addStatModifier(character, sourceId, stat, type, value) {
    const entry = character.stats.find(s => s.stat === stat);
    if (!entry) throw new Error(`addStatModifier: stat not found: "${stat}"`);
    entry.modifiers.push({ source_id: sourceId, type, value });
    recomputeOneStat(entry);
}

/**
 * Add a modifier to the AC modifier stack, then recompute armor_class.
 * @param {string} type - "set" (body armor base) | "add" (shield, spell bonus)
 */
function addACModifier(character, sourceId, type, value) {
    character.ac_modifiers.push({ source_id: sourceId, type, value });
    recomputeAC(character);
}

/**
 * Remove ALL stat and AC modifiers belonging to sourceId, then recompute.
 * Returns true if anything was changed.
 */
function removeSourceModifiers(character, sourceId) {
    let changed = false;

    for (const entry of character.stats) {
        const before = entry.modifiers.length;
        entry.modifiers = entry.modifiers.filter(m => m.source_id !== sourceId);
        if (entry.modifiers.length !== before) {
            recomputeOneStat(entry);
            changed = true;
        }
    }

    const acBefore = character.ac_modifiers.length;
    character.ac_modifiers = character.ac_modifiers.filter(m => m.source_id !== sourceId);
    if (character.ac_modifiers.length !== acBefore) {
        recomputeAC(character);
        changed = true;
    }

    return changed;
}

// ─── Source-tagged array helpers ──────────────────────────────────────────────

// Standard lists that carry source_id on each entry
const LIST_PATHS = [
    'features',
    'skill_proficiencies',
    'tool_proficiencies',
    'item_proficiencies',
];

/**
 * Push a value onto the array at dot-path, tagging it with source_id.
 * Object values get { ...value, source_id: sourceId } merged in.
 * Primitive values (strings) are pushed as-is (e.g. character.languages).
 */
function addToList(character, path, value, sourceId) {
    const arr = getAtPath(character, path);
    if (!Array.isArray(arr)) throw new Error(`addToList: "${path}" is not an array`);
    const entry = (typeof value === 'object' && value !== null)
        ? { ...value, source_id: sourceId }
        : value;
    arr.push(entry);
}

/**
 * Remove all object entries tagged with sourceId from the array at dot-path.
 * Primitive entries (languages) are not source-tracked and are left alone.
 */
function removeFromList(character, path, sourceId) {
    const arr = getAtPath(character, path);
    if (!Array.isArray(arr)) throw new Error(`removeFromList: "${path}" is not an array`);
    const before   = arr.length;
    const filtered = arr.filter(el =>
        (typeof el === 'object' && el !== null) ? el.source_id !== sourceId : true
    );
    arr.length = 0;
    arr.push(...filtered);
    return arr.length !== before;
}

/**
 * Remove ALL traces of sourceId from the character:
 *   - All stat/AC modifiers with exact sourceId match
 *   - All ASI sub-source modifiers (e.g. "class-0-asi-r0-p0" when sourceId = "class-0")
 *   - All source-tagged entries in standard list paths and inventory.items
 */
function removeSource(character, sourceId) {
    removeSourceModifiers(character, sourceId);

    // Strip ASI sub-sources tagged as `${sourceId}-asi-*`
    const asiPrefix = sourceId + '-asi-';
    for (const entry of character.stats) {
        const before = entry.modifiers.length;
        entry.modifiers = entry.modifiers.filter(m => !m.source_id.startsWith(asiPrefix));
        if (entry.modifiers.length !== before) recomputeOneStat(entry);
    }

    for (const path of LIST_PATHS) {
        removeFromList(character, path, sourceId);
    }
    removeFromList(character, 'inventory.items', sourceId);
}

// ─── Scalar helper ────────────────────────────────────────────────────────────

/**
 * Set any scalar field by dot-path.
 * Used for character.race, character.background, character.speed, etc.
 */
function scalarSet(character, path, value) {
    setAtPath(character, path, value);
}

module.exports = {
    addStatModifier,
    addACModifier,
    removeSourceModifiers,
    recomputeOneStat,
    recomputeStats,
    recomputeAC,
    addToList,
    removeFromList,
    removeSource,
    scalarSet,
};
