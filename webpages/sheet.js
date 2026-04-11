/* Spell List */

let SPELL_DATA = {};
let CHARACTER_CLASSES = [];
let DB_ITEMS = [];
let CURRENT_CHAR_ID = null;
let GRANTED_SPELLS = [];  // from class/subclass features — not removable
let CHOSEN_SPELLS  = [];  // user-added — removable

const LEVEL_KEYS = [
    'Cantrips', '1st Level', '2nd Level', '3rd Level', '4th Level',
    '5th Level', '6th Level', '7th Level', '8th Level', '9th Level'
];
const LEVEL_NAME_TO_NUM = {
    'Cantrips': 0, '1st Level': 1, '2nd Level': 2, '3rd Level': 3,
    '4th Level': 4, '5th Level': 5, '6th Level': 6, '7th Level': 7,
    '8th Level': 8, '9th Level': 9
};

const spellDataReady = fetch('/static_json/external_lists/spell_list.json')
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
        heading.style.cssText = 'border-bottom:1px solid #7B1A1A; color:#7B1A1A; padding-bottom:4px; margin:0 0 6px 0;';
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


/* Spell List Rendering */

function renderSpellLists() {
    for (let i = 0; i <= 9; i++) {
        const el = document.getElementById(`spell-list-${i}`);
        if (el) el.innerHTML = '';
    }
    for (const { name, level } of GRANTED_SPELLS) renderSpellEntry(level, name, false);
    for (const { name, level } of CHOSEN_SPELLS)  renderSpellEntry(level, name, true);
}

function renderSpellEntry(level, name, removable) {
    const el = document.getElementById(`spell-list-${level}`);
    if (!el) return;

    const levelKey  = LEVEL_KEYS[level];
    const spellData = levelKey ? SPELL_DATA[levelKey]?.[name] : null;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:2px 6px; border-bottom:1px solid #eee; font-size:13px;';

    const left = document.createElement('span');
    if (spellData?.link) {
        const a = document.createElement('a');
        a.href = spellData.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = name;
        a.style.color = '#1a0dab';
        left.appendChild(a);
    } else {
        left.textContent = name;
    }
    if (spellData?.ritual === 'true') {
        const tag = document.createElement('span');
        tag.textContent = ' (R)';
        tag.style.cssText = 'color:#666; font-style:italic; font-size:11px;';
        left.appendChild(tag);
    }
    row.appendChild(left);

    const right = document.createElement('span');
    right.style.cssText = 'flex-shrink:0; margin-left:6px;';
    if (!removable) {
        right.title = 'Granted by class or subclass';
        right.textContent = '★';
        right.style.cssText += '; color:#b8860b; font-size:12px;';
    } else {
        const btn = document.createElement('button');
        btn.textContent = '×';
        btn.title = 'Remove spell';
        btn.style.cssText = 'color:#c00; border:none; background:none; cursor:pointer; font-size:15px; padding:0 2px; line-height:1;';
        btn.onclick = () => removeChosenSpell(name, level);
        right.appendChild(btn);
    }
    row.appendChild(right);
    el.appendChild(row);
}

/* Choose Class Spell Modal */

