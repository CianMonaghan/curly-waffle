'use strict';

// ─── applyItems.js ────────────────────────────────────────────────────────────
//
// Atomic item lifecycle methods with slot enforcement.
//
// Slot state lives on the character, not on items:
//   character.equipped_armor  { body: itemId|null, shield: itemId|null }
//   character.attuned_items   [{ item_id, name }]  (max attuned_cap entries)
//   character.equipped_weapons [{ slot, item_id, feature_id, name, damage, mode }]
//
// Mechanical effects (AC, stat modifiers) are applied via featureDispatch and
// stored in the modifier stacks (character.ac_modifiers, stat.modifiers).
// Reversal = removeSourceModifiers(character, itemId).
//
// Key convention for source IDs: use item.id as-is — items have unique IDs
// already, so no additional prefix is needed.

const { removeSourceModifiers, recomputeAC } = require('./characterMods');
const { dispatchFeature }                     = require('./featureDispatch');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findItem(character, itemId) {
    const item = character.inventory.items.find(i => i.id === itemId);
    if (!item) throw new Error(`applyItems: item "${itemId}" not found in inventory`);
    return item;
}

// ─── obtainItem ───────────────────────────────────────────────────────────────

/**
 * Add an item to the character's inventory and fire features_on_obtain.
 *
 * @param {object} character - Character to modify
 * @param {object} item      - Full item object to add
 */
function obtainItem(character, item) {
    character.inventory.items.push(item);

    for (const feat of (item.features_on_obtain ?? [])) {
        dispatchFeature(feat, item, character);
    }
}

// ─── loseItem ─────────────────────────────────────────────────────────────────

/**
 * Remove an item from inventory. Unequips and/or detunes first if necessary.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function loseItem(character, itemId) {
    // Unequip armor if needed
    if (character.equipped_armor.body === itemId) {
        unequipArmor(character, itemId);
    } else if (character.equipped_armor.shield === itemId) {
        unequipArmor(character, itemId);
    }

    // Unequip weapon if needed
    if (character.equipped_weapons.some(e => e.item_id === itemId)) {
        unequipWeapon(character, itemId);
    }

    // Detune if needed
    if (character.attuned_items.some(a => a.item_id === itemId)) {
        detuneItem(character, itemId);
    }

    // Remove any obtain-time modifiers
    removeSourceModifiers(character, itemId);

    // Remove from inventory
    character.inventory.items = character.inventory.items.filter(i => i.id !== itemId);
}

// ─── equipArmor ───────────────────────────────────────────────────────────────

/**
 * Equip a piece of armor or a shield that is already in inventory.
 * Determines body vs shield slot from features_on_equip.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function equipArmor(character, itemId) {
    const item     = findItem(character, itemId);
    const isShield = (item.features_on_equip ?? []).some(
        f => f.handler === 'calcAC' && f.data?.is_shield
    );
    const slot = isShield ? 'shield' : 'body';

    if (isShield && character.equipped_weapons.some(e => e.slot === 'two_hand')) {
        throw new Error('equipArmor: cannot equip shield — a two-handed weapon is equipped');
    }

    if (character.equipped_armor[slot]) {
        throw new Error(
            `equipArmor: ${slot} slot already occupied by "${character.equipped_armor[slot]}"`
        );
    }

    character.equipped_armor[slot] = itemId;

    for (const feat of (item.features_on_equip ?? [])) {
        dispatchFeature(feat, item, character);
    }
}

// ─── unequipArmor ─────────────────────────────────────────────────────────────

/**
 * Unequip armor or shield. Removes its AC modifier and recomputes armor_class.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function unequipArmor(character, itemId) {
    const slot =
        character.equipped_armor.body   === itemId ? 'body'   :
        character.equipped_armor.shield === itemId ? 'shield' : null;

    if (!slot) throw new Error(`unequipArmor: item "${itemId}" is not equipped in any armor slot`);

    character.equipped_armor[slot] = null;
    removeSourceModifiers(character, itemId);
    recomputeAC(character);
}

// ─── equipWeapon ──────────────────────────────────────────────────────────────

/**
 * Equip a weapon with slot enforcement.
 *
 * Slot rules:
 *   "two_hand" — no other weapons equipped, no shield equipped
 *   "main_hand" / "off_hand" — no two-hander present; max 2 weapon slots total
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 * @param {string} slot      - "main_hand" | "off_hand" | "two_hand"
 */
function equipWeapon(character, itemId, slot) {
    if (slot === 'two_hand') {
        if (character.equipped_weapons.length > 0) {
            throw new Error('equipWeapon: cannot equip two-handed weapon — other weapons are equipped');
        }
        if (character.equipped_armor.shield) {
            throw new Error('equipWeapon: cannot equip two-handed weapon — shield is equipped');
        }
    } else {
        if (character.equipped_weapons.some(e => e.slot === 'two_hand')) {
            throw new Error('equipWeapon: cannot equip weapon — a two-handed weapon is already equipped');
        }
        if (character.equipped_weapons.length >= 2) {
            throw new Error('equipWeapon: cannot equip weapon — both weapon slots are occupied');
        }
    }

    const item = findItem(character, itemId);

    for (const feat of (item.features_on_equip ?? [])) {
        dispatchFeature(feat, item, character, slot);
    }
}

// ─── unequipWeapon ────────────────────────────────────────────────────────────

/**
 * Unequip a weapon. Removes it from equipped_weapons and cleans up any
 * stat modifiers the weapon granted.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function unequipWeapon(character, itemId) {
    const before = character.equipped_weapons.length;
    character.equipped_weapons = character.equipped_weapons.filter(e => e.item_id !== itemId);

    if (character.equipped_weapons.length === before) {
        throw new Error(`unequipWeapon: item "${itemId}" is not in equipped_weapons`);
    }

    removeSourceModifiers(character, itemId);
}

// ─── attuneItem ───────────────────────────────────────────────────────────────

/**
 * Attune to an item in inventory. Enforces the attuned_cap limit.
 * Fires features_on_attune via featureDispatch.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function attuneItem(character, itemId) {
    if (character.attuned_items.length >= character.attuned_cap) {
        throw new Error(
            `attuneItem: attuned_cap (${character.attuned_cap}) reached — detune an item first`
        );
    }

    const item = findItem(character, itemId);
    character.attuned_items.push({ item_id: itemId, name: item.name });

    for (const feat of (item.features_on_attune ?? [])) {
        dispatchFeature(feat, item, character);
    }
}

// ─── detuneItem ───────────────────────────────────────────────────────────────

/**
 * Remove attunement from an item. Removes all modifier stack entries
 * that the item added during attunement.
 *
 * @param {object} character - Character to modify
 * @param {string} itemId    - The item's id string
 */
function detuneItem(character, itemId) {
    const before = character.attuned_items.length;
    character.attuned_items = character.attuned_items.filter(a => a.item_id !== itemId);

    if (character.attuned_items.length === before) {
        throw new Error(`detuneItem: item "${itemId}" is not attuned`);
    }

    removeSourceModifiers(character, itemId);
}

module.exports = {
    obtainItem,
    loseItem,
    equipArmor,
    unequipArmor,
    equipWeapon,
    unequipWeapon,
    attuneItem,
    detuneItem,
};
