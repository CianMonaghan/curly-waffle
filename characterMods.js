'use strict';

// ─── characterMods.js ─────────────────────────────────────────────────────────
//
// Every mutation to a Character object MUST go through applyMod().
// applyMod() returns an applied record containing full reversalData so that
// reverseMod() can undo it exactly — no information lost.
//
// Operations (mod.op):
//
//   statAdd    { stat, value }          Add to a stat score (e.g. race ASI +2)
//   statSet    { stat, value }          Set a stat score to an exact value
//   scalarSet  { path, value }          Set any scalar field by dot-path
//   listAdd    { path, value }          Push a value onto an array at dot-path
//   mapSet     { path, key, value }     Set a key in an object at dot-path
//   mapDelete  { path, key }            Delete a key from an object at dot-path
//
// All paths use dot-notation: 'inventory.items', 'hitpoints.current_hit_points', etc.
// Stat names use the full English name: 'Strength', 'Dexterity', etc.

// ─── Path helpers ─────────────────────────────────────────────────────────────

function getAtPath(obj, pathStr) {
    return pathStr.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function setAtPath(obj, pathStr, val) {
    const parts = pathStr.split('.');
    const last  = parts.pop();
    const parent = parts.reduce((o, k) => o[k], obj);
    parent[last] = val;
}

// ─── Stat helpers (stats is an array of { stat, score }) ─────────────────────

function getStatEntry(character, statName) {
    const entry = character.stats.find(s => s.stat === statName);
    if (!entry) throw new Error(`Stat not found on character: "${statName}"`);
    return entry;
}

// ─── Individual apply functions ───────────────────────────────────────────────

const PRIMARY_STATS = new Set(['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma']);

function applyStatAdd(character, mod) {
    const entry = getStatEntry(character, mod.stat);
    const prev  = entry.score;
    const raw   = prev + mod.value;
    entry.score = PRIMARY_STATS.has(mod.stat) ? Math.min(20, Math.max(1, raw)) : raw;
    return { op: 'statAdd', stat: mod.stat, value: mod.value, reversalData: { prev } };
}

function applyStatSet(character, mod) {
    const entry = getStatEntry(character, mod.stat);
    const prev  = entry.score;
    entry.score = mod.value;
    return { op: 'statSet', stat: mod.stat, value: mod.value, reversalData: { prev } };
}

function applyScalarSet(character, mod) {
    const prev = getAtPath(character, mod.path);
    setAtPath(character, mod.path, mod.value);
    return { op: 'scalarSet', path: mod.path, value: mod.value, reversalData: { prev } };
}

function applyListAdd(character, mod) {
    const arr = getAtPath(character, mod.path);
    if (!Array.isArray(arr)) throw new Error(`Path "${mod.path}" is not an array`);
    const idx = arr.length;
    arr.push(mod.value);
    return { op: 'listAdd', path: mod.path, value: mod.value, reversalData: { idx } };
}

function applyMapSet(character, mod) {
    const map    = getAtPath(character, mod.path);
    const hadKey = Object.prototype.hasOwnProperty.call(map, mod.key);
    const prev   = map[mod.key];
    map[mod.key] = mod.value;
    return { op: 'mapSet', path: mod.path, key: mod.key, value: mod.value, reversalData: { hadKey, prev } };
}

function applyMapDelete(character, mod) {
    const map  = getAtPath(character, mod.path);
    const prev = map[mod.key];
    delete map[mod.key];
    return { op: 'mapDelete', path: mod.path, key: mod.key, reversalData: { prev } };
}

function applyListRemove(character, mod) {
    const arr = getAtPath(character, mod.path);
    if (!Array.isArray(arr)) throw new Error(`Path "${mod.path}" is not an array`);
    const idx = arr.findIndex(el =>
        (typeof el === 'object' && el !== null)
            ? el[mod.matchKey] === mod.matchValue
            : el === mod.matchValue
    );
    if (idx === -1) throw new Error(
        `listRemove: no element with ${mod.matchKey}="${mod.matchValue}" at path "${mod.path}"`
    );
    const removed = arr.splice(idx, 1)[0];
    return { op: 'listRemove', path: mod.path, matchKey: mod.matchKey, matchValue: mod.matchValue, reversalData: { idx, removed } };
}

// ─── Individual reverse functions ─────────────────────────────────────────────

function reverseStatAdd(character, applied) {
    const entry = getStatEntry(character, applied.stat);
    entry.score = applied.reversalData.prev;
}

function reverseStatSet(character, applied) {
    const entry = getStatEntry(character, applied.stat);
    entry.score = applied.reversalData.prev;
}

function reverseScalarSet(character, applied) {
    setAtPath(character, applied.path, applied.reversalData.prev);
}

function reverseListAdd(character, applied) {
    const arr = getAtPath(character, applied.path);
    arr.splice(applied.reversalData.idx, 1);
}

function reverseMapSet(character, applied) {
    const map = getAtPath(character, applied.path);
    if (applied.reversalData.hadKey) {
        map[applied.key] = applied.reversalData.prev;
    } else {
        delete map[applied.key];
    }
}

function reverseMapDelete(character, applied) {
    const map = getAtPath(character, applied.path);
    map[applied.key] = applied.reversalData.prev;
}

function reverseListRemove(character, applied) {
    const arr = getAtPath(character, applied.path);
    arr.splice(applied.reversalData.idx, 0, applied.reversalData.removed);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply a single modification to character.
 * Returns an applied record with reversalData. Store this to enable reversal.
 */
function applyMod(character, mod) {
    switch (mod.op) {
        case 'statAdd':   return applyStatAdd(character, mod);
        case 'statSet':   return applyStatSet(character, mod);
        case 'scalarSet': return applyScalarSet(character, mod);
        case 'listAdd':   return applyListAdd(character, mod);
        case 'mapSet':     return applyMapSet(character, mod);
        case 'mapDelete':  return applyMapDelete(character, mod);
        case 'listRemove': return applyListRemove(character, mod);
        default: throw new Error(`Unknown mod op: "${mod.op}"`);
    }
}

/**
 * Reverse a previously applied modification.
 * Pass the applied record returned by applyMod().
 */
function reverseMod(character, applied) {
    switch (applied.op) {
        case 'statAdd':   return reverseStatAdd(character, applied);
        case 'statSet':   return reverseStatSet(character, applied);
        case 'scalarSet': return reverseScalarSet(character, applied);
        case 'listAdd':   return reverseListAdd(character, applied);
        case 'mapSet':     return reverseMapSet(character, applied);
        case 'mapDelete':  return reverseMapDelete(character, applied);
        case 'listRemove': return reverseListRemove(character, applied);
        default: throw new Error(`Unknown mod op for reversal: "${applied.op}"`);
    }
}

/**
 * Reverse an entire active_feature entry (applied_feature_record) in reverse order.
 * Pass one element from character.active_features.
 */
function reverseActiveFeature(character, activeFeatureEntry) {
    for (const record of activeFeatureEntry.applied_feature_record) {
        for (const appliedMod of [...record.applied_modifications].reverse()) {
            for (const a of [...appliedMod.applied].reverse()) {
                reverseMod(character, a);
            }
        }
    }
}

module.exports = { applyMod, reverseMod, reverseActiveFeature };
