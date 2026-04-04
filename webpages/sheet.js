/* Spell List */

let SPELL_DATA = {};
let CHARACTER_CLASSES = [];
let DB_ITEMS = [];
let CURRENT_CHAR_ID = null;

fetch('/static_json/external_lists/spell_list.json')
    .then(res => res.json())
    .then(data => { SPELL_DATA = data.spells; });

function buildSpellModal() {
    const body = document.getElementById('spell-modal-body');
    body.innerHTML = '';

    for (const [level, spells] of Object.entries(SPELL_DATA)) {
        const section = document.createElement('div');
        section.className = 'spell-modal-section';
        section.style.marginBottom = '16px';

        const heading = document.createElement('h3');
        heading.textContent = level;
        heading.style.cssText = 'border-bottom:1px solid black; padding-bottom:4px; margin:0 0 6px 0;';
        section.appendChild(heading);

        const list = document.createElement('div');
        list.style.cssText = 'column-count:3; column-gap:16px;';

        for (const [name, data] of Object.entries(spells).sort(([a], [b]) => a.localeCompare(b))) {
            const entry = document.createElement('div');
            entry.className = 'spell-entry';
            entry.style.cssText = 'font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:2px 4px; break-inside:avoid;';
            entry.dataset.name = name.toLowerCase();
            entry.dataset.classes = data.classes.join(',');

            const link = document.createElement('a');
            link.href   = data.link;
            link.target = '_blank';
            link.rel    = 'noopener noreferrer';
            link.textContent = name;
            link.style.color = '#1a0dab';
            entry.appendChild(link);

            if (data.ritual === 'true') {
                const tag = document.createElement('span');
                tag.textContent = ' (R)';
                tag.title = 'Ritual spell';
                tag.style.cssText = 'color:#666; font-style:italic;';
                entry.appendChild(tag);
            }
            list.appendChild(entry);
        }

        section.appendChild(list);
        body.appendChild(section);
    }
}

function openSpellListModal() {
    const modal = document.getElementById('spell-list-modal');
    if (!document.getElementById('spell-modal-body').hasChildNodes()) buildSpellModal();
    document.getElementById('spell-search').value = '';
    filterSpells();
    modal.style.display = 'block';
}

function openClassSpellListModal() {
    openSpellListModal();
    document.querySelectorAll('.spell-entry').forEach(entry => {
        const entryClasses = entry.dataset.classes.split(',');
        const matches = entryClasses.some(c => CHARACTER_CLASSES.includes(c));
        entry.style.display = matches ? '' : 'none';
    });
    document.querySelectorAll('.spell-modal-section').forEach(section => {
        const anyVisible = [...section.querySelectorAll('.spell-entry')].some(e => e.style.display !== 'none');
        section.style.display = anyVisible ? '' : 'none';
    });
}

function closeSpellListModal() {
    document.getElementById('spell-list-modal').style.display = 'none';
}

function filterSpells() {
    const query = document.getElementById('spell-search').value.toLowerCase();
    document.querySelectorAll('.spell-entry').forEach(entry => {
        entry.style.display = entry.dataset.name.includes(query) ? '' : 'none';
    });
    document.querySelectorAll('.spell-modal-section').forEach(section => {
        const anyVisible = [...section.querySelectorAll('.spell-entry')].some(e => e.style.display !== 'none');
        section.style.display = anyVisible ? '' : 'none';
    });
}

document.getElementById('spell-list-modal').addEventListener('click', function(e) {
    if (e.target === this) closeSpellListModal();
});


/* Item Search Modal */

async function openItemSearchModal() {
    if (!DB_ITEMS.length) {
        const res = await fetch('/api/items');
        DB_ITEMS = await res.json();
    }
    document.getElementById('item-search').value = '';
    renderItemSearchResults(DB_ITEMS.filter(i => i.type !== 'wp'));
    document.getElementById('item-search-modal').style.display = 'block';
}

function filterItemSearch() {
    const q = document.getElementById('item-search').value.toLowerCase();
    renderItemSearchResults(DB_ITEMS.filter(i => i.type !== 'wp' && (i.name ?? '').toLowerCase().includes(q)));
}