async function openChooseSpellModal() {
    await spellDataReady;

    const body = document.getElementById('choose-spell-modal-body');
    body.innerHTML = '';

    const grantedNames = new Set(GRANTED_SPELLS.map(s => s.name));
    const chosenNames  = new Set(CHOSEN_SPELLS.map(s => s.name));

    for (const [levelKey, spells] of Object.entries(SPELL_DATA)) {
        const levelNum = LEVEL_NAME_TO_NUM[levelKey] ?? 0;

        const classSpells = Object.entries(spells)
            .filter(([, data]) => data.classes.some(c => CHARACTER_CLASSES.includes(c)))
            .sort(([a], [b]) => a.localeCompare(b));

        if (!classSpells.length) continue;

        const section = document.createElement('div');
        section.className = 'choose-spell-section';
        section.style.marginBottom = '16px';

        const heading = document.createElement('h3');
        heading.textContent = levelKey;
        heading.style.cssText = 'border-bottom:1px solid #7B1A1A; color:#7B1A1A; padding-bottom:4px; margin:0 0 6px 0;';
        section.appendChild(heading);

        const list = document.createElement('div');
        list.style.cssText = 'column-count:3; column-gap:16px;';

        let idx = 0;
        for (const [name, data] of classSpells) {
            const isGranted = grantedNames.has(name);
            const isChosen  = chosenNames.has(name);

            const entry = document.createElement('div');
            entry.className = 'choose-spell-row';
            entry.dataset.name = name.toLowerCase();
            entry.style.cssText = 'font-size:13px; padding:2px 4px; break-inside:avoid; display:flex; align-items:center; gap:4px; overflow:hidden;';

            const action = document.createElement('span');
            action.style.cssText = 'flex-shrink:0;';
            if (isGranted) {
                action.textContent = '★';
                action.title = 'Granted by class or subclass';
                action.style.cssText += '; color:#b8860b; font-size:11px;';
            } else if (isChosen) {
                const btn = document.createElement('button');
                btn.textContent = '−';
                btn.title = 'Remove spell';
                btn.style.cssText = 'font-size:11px; padding:0 4px; cursor:pointer; color:#c00;';
                btn.onclick = async () => { await removeChosenSpell(name, levelNum); openChooseSpellModal(); };
                action.appendChild(btn);
            } else {
                const btn = document.createElement('button');
                btn.textContent = '+';
                btn.title = 'Add spell';
                btn.style.cssText = 'font-size:11px; padding:0 4px; cursor:pointer;';
                btn.onclick = async () => { await addChosenSpell(name, levelNum); openChooseSpellModal(); };
                action.appendChild(btn);
            }
            entry.appendChild(action);

            const link = document.createElement('a');
            link.href = data.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = name;
            link.style.cssText = 'color:#1a0dab; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;';
            entry.appendChild(link);

            if (data.ritual === 'true') {
                const tag = document.createElement('span');
                tag.textContent = '(R)';
                tag.style.cssText = 'color:#666; font-style:italic; font-size:11px; flex-shrink:0;';
                entry.appendChild(tag);
            }

            entry.style.background = idx++ % 2 ? '#f5f5f5' : '';
            list.appendChild(entry);
        }

        section.appendChild(list);
        body.appendChild(section);
    }

    document.getElementById('choose-spell-search').value = '';
    filterChooseSpells();
    document.getElementById('choose-spell-modal').style.display = 'flex';
}

function closeChooseSpellModal() {
    document.getElementById('choose-spell-modal').style.display = 'none';
}

function filterChooseSpells() {
    const q = document.getElementById('choose-spell-search').value.toLowerCase();
    document.querySelectorAll('.choose-spell-row').forEach(row => {
        row.style.display = row.dataset.name.includes(q) ? '' : 'none';
    });
    document.querySelectorAll('.choose-spell-section').forEach(section => {
        const anyVisible = [...section.querySelectorAll('.choose-spell-row')].some(r => r.style.display !== 'none');
        section.style.display = anyVisible ? '' : 'none';
    });
}

document.getElementById('choose-spell-modal').addEventListener('click', function(e) {
    if (e.target === this) closeChooseSpellModal();
});

async function addChosenSpell(name, level) {
    if (!CURRENT_CHAR_ID) return;
    if (CHOSEN_SPELLS.some(s => s.name === name)) return;
    const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/chosen_spells`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, level })
    });
    if (res.ok) {
        CHOSEN_SPELLS.push({ name, level });
        renderSpellLists();
    }
}

async function removeChosenSpell(name, level) {
    if (!CURRENT_CHAR_ID) return;
    const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/chosen_spells`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, level })
    });
    if (res.ok) {
        CHOSEN_SPELLS = CHOSEN_SPELLS.filter(s => !(s.name === name && s.level === level));
        renderSpellLists();
    }
}

/* Item Search Modal */

async function openItemSearchModal() {
    if (!DB_ITEMS.length) {
        const res = await fetch('/api/items');
        DB_ITEMS = await res.json();
    }
    document.getElementById('item-search').value = '';
    renderItemSearchResults(DB_ITEMS.filter(i => i.type !== 'wp'));
    document.getElementById('item-search-modal').style.display = 'flex';
}

function closeItemSearchModal() {
    document.getElementById('item-search-modal').style.display = 'none';
}

