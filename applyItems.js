'use strict';

// ─── applyItems.js ────────────────────────────────────────────────────────────
//
// Atomic item lifecycle methods. Every operation:
//   1. Collects appliedMods[] via applyMod()
//   2. Records them atomically in active_features via recordActiveFeature()
//
// Removal operations (loseItem, unequipItem, detuneItem) use reverseActiveFeature()
// on the matching active_features entry — they do NOT dispatch features_on_unequip,
// features_on_lose, or features_on_detune. Those arrays on item JSONs are
// human-readable documentation only.
//
// Active feature key convention:
//   obtain:{item.id}   — set by obtainItem,  reversed by loseItem
//   equip:{item.id}    — set by equipItem,   reversed by unequipItem
//   attune:{item.id}   — set by attuneItem,  reversed by detuneItem

const { applyMod, reverseActiveFeature } = require('./characterMods');
const { dispatchFeature }                = require('./featureDispatch');
const { recordActiveFeature }            = require('./applyAttachments');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find an item in character.inventory.items by id.
 * Throws if not found.
 */
function findItem(character, itemId) {
    const item = character.inventory.items.find(i => i.id === itemId);
    if (!item) throw new Error(`applyItems: item "${itemId}" not found in inventory`);
    return item;
}

/**
 * Find an active_features entry by feature key.
 * Throws if not found.
 */
function findActiveFeature(character, featureKey) {
    const entry = character.active_features.find(af => af.feature === featureKey);
    if (!entry) throw new Error(`applyItems: no active_features entry for "${featureKey}"`);
    return entry;
}

/**
 * Dispatch all features in a feature array, collecting the resulting applyMod calls.
 */
function dispatchAll(featureArray, item, character, appliedMods) {
    for (const feat of (featureArray ?? [])) {
        const mods = dispatchFeature(feat, item, character);
        for (const mod of mods) {
            appliedMods.push(applyMod(character, mod));
        }
    }
}

// ─── obtainItem ───────────────────────────────────────────────────────────────

/**
 * Add an item to the character's inventory and fire features_on_obtain.
 * Fully reversible via loseItem().
 *
 * @param {object} character - Character to modify
 * @param {object} item      - Full item object to add
 */
function obtainItem(character, item) {
    const appliedMods = [];

    // 1. Add to inventory
    appliedMods.push(applyMod(character, {
        op: 'listAdd', path: 'inventory.items', value: item,
    }));

    // 2. Fire features_on_obtain
    dispatchAll(item.features_on_obtain, item, character, appliedMods);

    recordActiveFeature(
        character,
        `obtain:${item.id}`,
        `item-${item.id}`,
        `obtain-apply-${item.id}`,
        appliedMods,
    );
}

// ─── loseItem ─────────────────────────────────────────────────────────────────

/**
 * Remove an item from inventory by reversing its obtain record.
 * Undoes the inventory listAdd and any features_on_obtain effects.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function loseItem(character, itemId) {
    const featureKey = `obtain:${itemId}`;
    const entry      = findActiveFeature(character, featureKey);

    reverseActiveFeature(character, entry);

    const idx = character.active_features.indexOf(entry);
    character.active_features.splice(idx, 1);
}

// ─── equipItem ────────────────────────────────────────────────────────────────

/**
 * Equip an item that is already in inventory.
 * Sets equipped = true and fires features_on_equip via featureDispatch.
 * Fully reversible via unequipItem().
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function equipItem(character, itemId) {
    const item = findItem(character, itemId);
    const idx  = character.inventory.items.indexOf(item);

    const appliedMods = [];

    // 1. Mark as equipped (uses numeric index in dot-path — JS arrays allow string keys)
    appliedMods.push(applyMod(character, {
        op: 'scalarSet', path: `inventory.items.${idx}.equipped`, value: true,
    }));

    // 2. Fire features_on_equip
    dispatchAll(item.features_on_equip, item, character, appliedMods);

    recordActiveFeature(
        character,
        `equip:${itemId}`,
        `item-${itemId}`,
        `equip-apply-${itemId}`,
        appliedMods,
    );
}

// ─── unequipItem ──────────────────────────────────────────────────────────────

/**
 * Unequip an item by reversing its equip record.
 * Restores equipped = false and reverses all features_on_equip effects.
 * Does NOT dispatch features_on_unequip — reversal handles everything.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function unequipItem(character, itemId) {
    const featureKey = `equip:${itemId}`;
    const entry      = findActiveFeature(character, featureKey);

    reverseActiveFeature(character, entry);

    const idx = character.active_features.indexOf(entry);
    character.active_features.splice(idx, 1);
}

// ─── attuneItem ───────────────────────────────────────────────────────────────

/**
 * Attune to an item in inventory.
 * Sets attuned = true and fires features_on_attune via featureDispatch.
 * Fully reversible via detuneItem().
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function attuneItem(character, itemId) {
    const item = findItem(character, itemId);
    const idx  = character.inventory.items.indexOf(item);

    const appliedMods = [];

    // 1. Mark as attuned
    appliedMods.push(applyMod(character, {
        op: 'scalarSet', path: `inventory.items.${idx}.attuned`, value: true,
    }));

    // 2. Fire features_on_attune
    dispatchAll(item.features_on_attune, item, character, appliedMods);

    recordActiveFeature(
        character,
        `attune:${itemId}`,
        `item-${itemId}`,
        `attune-apply-${itemId}`,
        appliedMods,
    );
}

// ─── detuneItem ───────────────────────────────────────────────────────────────

/**
 * Remove attunement from an item by reversing its attune record.
 * Restores attuned = false and reverses all features_on_attune effects.
 * Does NOT dispatch features_on_detune — reversal handles everything.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function detuneItem(character, itemId) {
    const featureKey = `attune:${itemId}`;
    const entry      = findActiveFeature(character, featureKey);

    reverseActiveFeature(character, entry);

    const idx = character.active_features.indexOf(entry);
    character.active_features.splice(idx, 1);
}

module.exports = { obtainItem, loseItem, equipItem, unequipItem, attuneItem, detuneItem };