function filterItemSearch() {
    const q = document.getElementById('item-search').value.toLowerCase();
    renderItemSearchResults(DB_ITEMS.filter(item => (item.name ?? '').toLowerCase().includes(q)));
}

function renderItemSearchResults(items) {
    const body = document.getElementById('item-search-results');
    body.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 4px; border-bottom:1px solid #eee; font-size:13px;';

        const info = document.createElement('div');
        info.style.cssText = 'min-width:0; flex:1;';

        const nameEl = document.createElement('strong');
        nameEl.textContent = item.name ?? '?';
        const typeBadge = document.createElement('span');
        typeBadge.textContent = ` [${item.type ?? 'item'}]`;
        typeBadge.style.color = '#666';

        const desc = document.createElement('div');
        desc.style.cssText = 'color:#555; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
        desc.textContent = item.description ?? '';

        info.appendChild(nameEl);
        info.appendChild(typeBadge);
        info.appendChild(desc);

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.style.cssText = 'margin-left:8px; flex-shrink:0;';
        addBtn.onclick = () => addItemToCharacter(item, addBtn);

        row.appendChild(info);
        row.appendChild(addBtn);
        body.appendChild(row);
    });
}

async function addItemToCharacter(item, btn) {
    if (!CURRENT_CHAR_ID) return;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/inventory/items`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        if (res.ok) {
            btn.textContent = 'Added!';
            const charRes = await fetch(`/api/characters/${CURRENT_CHAR_ID}`);
            const char = await charRes.json();
            const inv = Array.isArray(char.inventory) ? char.inventory[0] : char.inventory;
            renderInventoryItems(inv?.items ?? []);
        } else {
            btn.textContent = 'Error';
            btn.disabled = false;
        }
    } catch {
        btn.textContent = 'Error';
        btn.disabled = false;
    }
}

document.getElementById('item-search-modal').addEventListener('click', function(e) {
    if (e.target === this) closeItemSearchModal();
});


/* Inventory Items Panel */

function renderInventoryItems(items) {
    const el = document.getElementById('inventory-items-list');
    el.innerHTML = '';
    if (!items.length) {
        el.innerHTML = '<div style="padding:8px; color:#888; font-size:13px;">— empty —</div>';
        return;
    }
    items.filter(i => i.type !== 'wp').forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:5px 4px; border-bottom:1px solid #ddd; font-size:13px;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';

        const name = document.createElement('strong');
        name.textContent = item.name ?? '?';
        header.appendChild(name);

        if (item.type) {
            const badge = document.createElement('span');
            badge.textContent = item.type;
            badge.style.cssText = 'font-size:11px; background:#e0e0e0; padding:1px 5px; border-radius:3px;';
            header.appendChild(badge);
        }
        if (item.equipped) {
            const b = document.createElement('span');
            b.textContent = 'equipped';
            b.style.cssText = 'font-size:11px; background:#c8e6c9; padding:1px 5px; border-radius:3px;';
            header.appendChild(b);
        }
        if (item.attuned) {
            const b = document.createElement('span');
            b.textContent = 'attuned';
            b.style.cssText = 'font-size:11px; background:#bbdefb; padding:1px 5px; border-radius:3px;';
            header.appendChild(b);
        }

        div.appendChild(header);

        if (item.description) {
            const desc = document.createElement('div');
            desc.style.cssText = 'color:#555; font-size:12px; margin-top:2px;';
            desc.textContent = item.description;
            div.appendChild(desc);
        }

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = 'color:#c00; border:none; background:none; cursor:pointer; font-size:15px; padding:0 2px; line-height:1; flex-shrink:0;';
        removeBtn.title = 'Remove item';
        removeBtn.onclick = async () => {
            if (!CURRENT_CHAR_ID) return;
            removeBtn.disabled = true;
            const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/inventory/items`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, name: item.name })
            });
            if (res.ok) {
                const char = await (await fetch(`/api/characters/${CURRENT_CHAR_ID}`)).json();
                const inv = Array.isArray(char.inventory) ? char.inventory[0] : char.inventory;
                renderInventoryItems(inv?.items ?? []);
            } else { removeBtn.disabled = false; }
        };
        // Make the item header a flex row so the × sits on the right
        header.style.cssText += '; justify-content:space-between;';
        header.appendChild(removeBtn);

        el.appendChild(div);
    });
}

