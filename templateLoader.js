'use strict';

// ─── templateLoader.js ────────────────────────────────────────────────────────
//
// Loads class / subclass / race / background templates from disk.
//
// Search order (first match wins):
//
//   Classes:    server/class_templates/<ClassName>/<classname>.json
//               curly-waffle/static_json/classes/<classname>.json
//
//   Subclasses: server/class_templates/<ClassName>/<classname>_<subclassname>.json
//               curly-waffle/static_json/subclasses/<classname>_<subclassname>.json
//
//   Races:      server/race_templates/<racename>.json
//               curly-waffle/static_json/races/<racename>.json
//
//   Backgrounds: server/background_templates/<bgname>.json
//                curly-waffle/static_json/backgrounds/<bgname>.json
//
// Template files for homebrew classes just need to be dropped into the right
// folder — no code changes required.

const fs   = require('fs');
const path = require('path');

// Paths relative to this file (curly-waffle/)
const SERVER_ROOT = path.join(__dirname, '..', 'server');
const STATIC_ROOT = path.join(__dirname, 'static_json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 'Hill Dwarf' → 'hill_dwarf' */
function normalize(name) {
    return name.toLowerCase().replace(/\s+/g, '_');
}

/**
 * For multi-word names, also try reversing the word order.
 * 'Hill Dwarf' → 'dwarf_hill'  (matches how many race files are named)
 * Single-word names return an empty array (no alternative to try).
 */
function normalizeReversed(name) {
    const words = name.trim().toLowerCase().split(/\s+/);
    if (words.length < 2) return null;
    return [...words].reverse().join('_');
}

/**
 * 'fighter' → 'Fighter'
 * Matches the actual capitalised folder names used on disk (Fighter/, Wizzard/).
 */
function capitalize(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Try each candidate path in order; parse and return the first one found. */
function tryLoad(candidates) {
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try {
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            } catch (e) {
                throw new Error(`Failed to parse template at ${p}: ${e.message}`);
            }
        }
    }
    return null;
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

function loadClassTemplate(name) {
    const norm   = normalize(name);
    const folder = capitalize(norm);   // e.g. 'fighter' → 'Fighter'

    const template = tryLoad([
        // server/class_templates/Fighter/fighter.json
        path.join(SERVER_ROOT, 'class_templates', folder, `${norm}.json`),
        // server/class_templates/fighter/fighter.json  (lowercase fallback)
        path.join(SERVER_ROOT, 'class_templates', norm,   `${norm}.json`),
        // curly-waffle/static_json/classes/fighter.json
        path.join(STATIC_ROOT, 'classes', `${norm}.json`),
    ]);

    if (!template) throw new Error(`No class template found for: "${name}"`);
    return template;
}

function loadSubclassTemplate(className, subclassName) {
    const normClass    = normalize(className);
    const normSubclass = normalize(subclassName);
    const folder       = capitalize(normClass);
    const filename     = `${normClass}_${normSubclass}.json`;

    const template = tryLoad([
        // server/class_templates/Fighter/fighter_battle_master.json
        path.join(SERVER_ROOT, 'class_templates', folder, filename),
        // server/class_templates/fighter/fighter_battle_master.json
        path.join(SERVER_ROOT, 'class_templates', normClass, filename),
        // curly-waffle/static_json/subclasses/fighter_battle_master.json
        path.join(STATIC_ROOT, 'subclasses', filename),
    ]);

    if (!template) {
        console.warn(`[templateLoader] No subclass template found for: "${className}/${subclassName}"`);
    }
    return template;  // null is a valid return (missing subclass is non-fatal)
}

function loadRaceTemplate(name) {
    const norm = normalize(name);
    const rev  = normalizeReversed(name);   // e.g. 'Hill Dwarf' → 'dwarf_hill'

    const template = tryLoad([
        path.join(SERVER_ROOT, 'race_templates', `${norm}.json`),
        path.join(STATIC_ROOT, 'races',          `${norm}.json`),
        // reversed word order fallback
        ...(rev ? [
            path.join(SERVER_ROOT, 'race_templates', `${rev}.json`),
            path.join(STATIC_ROOT, 'races',          `${rev}.json`),
        ] : []),
    ]);

    if (!template) throw new Error(`No race template found for: "${name}"`);
    return template;
}

function loadBackgroundTemplate(name) {
    const norm = normalize(name);

    const template = tryLoad([
        path.join(SERVER_ROOT, 'background_templates', `${norm}.json`),
        path.join(STATIC_ROOT, 'backgrounds',          `${norm}.json`),
    ]);

    if (!template) throw new Error(`No background template found for: "${name}"`);
    return template;
}

module.exports = {
    loadClassTemplate,
    loadSubclassTemplate,
    loadRaceTemplate,
    loadBackgroundTemplate,
};