function filterItemSearch() {
    const q = document.getElementById('item-search').value.toLowerCase();
    renderItemSearchResults(DB_ITEMS.filter(i => i.type !== 'wp' && (i.name ?? '').toLowerCase().includes(q)));
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
            body: JSON.stringify({ ...item, _uid: `${Date.now()}_${Math.random().toString(36).slice(2,7)}` })
        });
        if (res.ok) {
            btn.textContent = 'Added!';
            const charRes = await fetch(`/api/characters/${CURRENT_CHAR_ID}`);
            const char = await charRes.json();
            const inv = Array.isArray(char.inventory) ? char.inventory[0] : char.inventory;
            renderInventoryItems(inv?.items ?? [], char);
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

function renderInventoryItems(items, char = {}) {
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
        // Attune toggle for items that require attunement
        if (item.attuned) {
            const isAttuned = (char.attuned_items ?? []).some(a => a.item_id == item.id);

            const attuneBtn = document.createElement('button');
            attuneBtn.textContent = isAttuned ? 'Detune' : 'Attune';
            attuneBtn.style.cssText = `font-size:11px; padding:1px 6px; cursor:pointer;
                background:${isAttuned ? '#bbdefb' : '#e0e0e0'}; border:1px solid #aaa; border-radius:3px;`;

            attuneBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!CURRENT_CHAR_ID) return;
                attuneBtn.disabled = true;
                const action = isAttuned ? 'detune' : 'attune';
                try {
                    const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/inventory/items/attune`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ _uid: item._uid, action })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        alert(data.error ?? 'Could not attune item.');
                        attuneBtn.disabled = false;
                        return;
                    }
                    const charRes = await fetch(`/api/characters/${CURRENT_CHAR_ID}`);
                    const newChar = await charRes.json();
                    const newInv  = Array.isArray(newChar.inventory) ? newChar.inventory[0] : newChar.inventory;
                    renderInventoryItems(newInv?.items ?? [], newChar);
                    // Refresh stats in case attunement changed them (e.g. Amulet of Health sets CON)
                    const STAT_NAMES = ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'];
                    STAT_NAMES.forEach((stat, i) => {
                        const entry = newChar.stats?.find(s => s.stat === stat);
                        if (!entry) return;
                        document.getElementById(`score-${i}`).textContent = entry.score;
                        document.getElementById(`mod-${i}`).textContent   =
                            (entry.score >= 10 ? '+' : '') + Math.floor((entry.score - 10) / 2);
                    });
                    document.getElementById('ac-val').textContent = newChar.armor_class ?? '?';
                } catch {
                    alert('Network error while attuning item.');
                    attuneBtn.disabled = false;
                }
            };
            header.appendChild(attuneBtn);
        }

        // Equip toggle for armor
        if (item.type === 'armor') {
            // loose == because item.id may be number while equipped_armor stores it as-is
            const isEquipped = char.equipped_armor?.body == item.id ||
                               char.equipped_armor?.shield == item.id;

            const equipBtn = document.createElement('button');
            equipBtn.textContent = isEquipped ? 'Unequip' : 'Equip';
            equipBtn.style.cssText = `font-size:11px; padding:1px 6px; cursor:pointer;
                background:${isEquipped ? '#ffcdd2' : '#c8e6c9'}; border:1px solid #aaa; border-radius:3px;`;

            equipBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!CURRENT_CHAR_ID) return;
                equipBtn.disabled = true;
                const action = isEquipped ? 'unequip' : 'equip';
                try {
                    const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/inventory/items/equip`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ _uid: item._uid, action })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        alert(data.error ?? 'Could not equip item.');
                        equipBtn.disabled = false;
                        return;
                    }
                    const charRes = await fetch(`/api/characters/${CURRENT_CHAR_ID}`);
                    const newChar = await charRes.json();
                    const newInv  = Array.isArray(newChar.inventory) ? newChar.inventory[0] : newChar.inventory;
                    renderInventoryItems(newInv?.items ?? [], newChar);
                    document.getElementById('ac-val').textContent = newChar.armor_class ?? '?';
                } catch {
                    alert('Network error while equipping item.');
                    equipBtn.disabled = false;
                }
            };
            header.appendChild(equipBtn);
        }

        div.appendChild(header);

        if (item.quantity != null) {
            const qtyRow = document.createElement('div');
            qtyRow.style.cssText = 'display:flex; gap:4px; align-items:center; margin-top:3px;';

            const qLabel = document.createElement('span');
            qLabel.style.cssText = 'font-size:11px; color:#555;';
            qLabel.textContent = 'Qty:';

            let qty = item.quantity;

            const minusBtn = document.createElement('button');
            minusBtn.textContent = '−';
            minusBtn.style.cssText = 'width:20px; height:20px; padding:0; font-size:12px; cursor:pointer; line-height:1;';

            const qDisplay = document.createElement('span');
            qDisplay.style.cssText = 'font-size:12px; min-width:20px; text-align:center;';
            qDisplay.textContent = qty;

            const plusBtn = document.createElement('button');
            plusBtn.textContent = '+';
            plusBtn.style.cssText = 'width:20px; height:20px; padding:0; font-size:12px; cursor:pointer; line-height:1;';

            const saveQty = async (newQty) => {
                if (newQty < 0) return;
                qty = newQty;
                qDisplay.textContent = qty;
                if (!CURRENT_CHAR_ID) return;
                await fetch(`/api/characters/${CURRENT_CHAR_ID}/inventory/items/quantity`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ _uid: item._uid, name: item.name, type: item.type, quantity: qty })
                });
            };

            minusBtn.addEventListener('click', e => { e.stopPropagation(); saveQty(qty - 1); });
            plusBtn.addEventListener('click', e => { e.stopPropagation(); saveQty(qty + 1); });

            qtyRow.appendChild(qLabel);
            qtyRow.appendChild(minusBtn);
            qtyRow.appendChild(qDisplay);
            qtyRow.appendChild(plusBtn);
            div.appendChild(qtyRow);
        }

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
                body: JSON.stringify({ _uid: item._uid, name: item.name, type: item.type })
            });
            if (res.ok) {
                const char = await (await fetch(`/api/characters/${CURRENT_CHAR_ID}`)).json();
                const inv = Array.isArray(char.inventory) ? char.inventory[0] : char.inventory;
                renderInventoryItems(inv?.items ?? [], char);
            } else { removeBtn.disabled = false; }
        };
        // Make the item header a flex row so the × sits on the right
        header.style.cssText += '; justify-content:space-between;';
        header.appendChild(removeBtn);

        el.appendChild(div);
    });
}

/* Weapon Modal */

function renderWeapons(weapons, char = null) {
    const el = document.getElementById('weapons-list');
    el.innerHTML = '';
    if (!weapons.length) {
        el.innerHTML = '<span style="font-size:13px; color:#888; padding:4px 3px; display:block;">— none equipped —</span>';
        return;
    }

    const fmtMod = v => (v >= 0 ? '+' : '') + v;
    const getMod  = score => Math.floor((score - 10) / 2);
    const getStat = name => char?.stats?.find(s => s.stat === name)?.score ?? 10;
    const profBonus = char?.prof_bonus ?? 2;

    weapons.forEach(w => {
        const features = (w.features ?? []).filter(f => f.name);

        // Compute total attack and damage bonuses
        let atkTotal = null, dmgTotal = null;
        if (w.primary_stat?.length) {
            const stats = Array.isArray(w.primary_stat) ? w.primary_stat : [w.primary_stat];
            const bestMod = Math.max(...stats.map(s => getMod(getStat(s))));
            atkTotal = (w.attack_bonus ?? 0) + bestMod + profBonus;
            dmgTotal = (w.damage_bonus ?? 0) + bestMod;
        }

        const div = document.createElement('div');
        div.style.cssText = 'border-bottom:1px solid #ddd; padding:4px 3px; font-size:13px;';

        const nameRow = document.createElement('div');
        nameRow.style.cssText = 'display:flex; align-items:center; gap:6px;';

        const nameEl = document.createElement('strong');
        nameEl.textContent = w.name ?? '?';

        const detail = document.createElement('span');
        detail.style.cssText = 'color:#555; flex:1; font-size:12px;';
        const parts = [w.damage, w.mode];
        if (atkTotal !== null) parts.push(`Atk ${fmtMod(atkTotal)}`);
        if (dmgTotal !== null) parts.push(`Dmg ${fmtMod(dmgTotal)}`);
        detail.textContent = parts.filter(Boolean).join(' · ');

        nameRow.appendChild(nameEl);
        nameRow.appendChild(detail);

        let body = null;
        if (features.length) {
            const arrow = document.createElement('span');
            arrow.textContent = '▶';
            arrow.style.cssText = 'font-size:9px; color:#888; display:inline-block; transition:transform 0.15s;';
            nameRow.appendChild(arrow);

            body = document.createElement('div');
            body.style.cssText = 'display:none; padding:2px 0 2px 8px;';
            features.forEach(f => {
                const fDiv = document.createElement('div');
                fDiv.style.cssText = 'font-size:12px; padding:1px 0;';
                const fName = document.createElement('strong');
                fName.textContent = f.name;
                fDiv.appendChild(fName);
                if (f.description) {
                    const fDesc = document.createElement('div');
                    fDesc.style.cssText = 'color:#555; font-size:11px; white-space:pre-wrap; margin-top:1px;';
                    fDesc.textContent = f.description;
                    fDiv.appendChild(fDesc);
                }
                body.appendChild(fDiv);
            });

            nameRow.style.cursor = 'pointer';
            nameRow.addEventListener('click', e => {
                if (removeBtn.contains(e.target)) return;
                const open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                arrow.style.transform = open ? '' : 'rotate(90deg)';
            });
        }

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
                body: JSON.stringify({ _uid: w._uid, item_id: w.item_id, name: w.name })
            });
            if (res.ok) {
                const updated = await (await fetch(`/api/characters/${CURRENT_CHAR_ID}`)).json();
                renderWeapons(updated.equipped_weapons ?? [], updated);
            } else { removeBtn.disabled = false; }
        };
        nameRow.appendChild(removeBtn);

        div.appendChild(nameRow);
        if (body) div.appendChild(body);
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
    document.getElementById('weapon-search-modal').style.display = 'flex';
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
    const entry = {
        item_id: String(item.id ?? ''),
        name: item.name ?? '?',
        damage,
        mode: isRanged ? 'ranged' : 'melee',
        attack_bonus: item.attack_bonus ?? 0,
        damage_bonus: item.damage_bonus ?? 0,
        primary_stat: item.primary_stat ?? [],
        _uid: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        features: (item.features_on_equip ?? [])
            .filter(f => f.name)
            .map(f => ({ name: f.name, description: f.description ?? null }))
    };
    try {
        const res = await fetch(`/api/characters/${CURRENT_CHAR_ID}/equipped_weapons`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
        });
        if (res.ok) {
            btn.textContent = 'Added!';
            const char = await (await fetch(`/api/characters/${CURRENT_CHAR_ID}`)).json();
            renderWeapons(char.equipped_weapons ?? [], char);
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

    const hpCurrentEl = document.getElementById('hp-current');
    const hpTempEl    = document.getElementById('hp-temp');
    hpCurrentEl.textContent = hpObj?.current_hit_points ?? 0;
    hpTempEl.textContent    = hpObj?.temp_hp ?? 0;

    const saveHP = () => {
        const current_hit_points = parseInt(hpCurrentEl.textContent.trim()) || 0;
        const temp_hp            = parseInt(hpTempEl.textContent.trim())    || 0;
        fetch(`/api/characters/${CURRENT_CHAR_ID}/hitpoints`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ current_hit_points, temp_hp })
        });
    };
    hpCurrentEl.addEventListener('blur', saveHP);
    hpTempEl.addEventListener('blur', saveHP);

    const inspirationEl = document.getElementById('inspiration-val');
    inspirationEl.textContent = char.inspiration ?? 0;
    inspirationEl.addEventListener('blur', () => {
        const inspiration = parseInt(inspirationEl.textContent.trim()) || 0;
        fetch(`/api/characters/${CURRENT_CHAR_ID}/inspiration`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ inspiration })
        });
    });

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

    if (cls0) {
        const die      = HIT_DICE[cls0.name] ?? 8;
        const maxLevel = (cls0.level ?? 1) + (cls1?.level ?? 0);
        const current  = char.hit_dice_current ?? maxLevel;

        const currentEl = document.getElementById('hit-dice-1');
        const maxEl     = document.getElementById('hit-dice-2');

        currentEl.textContent = current;
        maxEl.textContent     = `${maxLevel}d${die}`;

        currentEl.addEventListener('blur', () => {
            const val = parseInt(currentEl.textContent.trim()) || 0;
            fetch(`/api/characters/${CURRENT_CHAR_ID}/hit_dice`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ current: val })
            });
        });
    }

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
            const key = f.name?.toLowerCase() ?? '';
            if (groupIndex.has(key)) {
                // Merge: fill in description if the grouped entry is missing one
                const existing = featureGroups[groupIndex.get(key)];
                if (!existing.description && f.description) existing.description = f.description;
            } else {
                groupIndex.set(key, featureGroups.length);
                featureGroups.push({ name: f.name, description: f.description, id: f.id, choices: [] });
            }
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
                const featureUseRecord = (char.feature_uses ?? [])
                    .find(u => u.feature_id === (f.id ?? f.name));
                let remaining;
                if (featureUseRecord !== undefined) {
                    remaining = featureUseRecord.remaining;
                    localStorage.setItem(storageKey, String(remaining));
                } else {
                    remaining = parseInt(localStorage.getItem(storageKey) ?? String(uses), 10);
                }

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
                    if (CURRENT_CHAR_ID) {
                        fetch(`/api/characters/${CURRENT_CHAR_ID}/feature_uses`, {
                            method:  'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body:    JSON.stringify({ feature_id: f.id ?? f.name, remaining })
                        }).catch(() => {});
                    }
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

    // Spell stats
    const primaryCaster = char.classes?.find(c => c.caster && c.casterStat);
    if (primaryCaster) {
        const stat  = primaryCaster.casterStat;
        const mod   = getMod(getStat(stat));
        const abbr  = { Strength:'STR', Dexterity:'DEX', Constitution:'CON',
                        Intelligence:'INT', Wisdom:'WIS', Charisma:'CHA' }[stat] ?? stat;
        document.getElementById('spell-ability').textContent = abbr;
        document.getElementById('spell-dc').textContent      = 8 + profBonus + mod;
        document.getElementById('spell-atk').textContent     = fmtMod(profBonus + mod);
    }

    // Weapons
    const invObj = Array.isArray(char.inventory) ? char.inventory[0] : char.inventory;
    const invWeapons = (invObj?.items ?? [])
        .filter(i => i.type === 'wp')
        .map(i => {
            const oh = i.dice?.oneHand, th = i.dice?.twoHand;
            let damage = '?';
            if (oh && th && (oh.num !== th.num || oh.sides !== th.sides)) damage = `${oh.num}d${oh.sides} / ${th.num}d${th.sides}`;
            else if (oh?.num > 0) damage = `${oh.num}d${oh.sides}`;
            else if (th)          damage = `${th.num}d${th.sides}`;
            const isRanged = (i.range ?? []).some((v, idx) => idx > 0 && v != null && v > 0);
            return {
                name: i.name ?? '?',
                damage,
                mode: isRanged ? 'ranged' : 'melee',
                attack_bonus:  i.attack_bonus  ?? 0,
                damage_bonus:  i.damage_bonus  ?? 0,
                primary_stat:  i.primary_stat  ?? [],
                features: (i.features_on_equip ?? [])
                    .filter(f => f.name)
                    .map(f => ({ name: f.name, description: f.description ?? null }))
            };
        });
    renderWeapons([...(char.equipped_weapons ?? []), ...invWeapons], char);

    // Spell stats + slots
    if (primaryCaster) {
        const stat = primaryCaster.casterStat;
        const mod  = getMod(getStat(stat));
        const abbr = { Strength:'STR', Dexterity:'DEX', Constitution:'CON',
                       Intelligence:'INT', Wisdom:'WIS', Charisma:'CHA' }[stat] ?? stat;
        document.getElementById('spell-ability').textContent = abbr;
        document.getElementById('spell-dc').textContent      = 8 + profBonus + mod;
        document.getElementById('spell-atk').textContent     = fmtMod(profBonus + mod);
    }

    for (let i = 1; i <= 9; i++) {
        const amtEl  = document.getElementById(`slot-amt-${i}`);
        const usedEl = document.getElementById(`slot-used-${i}`);
        if (amtEl)  amtEl.textContent = '0';
        if (usedEl) { usedEl.removeAttribute('contenteditable'); usedEl.innerHTML = ''; }
    }

    const slotMap = new Map();
    for (const s of (char.spell_slots ?? [])) {
        slotMap.set(s.level, { max: s.max, current: s.current, api: 'spell_slots' });
    }
    for (const s of (char.pact_slots ?? [])) {
        if (slotMap.has(s.level)) {
            const ex = slotMap.get(s.level);
            slotMap.set(s.level, { max: ex.max + s.max, current: ex.current + s.current, api: 'both' });
        } else {
            slotMap.set(s.level, { max: s.max, current: s.current, api: 'pact_slots' });
        }
    }

    for (const [level, slot] of slotMap) {
        const amtEl  = document.getElementById(`slot-amt-${level}`);
        const usedEl = document.getElementById(`slot-used-${level}`);
        if (!amtEl || !usedEl) continue;

        amtEl.textContent = String(slot.max);
        usedEl.removeAttribute('contenteditable');
        usedEl.innerHTML = '';
        usedEl.style.cssText = 'display:flex; align-items:center; gap:3px; justify-content:center;';

        const minus = document.createElement('button');
        minus.textContent = '−';
        minus.style.cssText = 'width:18px; height:18px; padding:0; font-size:12px; cursor:pointer; line-height:1;';

        let cur = slot.current;
        const counter = document.createElement('span');
        counter.style.cssText = 'font-size:12px; min-width:24px; text-align:center;';
        counter.textContent = String(cur);

        const plus = document.createElement('button');
        plus.textContent = '+';
        plus.style.cssText = 'width:18px; height:18px; padding:0; font-size:12px; cursor:pointer; line-height:1;';

        const save = async (val) => {
            if (val < 0 || val > slot.max || !CURRENT_CHAR_ID) return;
            cur = val;
            counter.textContent = String(cur);
            if (slot.api === 'both') return;
            await fetch(`/api/characters/${CURRENT_CHAR_ID}/${slot.api}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, current: cur }),
            });
        };

        minus.addEventListener('click', () => save(cur - 1));
        plus.addEventListener('click',  () => save(cur + 1));

        usedEl.appendChild(minus);
        usedEl.appendChild(counter);
        usedEl.appendChild(plus);
    }

    // Granted spells — from class/subclass spell_list_addition features
    GRANTED_SPELLS = [];
    const spellTemplateFetches = [];

    for (const cls of (char.classes ?? [])) {
        if (!cls.caster) continue;
        spellTemplateFetches.push(
            fetch(`/static_json/classes/${cls.name.toLowerCase()}.json`)
                .then(r => r.ok ? r.json() : null)
                .then(t => {
                    if (!t) return;
                    const clsLevel = cls.level ?? 1;
                    for (let lvl = 1; lvl <= clsLevel; lvl++) {
                        const raw = t.features?.[String(lvl)];
                        if (!raw) continue;
                        const feats = Array.isArray(raw) ? raw : [raw];
                        for (const feat of feats) {
                            const subs = Array.isArray(feat.subtype) ? feat.subtype : (feat.subtype ? [feat.subtype] : []);
                            if (!subs.includes('spell_list_addition') || !feat.spells_to_add) continue;
                            for (const entry of feat.spells_to_add) {
                                for (const [levelKey, names] of Object.entries(entry)) {
                                    const spellLevel = LEVEL_NAME_TO_NUM[levelKey] ?? 0;
                                    for (const name of [].concat(names)) {
                                        if (!GRANTED_SPELLS.some(s => s.name === name))
                                            GRANTED_SPELLS.push({ name, level: spellLevel });
                                    }
                                }
                            }
                        }
                    }
                }).catch(() => {})
        );
    }

    for (const sc of (char.subclasses ?? [])) {
        const fname    = `${sc.class.toLowerCase()}_${sc.name.toLowerCase().replace(/\s+/g, '_')}`;
        const clsLevel = char.classes?.find(c => c.name.toLowerCase() === sc.class.toLowerCase())?.level ?? 1;
        spellTemplateFetches.push(
            fetch(`/static_json/subclasses/${fname}.json`)
                .then(r => r.ok ? r.json() : null)
                .then(t => {
                    if (!t) return;
                    for (let lvl = 1; lvl <= clsLevel; lvl++) {
                        const raw = t.features?.[String(lvl)];
                        if (!raw) continue;
                        const feats = Array.isArray(raw) ? raw : [raw];
                        for (const feat of feats) {
                            const subs = Array.isArray(feat.subtype) ? feat.subtype : (feat.subtype ? [feat.subtype] : []);
                            if (!subs.includes('spell_list_addition') || !feat.spells_to_add) continue;
                            for (const entry of feat.spells_to_add) {
                                for (const [levelKey, names] of Object.entries(entry)) {
                                    const spellLevel = LEVEL_NAME_TO_NUM[levelKey] ?? 0;
                                    for (const name of [].concat(names)) {
                                        if (!GRANTED_SPELLS.some(s => s.name === name))
                                            GRANTED_SPELLS.push({ name, level: spellLevel });
                                    }
                                }
                            }
                        }
                    }
                }).catch(() => {})
        );
    }

    await Promise.all(spellTemplateFetches);
    await spellDataReady;

    // Chosen spells saved by the user
    CHOSEN_SPELLS = char.chosen_spells ?? [];

    renderSpellLists();

    // Show "Choose Class Spells" button only for caster characters
    const chooseSpellBtn = document.getElementById('open-choose-spell-btn');
    if (chooseSpellBtn) chooseSpellBtn.style.display = (char.classes ?? []).some(c => c.caster) ? '' : 'none';


    // Proficiencies
    const profList = document.getElementById('prof-list');
    profList.innerHTML = '';

    const classWeaponProfs = new Set();
    const classArmorProfs  = new Set();
    await Promise.all((char.classes ?? []).map(cls =>
        fetch(`/static_json/classes/${cls.name.toLowerCase()}.json`)
            .then(r => r.ok ? r.json() : null)
            .then(t => {
                if (!t) return;
                (t.weapons ?? []).forEach(w => classWeaponProfs.add(w));
                (t.armor   ?? []).forEach(a => classArmorProfs.add(a));
            })
            .catch(() => {})
    ));

    const profCategories = [
        { label: 'Languages', items: char.languages ?? [] },
        { label: 'Skills',    items: (char.skill_proficiencies ?? []).map(sp => sp.skill + (sp.expertise ? ' ✦' : '')) },
        { label: 'Tools',     items: (char.tool_proficiencies  ?? []).map(tp => tp.tool) },
        { label: 'Weapons',   items: [...classWeaponProfs] },
        { label: 'Armor',     items: [...classArmorProfs] },
        { label: 'Other',     items: (char.item_proficiencies  ?? []).map(ip => ip.item) },
    ];

    profCategories.forEach(cat => {
        if (!cat.items.length) return;
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom:5px;';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:10px; font-weight:bold; color:#777; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;';
        lbl.textContent = cat.label;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex; flex-wrap:wrap; gap:3px;';
        cat.items.forEach(item => {
            const tag = document.createElement('span');
            tag.style.cssText = 'font-size:11px; background:#f0f0f0; padding:1px 6px; border-radius:3px; border:1px solid #ddd;';
            tag.textContent = item;
            wrap.appendChild(tag);
        });
        section.appendChild(lbl);
        section.appendChild(wrap);
        profList.appendChild(section);
    });
    if (!profList.children.length) {
        profList.innerHTML = '<span style="font-size:13px;color:#888;">—</span>';
    }

    // Currency
    const inv = Array.isArray(char.inventory) ? char.inventory[0] : char.inventory;
    (inv?.currency ?? []).forEach(c => {
        const el = document.getElementById(`currency-${c.currencyName.toLowerCase()}`);
        if (el) el.textContent = c.amount;
    });

    // Inventory items panel
    renderInventoryItems(inv?.items ?? [], char);

    const notesEl = document.getElementById('inventory-notes');
    notesEl.textContent = char.notes ?? '';
    notesEl.addEventListener('blur', () => {
        fetch(`/api/characters/${CURRENT_CHAR_ID}/notes`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ notes: notesEl.innerText })
        });
    });
}

loadSheet();