/* Weapon Modal */

function renderWeapons(weapons) {
    const el = document.getElementById('weapons-list');
    el.innerHTML = '';
    if (!weapons.length) {
        el.innerHTML = '<span style="font-size:13px; color:#888; padding:4px 3px; display:block;">— none equipped —</span>';
        return;
    }
    weapons.forEach(w => {
        const div = document.createElement('div');
        div.style.cssText = 'border-bottom:1px solid #ddd; padding:4px 3px; font-size:13px; display:flex; align-items:baseline; gap:6px;';

        const name = document.createElement('strong');
        name.textContent = w.name ?? '?';

        const detail = document.createElement('span');
        detail.style.cssText = 'color:#555; flex:1;';
        detail.textContent = [w.damage, w.mode].filter(Boolean).join(' · ');

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = 'color:#c00; border:none; background:none; cursor:pointer; font-size:15px; padding:0 2px; line-height:1;';
        removeBtn.title = 'Remove weapon';
        removeBtn.onclick = async () => {
            if (!CURRENT_CHAR_ID) return;
            removeBtn.disabled = true;
            const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/equipped_weapons`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: w.item_id, name: w.name })
            });
            if (res.ok) {
                const char = await (await fetch(`/api/characters/${CURRENT_CHAR_ID}`)).json();
                renderWeapons(char.equipped_weapons ?? []);
            } else { removeBtn.disabled = false; }
        };

        div.appendChild(name);
        div.appendChild(detail);
        div.appendChild(removeBtn);
        el.appendChild(div);
    });
}

async function openWeaponModal() {
    if (!DB_ITEMS.length) {
        const res = await fetch('/api/items');
        DB_ITEMS = await res.json();
    }
    document.getElementById('weapon-search').value = '';
    renderWeaponSearchResults(DB_ITEMS.filter(i => i.type === 'wp'));
    document.getElementById('weapon-search-modal').style.display = 'block';
}

function closeWeaponModal() {
    document.getElementById('weapon-search-modal').style.display = 'none';
}

function filterWeaponSearch() {
    const q = document.getElementById('weapon-search').value.toLowerCase();
    renderWeaponSearchResults(DB_ITEMS.filter(i => i.type === 'wp' && (i.name ?? '').toLowerCase().includes(q)));
}

function renderWeaponSearchResults(items) {
    const body = document.getElementById('weapon-search-results');
    body.innerHTML = '';
    if (!items.length) {
        body.innerHTML = '<div style="padding:8px;color:#888;font-size:13px;">No weapons found.</div>';
        return;
    }
    items.forEach(item => {
        const oh = item.dice?.oneHand, th = item.dice?.twoHand;
        let dmgText = '';
        if (oh && th && (oh.num !== th.num || oh.sides !== th.sides)) dmgText = `${oh.num}d${oh.sides} / ${th.num}d${th.sides}`;
        else if (oh?.num > 0) dmgText = `${oh.num}d${oh.sides}`;
        else if (th)          dmgText = `${th.num}d${th.sides}`;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; padding:6px 4px; border-bottom:1px solid #eee; font-size:13px; gap:8px;';

        const info = document.createElement('div');
        info.style.cssText = 'flex:1; min-width:0;';
        info.innerHTML = `<strong>${item.name ?? '?'}</strong>
            <div style="color:#555;font-size:12px;">${[dmgText, item.primary_stat?.join('/'), item.martial ? 'Martial' : 'Simple'].filter(Boolean).join(' · ')}</div>`;

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.onclick = () => addWeaponToCharacter(item, addBtn);

        row.appendChild(info);
        row.appendChild(addBtn);
        body.appendChild(row);
    });
}

async function addWeaponToCharacter(item, btn) {
    if (!CURRENT_CHAR_ID) return;
    btn.disabled = true; btn.textContent = '...';
    const oh = item.dice?.oneHand, th = item.dice?.twoHand;
    let damage = '?';
    if (oh && th && (oh.num !== th.num || oh.sides !== th.sides)) damage = `${oh.num}d${oh.sides} / ${th.num}d${th.sides}`;
    else if (oh?.num > 0) damage = `${oh.num}d${oh.sides}`;
    else if (th)          damage = `${th.num}d${th.sides}`;
    const isRanged = (item.range ?? []).some((v, i) => i > 0 && v != null && v > 0);
    const entry = { item_id: String(item.id ?? ''), name: item.name ?? '?', damage, mode: isRanged ? 'ranged' : 'melee' };
    try {
        const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/equipped_weapons`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
        });
        if (res.ok) {
            btn.textContent = 'Added!';
            const char = await (await fetch(`/api/characters/${CURRENT_CHAR_ID}`)).json();
            renderWeapons(char.equipped_weapons ?? []);
        } else { btn.textContent = 'Error'; btn.disabled = false; }
    } catch { btn.textContent = 'Error'; btn.disabled = false; }
}

document.getElementById('weapon-search-modal').addEventListener('click', function(e) {
    if (e.target === this) closeWeaponModal();
});

/* Miscellaneous */

function editCharacter() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) window.location.href = `create_character.html?id=${id}`;
}

// Restore default value on blur for simple contenteditable fields
document.body.addEventListener('blur', (e) => {
    const el = e.target;
    if (el.isContentEditable && el.dataset.default && el.innerText.trim() === '') {
        el.innerText = el.dataset.default;
    }
}, true);

// Block Enter/Space in single-line contenteditable fields (not the notes area)
document.body.addEventListener('keydown', (e) => {
    if (e.target.isContentEditable && e.target.id !== 'inventory-notes'
        && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
    }
});

/* Death Save Bubbles */
document.querySelectorAll('#death-success-bubbles .bubble').forEach(b => {
    b.style.cursor = 'pointer';
    b.addEventListener('click', () => b.classList.toggle('filled'));
});

document.querySelectorAll('#death-failure-bubbles .bubble').forEach(b => {
    b.style.cursor = 'pointer';
    b.addEventListener('click', () => b.classList.toggle('fail'));
});


/* loadSheet */

async function loadSheet() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;
    CURRENT_CHAR_ID = id;

    const res = await fetch(`/api/characters/${id}`);
    const char = await res.json();

    // Helpers
    const getStat = name => char.stats?.find(s => s.stat === name)?.score ?? 10;
    const getMod  = score => Math.floor((score - 10) / 2);
    const fmtMod  = val => (val >= 0 ? '+' : '') + val;
    const profBonus = char.prof_bonus ?? 2;

    // Classes for spell filtering
    CHARACTER_CLASSES = (char.classes ?? []).flatMap(c => {
        const sub = char.subclasses?.find(sc => sc.source_id === c.source_id);
        return [c.name.toLowerCase(), sub?.name?.toLowerCase()].filter(Boolean);
    });

    // Basic info
    document.getElementById('char-name').textContent = char.name;
    document.getElementById('race-val').textContent  = char.race?.name ?? '—';

    const cls0 = char.classes?.[0];
    const sub0 = char.subclasses?.find(sc => sc.source_id === cls0?.source_id);
    document.getElementById('class-val').textContent    = cls0?.name ?? '—';
    document.getElementById('subclass-val').textContent = sub0?.name ?? '—';
    document.getElementById('level-val').textContent    = cls0?.level ?? 0;

    const cls1 = char.classes?.[1];
    if (cls1) {
        const sub1 = char.subclasses?.find(sc => sc.source_id === cls1.source_id);
        document.getElementById('class2-val').textContent    = cls1.name;
        document.getElementById('subclass2-val').textContent = sub1?.name ?? '—';
        document.getElementById('level2-val').textContent    = cls1.level ?? 0;
    }

    // Ability scores (stats use full names in the data, e.g. 'Strength' not 'STR')
    const STAT_NAMES = ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'];
    STAT_NAMES.forEach((stat, i) => {
        const score = getStat(stat);
        document.getElementById(`score-${i}`).textContent = score;
        document.getElementById(`mod-${i}`).textContent   = fmtMod(getMod(score));
    });

    // Proficiency bonus
    document.getElementById('prof-val').textContent = fmtMod(profBonus);

    // Saving throws + fill proficiency bubbles
    const saveProfs = new Set((char.classes ?? []).flatMap(c => c.saving_throws ?? []));
    STAT_NAMES.forEach((stat, i) => {
        const save = char.saves?.find(s => s.stat === stat);
        document.getElementById(`save-${i}`).textContent =
            save ? fmtMod(save.save) : fmtMod(getMod(getStat(stat)));

        const bubble = document.getElementById(`save-${i}`)?.closest('.skill-row')?.querySelector('.bubble');
        if (bubble && saveProfs.has(stat)) bubble.classList.add('filled');
    });

    // Skills
    const SKILL_STAT = {
        'acrobatics':'Dexterity',     'animal-handling':'Wisdom',    'arcana':'Intelligence',
        'athletics':'Strength',       'deception':'Charisma',        'history':'Intelligence',
        'insight':'Wisdom',           'intimidation':'Charisma',     'investigation':'Intelligence',
        'medicine':'Wisdom',          'nature':'Intelligence',       'perception':'Wisdom',
        'performance':'Charisma',     'persuasion':'Charisma',       'religion':'Intelligence',
        'sleight-of-hand':'Dexterity','stealth':'Dexterity',         'survival':'Wisdom',
    };
    const SKILL_DISPLAY = {
        'acrobatics':'Acrobatics',    'animal-handling':'Animal Handling', 'arcana':'Arcana',
        'athletics':'Athletics',      'deception':'Deception',        'history':'History',
        'insight':'Insight',          'intimidation':'Intimidation',  'investigation':'Investigation',
        'medicine':'Medicine',        'nature':'Nature',              'perception':'Perception',
        'performance':'Performance',  'persuasion':'Persuasion',      'religion':'Religion',
        'sleight-of-hand':'Sleight of Hand', 'stealth':'Stealth',    'survival':'Survival',
    };

    for (const [skillId, statName] of Object.entries(SKILL_STAT)) {
        const displayName = SKILL_DISPLAY[skillId];
        const statMod = getMod(getStat(statName));
        const prof = char.skill_proficiencies?.find(
            sp => sp.skill.toLowerCase() === displayName.toLowerCase()
        );
        const val = statMod + (prof ? (prof.expertise ? profBonus * 2 : profBonus) : 0);

        const el = document.getElementById(`skill-${skillId}`);
        if (el) el.textContent = fmtMod(val);

        const bubble = el?.closest('.skill-row')?.querySelector('.bubble');
        if (bubble && prof) {
            bubble.classList.add('filled');
            if (prof.expertise) bubble.classList.add('expertise');
        }
    }

    // Passive Perception
    const percText = document.getElementById('skill-perception')?.textContent ?? '+0';
    document.getElementById('passive-perc').textContent = 10 + (parseInt(percText) || 0);

    // HP
    document.getElementById('hp-max').textContent = getStat('MaxHP');
    const hpObj = Array.isArray(char.hitpoints) ? char.hitpoints[0] : char.hitpoints;
    document.getElementById('hp-current').textContent = hpObj?.current_hit_points ?? 0;
    document.getElementById('hp-temp').textContent    = hpObj?.temp_hp ?? 0;

    // AC / Speed / Initiative
    // Speed and Initiative are stored as stats (score = actual value, not raw ability score)
    document.getElementById('ac-val').textContent    = char.armor_class ?? 0;
    document.getElementById('speed-val').textContent = getStat('Speed');
    document.getElementById('init-val').textContent  = fmtMod(getStat('Initiative'));

    // Hit Dice
    const HIT_DICE = {
        Fighter:10, Wizard:6,   Warlock:8, Monk:8, Barbarian:12,
        Bard:8,     Cleric:8,   Druid:8,   Paladin:10, Ranger:10,
        Rogue:8,    Sorcerer:6,
    };
    if (cls0) document.getElementById('hit-dice-1').textContent =
        `${cls0.level ?? 1}d${HIT_DICE[cls0.name] ?? 8}`;
    if (cls1) document.getElementById('hit-dice-2').textContent =
        `${cls1.level ?? 1}d${HIT_DICE[cls1.name] ?? 8}`;

   // Features
    const featuresList = document.getElementById('features-list');
    featuresList.innerHTML = '';

    async function buildFeatureMetaMap(character) {
        const map = {};
        function indexTemplate(features) {
            if (!features) return;
            const walk = feat => {
                if (!feat?.feature_name) return;
                const key = feat.feature_name.toLowerCase();
                if (!map[key] || feat.uses || feat.save_dc) {
                    map[key] = {
                        subtype: Array.isArray(feat.subtype) ? feat.subtype
                                : feat.subtype ? [feat.subtype] : [],
                        uses:    feat.uses != null ? parseInt(feat.uses, 10) : null,
                        save_dc: feat.save_dc ?? null,
                    };
                }
            };
            if (Array.isArray(features)) {
                features.forEach(walk);
            } else {
                Object.values(features).forEach(v =>
                    Array.isArray(v) ? v.forEach(walk) : walk(v)
                );
            }
        }
        const fetches = [];
        for (const cls of (character.classes ?? [])) {
            fetches.push(
                fetch(`/static_json/classes/${cls.name.toLowerCase()}.json`)
                    .then(r => r.ok ? r.json() : null)
                    .then(t => t && indexTemplate(t.features))
                    .catch(() => {})
            );
        }
        for (const sc of (character.subclasses ?? [])) {
            const fname = `${sc.class.toLowerCase()}_${sc.name.toLowerCase().replace(/\s+/g, '_')}`;
            fetches.push(
                fetch(`/static_json/subclasses/${fname}.json`)
                    .then(r => r.ok ? r.json() : null)
                    .then(t => t && indexTemplate(t.features))
                    .catch(() => {})
            );
        }
        await Promise.all(fetches);
        return map;
    }

    function resolveSaveDC(formula) {
        if (!formula) return null;
        const lower = formula.toLowerCase();
        if (!lower.includes('prof')) return null;
        const base = parseInt(lower.match(/^(\d+)/)?.[1] ?? '8', 10);
        const STAT_MAP = {
            'strength':'Strength','dexterity':'Dexterity','constitution':'Constitution',
            'intelligence':'Intelligence','wisdom':'Wisdom','charisma':'Charisma'
        };
        const matched = Object.keys(STAT_MAP).filter(s => lower.includes(s));
        const modBonus = matched.length
            ? Math.max(...matched.map(s => getMod(getStat(STAT_MAP[s]))))
            : 0;
        return base + profBonus + modBonus;
    }

    const featureMeta = await buildFeatureMetaMap(char);

    // Group "Base: Choice" entries — collapse duplicates into one parent row
    const featureGroups = [];
    const groupIndex = new Map(); // baseName.lower → index in featureGroups

    for (const f of (char.features ?? [])) {
        if (f.name?.includes(': ')) {
            const base   = f.name.split(':')[0].trim();
            const choice = f.name.slice(base.length + 2).trim(); // text after ": "
            const key    = base.toLowerCase();
            if (groupIndex.has(key)) {
                featureGroups[groupIndex.get(key)].choices.push(choice);
            } else {
                groupIndex.set(key, featureGroups.length);
                featureGroups.push({ name: base, description: f.description, id: f.id, choices: [choice] });
            }
        } else {
            featureGroups.push({ name: f.name, description: f.description, id: f.id, choices: [] });
        }
    }

    featureGroups.forEach(f => {
        const meta       = featureMeta[f.name?.toLowerCase()] ?? {};
        const uses       = meta.uses    ?? null;
        const saveDc     = meta.save_dc ?? null;
        const isResource = meta.subtype?.includes('resource');

        const div = document.createElement('div');
        div.style.cssText = 'border-bottom:1px solid #ddd; padding:5px 3px;';

        const nameRow = document.createElement('div');
        nameRow.style.cssText = 'font-weight:bold; font-size:13px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = f.name ?? '(unnamed)';
        nameRow.appendChild(nameSpan);

        const hasBody = f.description || isResource || saveDc || f.choices.length;
        let arrow = null;
        if (hasBody) {
            arrow = document.createElement('span');
            arrow.textContent = '▶';
            arrow.style.cssText = 'font-size:9px; color:#888; display:inline-block; transition:transform 0.15s;';
            nameRow.appendChild(arrow);
        }
        div.appendChild(nameRow);

        if (hasBody) {
            const body = document.createElement('div');
            body.style.display = 'none';

            // Save DC
            if (saveDc) {
                const dc = resolveSaveDC(saveDc);
                const dcEl = document.createElement('div');
                dcEl.style.cssText = 'font-size:11px; font-weight:bold; color:#7b2d00; margin-top:3px;';
                dcEl.textContent = dc != null ? `Save DC: ${dc}` : `DC: ${saveDc}`;
                body.appendChild(dcEl);
            }

            // Resource uses tracker
            if (isResource && uses) {
                const storageKey = `feat_used_${CURRENT_CHAR_ID}_${f.id ?? f.name}`;
                let remaining = parseInt(localStorage.getItem(storageKey) ?? String(uses), 10);

                const tracker = document.createElement('div');
                tracker.style.cssText = 'display:flex; gap:5px; align-items:center; margin-top:4px;';

                const label = document.createElement('span');
                label.style.cssText = 'font-size:11px; color:#555;';
                label.textContent = 'Uses:';

                const minusBtn = document.createElement('button');
                minusBtn.textContent = '−';
                minusBtn.style.cssText = 'width:20px; height:20px; padding:0; font-size:13px; cursor:pointer; line-height:1;';

                const counter = document.createElement('span');
                counter.style.cssText = 'font-size:12px; min-width:30px; text-align:center;';
                counter.textContent = `${remaining} / ${uses}`;

                const plusBtn = document.createElement('button');
                plusBtn.textContent = '+';
                plusBtn.style.cssText = 'width:20px; height:20px; padding:0; font-size:13px; cursor:pointer; line-height:1;';

                const update = () => {
                    counter.textContent = `${remaining} / ${uses}`;
                    localStorage.setItem(storageKey, String(remaining));
                };

                minusBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    if (remaining > 0) { remaining--; update(); }
                });
                plusBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    if (remaining < uses) { remaining++; update(); }
                });

                tracker.appendChild(label);
                tracker.appendChild(minusBtn);
                tracker.appendChild(counter);
                tracker.appendChild(plusBtn);
                body.appendChild(tracker);
            }

            // Choices sub-list
            if (f.choices.length) {
                const choiceList = document.createElement('div');
                choiceList.style.cssText = 'font-size:12px; color:#333; margin-top:4px; padding-left:10px;';
                choiceList.innerHTML = f.choices.map(c => `<div style="padding:1px 0;">• ${c}</div>`).join('');
                body.appendChild(choiceList);
            }

            // Description
            if (f.description) {
                const desc = document.createElement('div');
                desc.style.cssText = 'font-size:12px; color:#555; margin-top:4px; white-space:pre-wrap;';
                desc.textContent = f.description;
                body.appendChild(desc);
            }

            nameRow.addEventListener('click', () => {
                const open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
            });

            div.appendChild(body);
        }

        featuresList.appendChild(div);
    });

    // Weapons
    renderWeapons(char.equipped_weapons ?? []);

    // Proficiencies
    const profList = document.getElementById('prof-list');
    const parts = [];
    (char.skill_proficiencies ?? []).forEach(sp => parts.push(sp.skill + (sp.expertise ? ' (E)' : '')));
    (char.tool_proficiencies  ?? []).forEach(tp => parts.push(tp.tool));
    (char.item_proficiencies  ?? []).forEach(ip => parts.push(ip.item));
    (char.languages ?? []).forEach(l => parts.push(`${l} (lang)`));
    profList.innerHTML = parts.length
        ? parts.map(p => `<span style="display:inline-block;font-size:12px;margin:2px;">${p}</span>`).join(', ')
        : '<span style="font-size:13px;color:#888;">—</span>';

    // Currency
    const inv = Array.isArray(char.inventory) ? char.inventory[0] : char.inventory;
    (inv?.currency ?? []).forEach(c => {
        const el = document.getElementById(`currency-${c.currencyName.toLowerCase()}`);
        if (el) el.textContent = c.amount;
    });

    // Inventory items panel
    renderInventoryItems(inv?.items ?? []);
}

loadSheet();