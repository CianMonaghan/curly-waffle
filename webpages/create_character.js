const CLASS_DATA      = {};
const SUBCLASS_DATA   = {};
const BACKGROUND_DATA = {};
const RACE_DATA       = {};
const EXTERNAL_LISTS  = {};
 
/* Data Loading  */
 
async function loadCollection(apiPath, store, keyFn) {
    const res   = await fetch(apiPath);
    const files = await res.json();
    await Promise.all(files.map(async fileName => {
        const fileRes = await fetch(`/static_json/${apiPath.replace('/api/', '')}/${fileName}.json`);
        const data    = await fileRes.json();
        const key     = keyFn(data);
        store[key]    = data;
    }));
}
 
async function loadAllSubclasses() {
    const res   = await fetch('/api/subclasses');
    const files = await res.json();
    await Promise.all(files.map(async fileName => {
        const fileRes = await fetch(`/static_json/subclasses/${fileName}.json`);
        const data    = await fileRes.json();
        const classKey = data.class.charAt(0).toUpperCase() + data.class.slice(1);
        if (!SUBCLASS_DATA[classKey]) SUBCLASS_DATA[classKey] = [];
        SUBCLASS_DATA[classKey].push(data);
    }));
}
 
async function loadAllExternalLists() {
    const res   = await fetch('/api/external_lists');
    const files = await res.json();
    await Promise.all(files.map(async fileName => {
        const fileRes = await fetch(`/static_json/external_lists/${fileName}.json`);
        const data    = await fileRes.json();
 
        // Spell lists have a `spells` property instead of `options`
        if (data && data.spells) {
            EXTERNAL_LISTS[data.name] = data;
            return;
        }
 
        if (Array.isArray(data)) {
            data.forEach(entry => { EXTERNAL_LISTS[entry.name] = entry.options; });
        } else {
            EXTERNAL_LISTS[data.name] = data.options;
        }
    }));
}
 
 
/* Race and Background Functions  */
 
let currentPopupField = null;
 
const overlay     = document.getElementById('popup-overlay');
const popupTitle  = document.getElementById('popup-title');
const popupList   = document.getElementById('popup-list');
const popupDetail = document.getElementById('popup-detail');
const popupClose  = document.getElementById('popup-close');
const confirmBtn  = document.getElementById('popup-confirm');
 
const grantedProficiencies = {
    race:       { fixed: new Set(), chosen: new Set() },
    background: { fixed: new Set(), chosen: new Set() }
};
 
let pendingSelection = null;
 
function wireSelects(container, itemId, type) {
    const selectClass = `${type}-select`;
    const fixedClass  = `${type}-fixed`;
    const selects = [...container.querySelectorAll(`.${selectClass}[data-item-id="${itemId}"]`)];
 
    function sync() {
        const fixedValues = new Set(
            [...container.querySelectorAll(`.${fixedClass}`)].map(el => el.textContent.trim())
        );
        const chosen = new Set([
            ...fixedValues,
            ...selects.map(s => s.value).filter(v => v !== '— choose —')
        ]);
 
        selects.forEach(sel => {
            [...sel.options].forEach(opt => {
                if (opt.value === '— choose —') return;
                opt.disabled = chosen.has(opt.value) && sel.value !== opt.value;
            });
        });
    }
 
    selects.forEach(sel => sel.addEventListener('change', sync));
    return sync;
}
 
function rebuildGrantedProficiencies() {
    grantedProficiencies.race.fixed.clear();
    grantedProficiencies.race.chosen.clear();
    grantedProficiencies.background.fixed.clear();
    grantedProficiencies.background.chosen.clear();
 
    const raceId   = document.getElementById('race').value;
    const raceData = Object.values(RACE_DATA).find(r => r.id == raceId);
    if (raceData) collectGrantedFromItem(raceData, 'race');
 
    const bgId   = document.getElementById('background').value;
    const bgData = Object.values(BACKGROUND_DATA).find(b => b.id == bgId);
    if (bgData) collectGrantedFromItem(bgData, 'background');
 
    const raceContent = document.querySelector('#race-info-panel .info-panel-content');
    const bgContent   = document.querySelector('#background-info-panel .info-panel-content');
 
    if (raceContent) {
        raceContent.querySelectorAll('input:checked').forEach(cb => {
            if (cb.value) grantedProficiencies.race.chosen.add(cb.value);
        });
        raceContent.querySelectorAll('select').forEach(sel => {
            if (sel.value && sel.value !== '— choose —') grantedProficiencies.race.chosen.add(sel.value);
        });
    }
    if (bgContent) {
        bgContent.querySelectorAll('input:checked').forEach(cb => {
            if (cb.value) grantedProficiencies.background.chosen.add(cb.value);
        });
        bgContent.querySelectorAll('select').forEach(sel => {
            if (sel.value && sel.value !== '— choose —') grantedProficiencies.background.chosen.add(sel.value);
        });
    }
}
 
function collectGrantedFromItem(item, source) {
    const target = grantedProficiencies[source].fixed;
    (item.features || []).forEach(f => {
        (f.prof_to_add || []).forEach(entry => {
            Object.values(entry).forEach(val => {
                if (Array.isArray(val)) val.forEach(v => target.add(v));
                else target.add(val);
            });
        });
    });
}
 
function enforceGrantedProficiencies(container, ownSource) {
    const otherChosen = new Set();
    const allFixed    = new Set();
 
    Object.entries(grantedProficiencies).forEach(([source, { fixed, chosen }]) => {
        fixed.forEach(v => allFixed.add(v));
        if (source !== ownSource) chosen.forEach(v => otherChosen.add(v));
    });
 
    const blocked = new Set([...allFixed, ...otherChosen]);
 
    container.querySelectorAll('.external-choice-list input').forEach(cb => {
        if (blocked.has(cb.value)) {
            cb.checked  = false;
            cb.disabled = true;
            cb.closest('label')?.classList.add('proficiency-granted');
        } else {
            cb.disabled = false;
            cb.closest('label')?.classList.remove('proficiency-granted');
        }
    });
 
    container.querySelectorAll('.lang-select, .tool-select').forEach(sel => {
        [...sel.options].forEach(opt => {
            if (opt.value === '— choose —') return;
            if (blocked.has(opt.value)) opt.disabled = true;
        });
        if (blocked.has(sel.value)) sel.value = '— choose —';
    });
}
 
function filterSpellList(spellList, options) {
    const [levelKey, classFilter] = options;
    const spellsAtLevel = spellList.spells[levelKey];
 
    if (!spellsAtLevel) return [];
 
    return Object.entries(spellsAtLevel)
        .filter(([name, spell]) => spell.classes.includes(classFilter))
        .map(([name, spell]) => ({ name, ...spell }));
}
 
function buildLangProfHTML(langProf, itemId) {
    if (!langProf || langProf.length === 0) return '<span>—</span>';
 
    return langProf.map((entry, i) => {
        if (entry.type === 'fixed') {
            return `<span class="lang-fixed">${entry.value}</span>`;
        }
 
        const langData = EXTERNAL_LISTS['languages'] ?? [];
        const standard = EXTERNAL_LISTS['standard_languages']
            ?? langData.find(g => g.name === 'standard_languages')?.options ?? [];
        const exotic   = EXTERNAL_LISTS['exotic_languages']
            ?? langData.find(g => g.name === 'exotic_languages')?.options ?? [];
        const options  = entry.type === 'standard' ? standard
                       : entry.type === 'exotic'   ? exotic
                       : [...standard, ...exotic];
 
        const optionHTML = ['— choose —', ...options]
            .map(l => `<option value="${l}">${l}</option>`)
            .join('');
 
        return `<select id="lang_${itemId}_${i}" class="lang-select" data-item-id="${itemId}" data-index="${i}">
                    ${optionHTML}
                </select>`;
    }).join(' ');
}
 
function buildToolProfHTML(toolProf, itemId) {
    if (!toolProf || toolProf.length === 0) return '<span>—</span>';
 
    return toolProf.map((entry, i) => {
        if (entry.type === 'fixed') {
            return `<span class="tool-fixed">${entry.value}</span>`;
        }
 
        const options    = EXTERNAL_LISTS[entry.type] ?? [];
        const optionHTML = ['— choose —', ...options]
            .map(t => `<option value="${t}">${t}</option>`)
            .join('');
 
        return `<select id="tool_${itemId}_${i}" class="tool-select" data-item-id="${itemId}" data-index="${i}">
                    ${optionHTML}
                </select>`;
    }).join(' ');
}
 
/* Weapons */
 
function collectWeaponsUnderKey(node, filterKey) {
    const results = new Set();
    function recurse(n) {
        if (Array.isArray(n)) { n.forEach(recurse); return; }
        if (typeof n !== 'object' || n === null) return;
        if (n.name === filterKey) { collectAllLeaves(n, results); return; }
        if (Array.isArray(n.options)) {
            n.options.forEach(child => { if (typeof child !== 'string') recurse(child); });
        }
    }
    recurse(node);
    return results;
}
 
function collectAllLeaves(node, results = new Set()) {
    if (typeof node === 'string')            { results.add(node); return results; }
    if (Array.isArray(node))                 { node.forEach(c => collectAllLeaves(c, results)); return results; }
    if (typeof node === 'object' && node !== null && Array.isArray(node.options)) {
        node.options.forEach(c => collectAllLeaves(c, results));
    }
    return results;
}
 
function resolveWeaponOptions(options) {
    const weaponsData = EXTERNAL_LISTS['weapons'] ?? [];
    if (options === 'any') {
        const all = new Set();
        collectAllLeaves(weaponsData, all);
        return [...all].sort();
    }
    if (typeof options === 'string') return null;
    if (Array.isArray(options)) {
        const sets = options.map(key => collectWeaponsUnderKey(weaponsData, key));
        const [first, ...rest] = sets;
        return [...first].filter(name => rest.every(s => s.has(name))).sort();
    }
    return [];
}
 
function resolveEquipmentOptionLabel(optionStr) {
    const map = {
        'simple weapon':             ['simple_weapons'],
        'simple weapons':            ['simple_weapons'],
        'martial weapon':            ['martial_weapons'],
        'martial weapons':           ['martial_weapons'],
        'simple or martial weapon':  ['simple_weapons', 'martial_weapons'],
        'simple or martial weapons': ['simple_weapons', 'martial_weapons'],
    };
    return map[optionStr.trim().toLowerCase()] ?? null;
}
 
function buildEquipmentOptionHTML(part, uid, rowIndex, slotIndex) {
    if (typeof part === 'object' && part !== null && part.choice) {
        const allWeapons = collectWeaponsUnderKey(EXTERNAL_LISTS['weapons'] ?? [], part.choice);
        const sorted     = [...allWeapons].sort();
        if (!sorted.length) return `<span>${part.text}</span>`;
        const optionsHTML = ['— choose —', ...sorted].map(w => `<option value="${w}">${w}</option>`).join('');
        return `<span>${part.text}: <select id="equip_weapon_${uid}_${rowIndex}_${slotIndex}" class="equipment-weapon-select">${optionsHTML}</select></span>`;
    }
 
    if (typeof part === 'string') {
        const categories = resolveEquipmentOptionLabel(part);
        if (!categories) return `<span>${part}</span>`;
        const weaponsData = EXTERNAL_LISTS['weapons'] ?? [];
        const allWeapons  = new Set();
        categories.forEach(cat => collectWeaponsUnderKey(weaponsData, cat).forEach(w => allWeapons.add(w)));
        const sorted = [...allWeapons].sort();
        if (!sorted.length) return `<span>${part}</span>`;
        const optionsHTML = ['— choose —', ...sorted].map(w => `<option value="${w}">${w}</option>`).join('');
        return `<span>${part}: <select id="equip_weapon_${uid}_${rowIndex}_${slotIndex}" class="equipment-weapon-select">${optionsHTML}</select></span>`;
    }
 
    return `<span>${part}</span>`;
}
 
function renderEquipment(box, uid, savedEquipment = {}) {
    const selectedClass = box.querySelector('.class-select').value;
    const data          = CLASS_DATA[selectedClass];
    const container     = box.querySelector('.equipment-container');
    container.innerHTML = '';
    if (!data.equipment) return;
 
    data.equipment.forEach((row, i) => {
        const block     = document.createElement('div');
        const radioName = `equip_${uid}_${i}`;
        block.classList.add('feature-block');
 
        if (row.options.length === 1) {
            const option = row.options[0];
            const div    = document.createElement('div');
            div.classList.add('equipment-option-line');
            div.innerHTML = `<span class="equip-content">${
                Array.isArray(option)
                    ? option.map((p, si) => buildEquipmentOptionHTML(p, uid, i, si)).join('<span class="equip-sep">,&nbsp;</span>')
                    : buildEquipmentOptionHTML(option, uid, i, 0)
            }</span>`;
            block.appendChild(div);
        } else {
            row.options.forEach((opt, j) => {
                const label      = document.createElement('label');
                const wasSelected = savedEquipment[radioName] === String(j);
                const letter     = String.fromCharCode(97 + j);
                label.classList.add('equipment-option-line');
                label.innerHTML = `
                    <span class="equip-radio-letter">
                        <input type="radio" name="${radioName}" value="${j}" ${wasSelected ? 'checked' : ''}>
                        ${letter})
                    </span>
                    <span class="equip-content">${
                        Array.isArray(opt)
                            ? opt.map((p, si) => buildEquipmentOptionHTML(p, uid, i, `${j}_${si}`)).join('<span class="equip-sep">,&nbsp;</span>')
                            : buildEquipmentOptionHTML(opt, uid, i, `${j}_0`)
                    }</span>`;
                block.appendChild(label);
            });
        }
        container.appendChild(block);
    });
}
 
/* Popup */
 
function openPopup(field) {
    currentPopupField = field;
    pendingSelection  = null;
    confirmBtn.disabled = true;
 
    const dataset  = field === 'race' ? Object.values(RACE_DATA) : Object.values(BACKGROUND_DATA);
    popupTitle.textContent = field === 'race' ? 'Choose a Race' : 'Choose a Background';
 
    popupList.innerHTML = '';
    dataset.forEach(item => {
        const btn      = document.createElement('button');
        const hiddenVal = document.getElementById(field).value;
        btn.type       = 'button';
        btn.classList.add('popup-list-item');
        btn.textContent = item.name;
 
        if (hiddenVal === item.id) {
            btn.classList.add('active');
            showDetail(item);
            pendingSelection    = item;
            confirmBtn.disabled = false;
        }
 
        btn.addEventListener('click', () => {
            popupList.querySelectorAll('.popup-list-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showDetail(item);
            pendingSelection    = item;
            confirmBtn.disabled = false;
        });
 
        popupList.appendChild(btn);
    });
 
    if (!pendingSelection) popupDetail.innerHTML = '<p class="popup-placeholder">Select an option to see details.</p>';
    overlay.classList.remove('hidden');
}
 
function showDetail(item) {
    popupDetail.replaceChildren(buildInfoElement(item));
    if (item.lang_prof) wireSelects(popupDetail, item.id, 'lang')();
    if (item.tool_prof) wireSelects(popupDetail, item.id, 'tool')();
    enforceGrantedProficiencies(popupDetail);
    popupDetail.querySelectorAll('input, select').forEach(el => el.disabled = true);
}
 
function confirmSelection() {
    if (!pendingSelection || !currentPopupField) return;
 
    document.getElementById(currentPopupField).value = pendingSelection.id;
    const btn = document.getElementById(`${currentPopupField}-btn`);
    btn.textContent = `${pendingSelection.name} ▾`;
    btn.classList.add('has-value');
 
    if (currentPopupField === 'background') {
        backgroundSkills.clear();
        (pendingSelection.skill_prof || [])
            .filter(s => s.prof)
            .forEach(s => backgroundSkills.add(s.skill));
 
        document.querySelectorAll('.character-class-box').forEach(box => {
            renderClassBox(box, box.dataset.uid);
        });
 
        pendingSelection._chosenLanguages = [
            ...popupDetail.querySelectorAll('.lang-select')
        ].map(sel => sel.value);
        (pendingSelection.lang_prof || [])
            .filter(e => e.type === 'fixed')
            .forEach(e => pendingSelection._chosenLanguages.push(e.value));
 
        pendingSelection._chosenTools = [
            ...popupDetail.querySelectorAll('.tool-select')
        ].map(sel => sel.value);
        (pendingSelection.tool_prof || [])
            .filter(e => e.type === 'fixed')
            .forEach(e => pendingSelection._chosenTools.push(e.value));
    }
 
    renderSidebarPanel(currentPopupField, pendingSelection);
    overlay.classList.add('hidden');
 
    rebuildGrantedProficiencies();
    const raceContent = document.querySelector('#race-info-panel .info-panel-content');
    const bgContent   = document.querySelector('#background-info-panel .info-panel-content');
    if (raceContent) enforceGrantedProficiencies(raceContent, 'race');
    if (bgContent)   enforceGrantedProficiencies(bgContent, 'background');
    enforceGrantedProficiencies(document.body);
}
 
function buildInfoElement(item) {
    const isBackground = 'skill_prof' in item;
    const root = document.createElement('div');
 
    const title = document.createElement('h2');
    title.className   = 'popup-detail-title';
    title.textContent = item.name;
    root.appendChild(title);
 
    const desc = document.createElement('p');
    desc.className   = 'popup-detail-desc';
    desc.innerHTML   = item.description.replace(/\n/g, '<br><br>');
    root.appendChild(desc);
 
    if (isBackground) {
        const skills = item.skill_prof
            ? item.skill_prof.filter(s => s.prof).map(s => s.skill).join(', ')
            : '—';
        const meta       = document.createElement('div');
        meta.className   = 'popup-meta';
        meta.innerHTML   = `
            <span><strong>Skills:</strong> ${skills}</span>
            <span><strong>Tools:</strong> ${buildToolProfHTML(item.tool_prof, item.id)}</span>
            <span><strong>Languages:</strong> ${buildLangProfHTML(item.lang_prof, item.id)}</span>
        `;
        root.appendChild(meta);
    }
 
    const featLabel       = document.createElement('div');
    featLabel.className   = 'popup-features-label';
    featLabel.textContent = 'Features';
    root.appendChild(featLabel);
 
    const featList      = document.createElement('div');
    featList.className  = 'popup-features-list';
    item.features.forEach(f => featList.appendChild(buildFeature(0, f, item.id, featList)));
    root.appendChild(featList);
 
    return root;
}
 
function renderSidebarPanel(field, item) {
    const panelId = field === 'race' ? 'race-info-panel' : 'background-info-panel';
    const panel   = document.getElementById(panelId);
    const content = panel.querySelector('.info-panel-content');
    content.replaceChildren(buildInfoElement(item));
 
    if (item._chosenLanguages) {
        content.querySelectorAll('.lang-select').forEach((sel, i) => {
            const val = item._chosenLanguages[i];
            if (val && val !== '— choose —') {
                const opt = [...sel.options].find(o => o.value === val);
                if (opt) sel.value = val;
            }
        });
    }
    if (item._chosenTools) {
        content.querySelectorAll('.tool-select').forEach((sel, i) => {
            const val = item._chosenTools[i];
            if (val && val !== '— choose —') {
                const opt = [...sel.options].find(o => o.value === val);
                if (opt) sel.value = val;
            }
        });
    }
 
    const syncLang = item.lang_prof ? wireSelects(content, item.id, 'lang') : null;
    const syncTool = item.tool_prof ? wireSelects(content, item.id, 'tool') : null;
    if (syncLang) syncLang();
    if (syncTool) syncTool();
 
    enforceGrantedProficiencies(content, field);
 
    panel.classList.remove('hidden');
 
    content.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', () => {
            const wrapper = el.closest('.external-choice-list');
            if (wrapper) {
                const radioName = wrapper.dataset.radioName;
                const max       = parseInt(wrapper.dataset.numChoices || '1');
                if (max > 1) enforceExternalChoiceLimit(wrapper, radioName, max);
                else wrapper.querySelectorAll(`input[name="${radioName}"]`).forEach(cb => {
                    if (cb !== el) cb.checked = false;
                });
                syncExternalChoicesAcrossBoxes(wrapper.dataset.listName);
            }
 
            setTimeout(() => {
                rebuildGrantedProficiencies();
                if (syncLang) syncLang();
                if (syncTool) syncTool();
                const raceContent = document.querySelector('#race-info-panel .info-panel-content');
                const bgContent   = document.querySelector('#background-info-panel .info-panel-content');
                if (raceContent) enforceGrantedProficiencies(raceContent, 'race');
                if (bgContent)   enforceGrantedProficiencies(bgContent, 'background');
            }, 0);
        });
    });
}
 
function closePopup() {
    overlay.classList.add('hidden');
    currentPopupField = null;
    pendingSelection  = null;
}
 
document.getElementById('race-btn').addEventListener('click',       () => openPopup('race'));
document.getElementById('background-btn').addEventListener('click', () => openPopup('background'));
popupClose.addEventListener('click',  closePopup);
confirmBtn.addEventListener('click',  confirmSelection);
overlay.addEventListener('click',     e => { if (e.target === overlay) closePopup(); });
document.addEventListener('keydown',  e => { if (e.key === 'Escape') closePopup(); });
 
/* Class Functions */
 
let classCount       = 0;
let boxUid           = 0;
let backgroundSkills = new Set();
let primaryClassUid  = null;
 
function populateClassSelects() {
    document.querySelectorAll('.class-select').forEach(select => {
        const current    = select.value;
        select.innerHTML = Object.keys(CLASS_DATA)
            .map(name => `<option value="${name}">${name}</option>`)
            .join('');
        if (CLASS_DATA[current]) select.value = current;
    });
}
 
function enforceSkillLimit(skillList, max) {
    const checked = skillList.querySelectorAll('.skill-cb:checked:not(:disabled)');
    skillList.querySelectorAll('.skill-cb:not(:disabled)').forEach(cb => {
        cb.disabled = !cb.checked && checked.length >= max;
    });
}
 
function enforceExternalChoiceLimit(wrapper, radioName, max) {
    const checked = wrapper.querySelectorAll(`input[name="${radioName}"]:checked`);
    wrapper.querySelectorAll(`input[name="${radioName}"]:not(:checked)`).forEach(cb => {
        cb.disabled = checked.length >= max;
    });
}
 
function syncExternalChoicesAcrossBoxes(listName) {
    if (!listName) return;
    const allWrappers = document.querySelectorAll(`.external-choice-list[data-list-name="${listName}"]`);
 
    allWrappers.forEach(currentWrapper => {
        const radioName      = currentWrapper.dataset.radioName;
        const max            = parseInt(currentWrapper.dataset.numChoices || '1');
        const checkedHere    = currentWrapper.querySelectorAll('input:checked').length;
        const checkedElsewhere = new Set();
        allWrappers.forEach(other => {
            if (other === currentWrapper) return;
            other.querySelectorAll('input:checked').forEach(cb => checkedElsewhere.add(cb.value));
        });
 
        currentWrapper.querySelectorAll('input:not(:checked)').forEach(cb => {
            cb.disabled = checkedElsewhere.has(cb.value) || checkedHere >= max;
        });
    });
}
 
/* Spell Selector */
 
function buildSpellSelectorElement(feature, uid, level) {
    const numChoices = parseInt(feature.numChoices ?? 1);
    const radioName  = `extchoice_lvl${level}_uid${uid}`;
    const inputType  = numChoices === 1 ? 'radio' : 'checkbox';
 
    const spellListData = EXTERNAL_LISTS[feature.external_list];
    if (!spellListData || !spellListData.spells) return null;
 
    const spells = filterSpellList(spellListData, feature.options);
    if (!spells.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-style:italic;color:#555';
        empty.textContent   = 'No spells match the specified filters.';
        return empty;
    }
 
    const wrapper = document.createElement('div');
    wrapper.classList.add('spell-selector');
    wrapper.dataset.radioName  = radioName;
    wrapper.dataset.numChoices = numChoices;
    wrapper.dataset.listName   = feature.external_list;
 
    const controls = document.createElement('div');
    controls.classList.add('spell-selector-controls');
 
    const search = document.createElement('input');
    search.type        = 'text';
    search.placeholder = 'Search spells…';
    search.classList.add('spell-search');
 
    const countLabel = document.createElement('span');
    countLabel.classList.add('spell-selector-count');
    countLabel.textContent = `0 / ${numChoices} selected`;
 
    controls.append(search, countLabel);
    wrapper.appendChild(controls);
 
    const list = document.createElement('ul');
    list.classList.add('spell-list-items');
 
    spells.forEach(spell => {
        const li = document.createElement('li');
        li.classList.add('spell-list-item');
        li.dataset.spellName = spell.name.toLowerCase();
 
        const label = document.createElement('label');
        label.classList.add('spell-list-label');
 
        const input = document.createElement('input');
        input.type  = inputType;
        input.name  = radioName;
        input.value = spell.name;
 
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('spell-item-name');
        nameSpan.textContent = spell.name;
 
        label.append(input, nameSpan);
 
        if (spell.ritual === 'true') {
            const ritualBadge = document.createElement('span');
            ritualBadge.classList.add('spell-ritual-badge');
            ritualBadge.textContent = 'ritual';
            label.appendChild(ritualBadge);
        }
 
        if (spell.link) {
            const link = document.createElement('a');
            link.href   = spell.link;
            link.target = '_blank';
            link.classList.add('spell-link');
            link.textContent = '↗';
            label.appendChild(link);
        }
 
        li.appendChild(label);
        list.appendChild(li);
    });
 
    wrapper.appendChild(list);
 
    function applyFilters() {
        const q = search.value.toLowerCase();
        list.querySelectorAll('.spell-list-item').forEach(li => {
            li.style.display = (!q || li.dataset.spellName.includes(q)) ? '' : 'none';
        });
    }
 
    function updateCount() {
        const checked = wrapper.querySelectorAll(`input[name="${radioName}"]:checked`).length;
        countLabel.textContent = `${checked} / ${numChoices} selected`;
        countLabel.classList.toggle('spell-selector-count--done', checked >= numChoices);
        if (numChoices > 1) enforceExternalChoiceLimit(wrapper, radioName, numChoices);
        syncExternalChoicesAcrossBoxes(feature.external_list);
    }
 
    search.addEventListener('input', applyFilters);
    list.querySelectorAll('input').forEach(inp => inp.addEventListener('change', updateCount));
 
    return wrapper;
}
 
/* Feature Builder */
 
function buildFeature(level, feature, uid, featureContainer = null) {
    const block     = document.createElement('div');
    const isOptional = feature.optional === true || feature.optional === 'true';
    block.classList.add('feature-block');
    block.dataset.featureName = feature.feature_name;
 
    const title       = document.createElement('div');
    title.classList.add('feature-title');
    title.textContent = feature.feature_name;
    block.appendChild(title);
 
    if (isOptional) {
        const toggle   = document.createElement('label');
        const checkbox = document.createElement('input');
        toggle.classList.add('optional-toggle');
        checkbox.type = 'checkbox';
        checkbox.classList.add('optional-cb');
        toggle.appendChild(checkbox);
        toggle.append(' Include this optional feature?');
        block.appendChild(toggle);
 
        const content = document.createElement('div');
        content.classList.add('optional-content');
        content.style.display = 'none';
        block.appendChild(content);
 
        checkbox.addEventListener('change', () => {
            content.style.display = checkbox.checked ? 'block' : 'none';
        });
 
        block._contentTarget = content;
    }
 
    const target = block._contentTarget ?? block;
 
    if (feature.feature_type === 'passive' || feature.feature_type === 'modifier') {
        const desc = document.createElement('div');
        desc.textContent = feature.description ?? '';
        target.appendChild(desc);
        if (feature.feature_type === 'modifier') {
            block.dataset.statToMod    = feature.stat_to_mod   ?? '';
            block.dataset.modification = feature.modification  ?? '';
        }
    } else if (feature.feature_type === 'asi') {
        const row   = document.createElement('div');
        const attrs = ['STR','DEX','CON','INT','WIS','CHA'].map(a => `<option>${a}</option>`).join('');
        row.classList.add('asi-row');
        row.innerHTML = `<span> +1</span><select>${attrs}</select><select>${attrs}</select>`;
        target.appendChild(row);
 
    } else if (feature.feature_type === 'subclass') {
        if (feature.subclassFeatures?.length) {
            feature.subclassFeatures.forEach(sf => {
                const sfBlock = document.createElement('div');
                sfBlock.classList.add('subclass-feature-block');
                sfBlock.innerHTML = `
                    <div class="subclass-feature-name">${sf.feature_name}</div>
                    <div class="subclass-feature-desc">${sf.description.replace(/\n/g, '<br><br>')}</div>
                `;
                target.appendChild(sfBlock);
            });
        } else {
            const note = document.createElement('div');
            note.style.cssText = 'font-style:italic;color:#555';
            note.textContent   = 'Feature determined by your subclass choice.';
            target.appendChild(note);
        }
 
    } else if (feature.feature_type === 'upgrade') {
        if (featureContainer) {
            const prior = [...featureContainer.querySelectorAll('.feature-block')]
                .find(b => b.dataset.featureName === feature.feature_to_upgrade);
 
            if (prior) {
                const oldTitle = prior.querySelector('.feature-title');
                if (oldTitle) oldTitle.innerHTML += ' <span class="upgrade-badge">↑ Upgraded</span>';
 
                const newMax = feature.additional_choices
                    ? parseInt(prior.dataset.numChoices || '1') + feature.additional_choices
                    : feature.new_value ? parseInt(feature.new_value) : null;
 
                if (newMax !== null) {
                    const listName  = prior.dataset.externalList;
                    const radioName = prior.dataset.radioName;
                    prior.dataset.numChoices = newMax;
 
                    const prompt = prior.querySelector('.external-choice-prompt');
                    if (prompt) prompt.textContent = `Choose ${newMax}:`;
 
                    const wrapper = prior.querySelector('.external-choice-list');
                    if (wrapper) {
                        wrapper.dataset.numChoices = newMax;
                        wrapper.querySelectorAll(`input[name="${radioName}"]`).forEach(cb => {
                            cb.disabled = false;
                            const fresh = cb.cloneNode(true);
                            cb.replaceWith(fresh);
                        });
                        wrapper.querySelectorAll(`input[name="${radioName}"]`).forEach(cb => {
                            cb.addEventListener('change', () => {
                                enforceExternalChoiceLimit(wrapper, radioName, newMax);
                                syncExternalChoicesAcrossBoxes(listName);
                            });
                        });
                    }
 
                    // Also update spell selector count if present
                    const spellSelector = prior.querySelector('.spell-selector');
                    if (spellSelector) {
                        spellSelector.dataset.numChoices = newMax;
                        const countLabel = spellSelector.querySelector('.spell-selector-count');
                        const checked = spellSelector.querySelectorAll('input:checked').length;
                        if (countLabel) countLabel.textContent = `${checked} / ${newMax} selected`;
                    }
                }
 
                const upgradeNote = document.createElement('div');
                upgradeNote.classList.add('upgrade-note');
                upgradeNote.textContent = feature.description
                    ? `[Level ${level} upgrade] ${feature.description}`
                    : `[Level ${level} upgrade] Choices increased to ${feature.new_value}.`;
                prior.appendChild(upgradeNote);
            }
        }
 
        const ref = document.createElement('div');
        ref.style.cssText = 'font-style:italic;color:#555';
        ref.textContent   = `Upgrades "${feature.feature_to_upgrade}" — see above.`;
        target.appendChild(ref);
    }
 
    const subtypes = Array.isArray(feature.subtype) ? feature.subtype
                   : feature.subtype ? [feature.subtype] : [];
 
    subtypes.forEach(subtype => {
        switch (subtype) {
            case 'resource': {
                if (feature.uses != null) {
                    const uses = document.createElement('div');
                    uses.classList.add('feature-uses');
                    uses.textContent = `Uses: ${feature.uses}`;
                    target.appendChild(uses);
                }
                break;
            }
 
            case 'choice': {
                const numChoices = feature.numChoices ?? 1;
                const radioName  = `feat_lvl${level}_uid${uid}_choice`;
                const prompt     = document.createElement('div');
                prompt.textContent = numChoices > 1 ? `Choose ${numChoices}:` : 'Choose one:';
                target.appendChild(prompt);
 
                const options = document.createElement('div');
                options.classList.add('feature-options');
                (feature.options ?? []).forEach(opt => {
                    const label   = document.createElement('label');
                    label.innerHTML = `<input type="radio" name="${radioName}"> ${opt}`;
                    options.appendChild(label);
                });
                target.appendChild(options);
                break;
            }
 
            case 'external_choice': {
                const numChoices = feature.numChoices ?? 1;
                const radioName  = `extchoice_lvl${level}_uid${uid}`;
                block.dataset.externalList = feature.external_list;
                block.dataset.radioName    = radioName;
                block.dataset.numChoices   = numChoices;
 
                const prompt = document.createElement('div');
                prompt.classList.add('external-choice-prompt');
                prompt.textContent = `Choose ${numChoices}:`;
                target.appendChild(prompt);
 
                if (feature.external_list === 'weapons') {
                    const rawOptions = feature.options;
 
                    if (typeof rawOptions === 'string' && rawOptions !== 'any') {
                        const fixed = document.createElement('div');
                        fixed.classList.add('weapon-fixed');
                        fixed.innerHTML = `<em>Weapon: ${rawOptions}</em>`;
                        target.appendChild(fixed);
                        break;
                    }
 
                    let weaponNames = rawOptions === 'any'
                        ? (() => { const all = new Set(); collectAllLeaves(EXTERNAL_LISTS['weapons'] ?? [], all); return [...all].sort(); })()
                        : resolveWeaponOptions(rawOptions) ?? [];
 
                    if (!weaponNames.length) {
                        const empty = document.createElement('div');
                        empty.style.cssText = 'font-style:italic;color:#555';
                        empty.textContent   = 'No weapons match the specified filters.';
                        target.appendChild(empty);
                        break;
                    }
 
                    for (let i = 0; i < numChoices; i++) {
                        const sel = document.createElement('select');
                        sel.classList.add('weapon-select');
                        sel.dataset.uid   = uid;
                        sel.dataset.index = i;
                        sel.innerHTML = `<option value="">— choose a weapon —</option>` +
                            weaponNames.map(n => `<option value="${n}">${n}</option>`).join('');
 
                        sel.addEventListener('change', () => {
                            const siblings = target.querySelectorAll('.weapon-select');
                            const chosen   = new Set([...siblings].map(s => s.value).filter(v => v));
                            siblings.forEach(other => {
                                [...other.options].forEach(opt => {
                                    if (!opt.value) return;
                                    opt.disabled = chosen.has(opt.value) && other.value !== opt.value;
                                });
                            });
                        });
                        target.appendChild(sel);
                    }
                    break;
                }
 
                if (EXTERNAL_LISTS[feature.external_list]?.spells) {
                    const spellSelector = buildSpellSelectorElement(feature, uid, level);
                    if (spellSelector) {
                        target.appendChild(spellSelector);
                        break;
                    }
                }
 
                const rawList = Array.isArray(feature.options)
                    ? feature.options.map(o => typeof o === 'string' ? { name: o } : o)
                    : typeof feature.options === 'string' && feature.options !== 'all' && EXTERNAL_LISTS[feature.options]
                        ? EXTERNAL_LISTS[feature.options]
                        : (EXTERNAL_LISTS[feature.external_list] || []);
 
                const list = rawList.flatMap(o =>
                    Array.isArray(o.options)
                        ? o.options.map(inner => typeof inner === 'string' ? { name: inner } : inner)
                        : [typeof o === 'string' ? { name: o } : o]
                );
 
                const optionsWrapper = document.createElement('div');
                optionsWrapper.classList.add('external-choice-list');
                optionsWrapper.dataset.listName   = feature.external_list;
                optionsWrapper.dataset.radioName  = radioName;
                optionsWrapper.dataset.numChoices = numChoices;
 
                const inputType = numChoices === 1 ? 'radio' : 'checkbox';
                list.forEach(option => {
                    const label = document.createElement('label');
                    label.classList.add('external-choice-item');
                    label.innerHTML = `<input type="${inputType}" name="${radioName}" value="${option.name}"> ${option.name}`;
                    if (option.description) { label.title = option.description; label.classList.add('has-tooltip'); }
                    if (option.requirement) {
                        const req = document.createElement('div');
                        req.classList.add('external-choice-requirement');
                        req.textContent = `Requires: ${option.requirement}`;
                        label.appendChild(req);
                    }
                    optionsWrapper.appendChild(label);
                });
 
                optionsWrapper.querySelectorAll(`input[name="${radioName}"]`).forEach(cb => {
                    cb.addEventListener('change', () => {
                        if (numChoices > 1) enforceExternalChoiceLimit(optionsWrapper, radioName, numChoices);
                        syncExternalChoicesAcrossBoxes(feature.external_list);
                    });
                });
 
                target.appendChild(optionsWrapper);
                break;
            }
 
            case 'save_dc': {
                if (feature.save_dc != null) {
                    const dc = document.createElement('div');
                    dc.classList.add('feature-save-dc');
                    dc.textContent = `Save DC: ${feature.save_dc}`;
                    target.appendChild(dc);
                }
                break;
            }
 
            case 'spell_list_addition': {
                if (feature.spells_to_add) {
                    const spellDiv = document.createElement('div');
                    spellDiv.classList.add('feature-spells');
                    spellDiv.textContent = 'Spells added: ' + feature.spells_to_add
                        .map(entry => { const [lvl, name] = Object.entries(entry)[0]; return `${name} (level ${lvl})`; })
                        .join(', ');
                    target.appendChild(spellDiv);
                }
                break;
            }
 
            case 'prof_addition':
                break;
        }
    });
 
    return block;
}
 
function renderFeaturesOnly(box, uid) {
    const selectedClass = box.querySelector('.class-select').value;
    const selectedLevel = Math.min(Math.max(parseInt(box.querySelector('.level-input').value) || 1, 1), 20);
    const data          = CLASS_DATA[selectedClass];
    const selectedSub   = box.querySelector('.subclass-select').value;
    const subData       = (SUBCLASS_DATA[selectedClass] || []).find(s => s.name === selectedSub) || null;
 
    const subByLevel = {};
    if (subData) {
        Object.entries(subData.features).forEach(([lvl, f]) => {
            subByLevel[parseInt(lvl)] = Array.isArray(f) ? f : [f];
        });
    }
 
    const featureContainer = box.querySelector('.feature-container');
 
    const savedState = {};
    featureContainer.querySelectorAll('input, select').forEach(el => {
        let key;
        if (el.type === 'radio' || el.type === 'checkbox') {
            key = `${el.name}::${el.value}`;
            savedState[key] = el.checked;
        } else {
            const featureName = el.closest('.feature-block')?.dataset.featureName ?? 'unknown';
            const idx = [...el.parentElement.children].indexOf(el);
            key = `${featureName}_${el.type}_${idx}`;
            savedState[key] = el.value;
        }
    });
 
    featureContainer.innerHTML = '';
    let anyFeature = false;
 
    for (let lvl = 1; lvl <= selectedLevel; lvl++) {
        const levelGroup  = document.createElement('div');
        const levelHeader = document.createElement('div');
        levelGroup.classList.add('level-group');
        levelHeader.classList.add('level-header');
        levelHeader.textContent = `Level ${lvl}`;
        levelGroup.appendChild(levelHeader);
 
        if (data.features[lvl]) {
            const feats = Array.isArray(data.features[lvl]) ? data.features[lvl] : [data.features[lvl]];
            feats.forEach(feat => {
                if (feat.feature_type === 'subclass' && subByLevel[lvl]) {
                    subByLevel[lvl].forEach(sf => levelGroup.appendChild(buildFeature(lvl, sf, uid, featureContainer)));
                } else {
                    levelGroup.appendChild(buildFeature(lvl, { ...feat }, uid, featureContainer));
                }
                anyFeature = true;
            });
        } else {
            const filler = document.createElement('div');
            filler.classList.add('feature-block');
            filler.innerHTML = `<div style="font-style:italic;color:#555">No new features at this level.</div>`;
            levelGroup.appendChild(filler);
            anyFeature = true;
        }
        featureContainer.appendChild(levelGroup);
    }
 
    if (!anyFeature) {
        const msg = document.createElement('div');
        msg.classList.add('no-features-msg');
        msg.textContent = 'No features at this level.';
        featureContainer.appendChild(msg);
    }
 
    featureContainer.querySelectorAll('input, select').forEach(el => {
        let key;
        if (el.type === 'radio' || el.type === 'checkbox') {
            key = `${el.name}::${el.value}`;
            if (key in savedState) el.checked = savedState[key];
        } else {
            const featureName = el.closest('.feature-block')?.dataset.featureName ?? 'unknown';
            const idx = [...el.parentElement.children].indexOf(el);
            key = `${featureName}_${el.type}_${idx}`;
            if (key in savedState) el.value = savedState[key];
        }
    });
 
    featureContainer.querySelectorAll('.optional-cb').forEach(cb => {
        const content = cb.closest('.feature-block')?.querySelector('.optional-content');
        if (content) content.style.display = cb.checked ? 'block' : 'none';
    });
    featureContainer.querySelectorAll('.external-choice-list').forEach(wrapper => {
        const radioName = wrapper.dataset.radioName;
        const max       = parseInt(wrapper.dataset.numChoices || '1');
        if (max > 1) enforceExternalChoiceLimit(wrapper, radioName, max);
        syncExternalChoicesAcrossBoxes(wrapper.dataset.listName);
    });
}
 
function renderClassBox(box, uid) {
    const selectedClass  = box.querySelector('.class-select').value;
    const selectedLevel  = Math.min(Math.max(parseInt(box.querySelector('.level-input').value) || 1, 1), 20);
    const data           = CLASS_DATA[selectedClass];
    const subclassSelect = box.querySelector('.subclass-select');
    const prevSub        = subclassSelect.value;
 
    const available = SUBCLASS_DATA[selectedClass] || [];
    subclassSelect.innerHTML = available
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => `<option value="${s.name}">${s.name}</option>`)
        .join('');
    if (available.find(s => s.name === prevSub)) subclassSelect.value = prevSub;
 
    const savedSkills = new Set();
    box.querySelectorAll('.skill-cb:checked:not([disabled])').forEach(cb => {
        savedSkills.add(cb.closest('label').textContent.trim());
    });
 
    const savedEquipment = {};
    box.querySelectorAll('.equipment-container input[type="radio"]:checked').forEach(radio => {
        savedEquipment[radio.name] = radio.value;
    });
 
    renderEquipment(box, uid, savedEquipment);
 
    const skillList  = box.querySelector('.skill-list');
    const skillLabel = box.querySelector('.skill-count-label');
    skillLabel.textContent = `Skills (pick ${data.numSkills}):`;
    skillList.innerHTML    = '';
 
    data.skill_prof.forEach(skill => {
        const fromBackground = backgroundSkills.has(skill);
        const label          = document.createElement('label');
        label.innerHTML      = `<input type="checkbox" class="skill-cb" ${fromBackground || savedSkills.has(skill) ? 'checked' : ''} ${fromBackground ? 'disabled' : ''}> ${skill}`;
        if (fromBackground) {
            label.style.cssText = 'opacity:0.5;cursor:not-allowed';
            label.title         = 'Granted by background';
        }
        skillList.appendChild(label);
    });
 
    skillList.querySelectorAll('.skill-cb').forEach(cb => {
        cb.addEventListener('change', () => enforceSkillLimit(skillList, data.numSkills));
    });
    enforceSkillLimit(skillList, data.numSkills);
 
    renderFeaturesOnly(box, uid);
}
 
//Receive already made character from character sheet
async function populateFromCharacter(char) {
    console.log('form_data:', char.form_data);
    const fd = char.form_data;

    // Name
    document.getElementById('character-name').value = (fd?.name ?? char.name) ?? '';

    // Ability scores
    if (fd?.stats) {
        for (const [k, v] of Object.entries(fd.stats)) {
            const el = document.getElementById(`ability-${k}`);
            if (el) el.value = v;
        }
    } else {
        const STAT_MAP = { str:'Strength', dex:'Dexterity', con:'Constitution',
                           int:'Intelligence', wis:'Wisdom', cha:'Charisma' };
        for (const [k, fullName] of Object.entries(STAT_MAP)) {
            const entry = char.stats?.find(s => s.stat === fullName);
            const el = document.getElementById(`ability-${k}`);
            if (el && entry) el.value = entry.base ?? 10;
        }
    }

    // Race
    const raceSource = fd?.race ?? char.race;
    if (raceSource) {
        const raceObj = Object.values(RACE_DATA).find(r => r.id == raceSource.id);
        if (raceObj) {
            document.getElementById('race').value = raceObj.id;
            const btn = document.getElementById('race-btn');
            btn.textContent = `${raceObj.name} ▾`;
            btn.classList.add('has-value');
            renderSidebarPanel('race', raceObj);
            if (fd?.race?.decisions) {
                restorePanelDecisions('#race-info-panel .info-panel-content', fd.race.decisions, raceObj);
            } else {
                restorePanelFromFeatures('#race-info-panel .info-panel-content', char, raceObj, 'race');
            }
        }
    }

    // Background
    const bgSource = fd?.background ?? char.background;
    if (bgSource) {
        const bgObj = Object.values(BACKGROUND_DATA).find(b => b.id == bgSource.id);
        if (bgObj) {
            document.getElementById('background').value = bgObj.id;
            const btn = document.getElementById('background-btn');
            btn.textContent = `${bgObj.name} ▾`;
            btn.classList.add('has-value');
            backgroundSkills.clear();
            (bgObj.skill_prof || []).filter(s => s.prof).forEach(s => backgroundSkills.add(s.skill));
            renderSidebarPanel('background', bgObj);
            if (fd?.background?.decisions) {
                restorePanelDecisions('#background-info-panel .info-panel-content', fd.background.decisions, bgObj);
            } else {
                restorePanelFromFeatures('#background-info-panel .info-panel-content', char, bgObj, 'background');
            }
        }
    }

    // Classes
    const classSource = fd?.classes ?? char.classes ?? [];
    for (const cls of classSource) {
        document.getElementById('addClassBtn').click();
        const boxes = document.querySelectorAll('.character-class-box');
        const box = boxes[boxes.length - 1];

        // Class
        const classSelect = box.querySelector('.class-select');
        if (CLASS_DATA[cls.name]) {
            classSelect.value = cls.name;
            classSelect.dispatchEvent(new Event('change'));
        }

        // Level
        const levelInput = box.querySelector('.level-input');
        levelInput.value = cls.level ?? 1;
        levelInput.dispatchEvent(new Event('change'));

        await new Promise(r => setTimeout(r, 0));

        // Subclass
        const subclassName = cls.subclass?.name ?? char.subclasses?.find(sc => sc.source_id === cls.id)?.name;
        if (subclassName) {
            const subSelect = box.querySelector('.subclass-select');
            if ([...subSelect.options].find(o => o.value === subclassName)) {
                subSelect.value = subclassName;
                subSelect.dispatchEvent(new Event('change'));
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // Primary class
        const isPrimary = cls.decisions?.primaryClass ?? (char.classes?.indexOf(cls) === 0 && !fd);
        if (isPrimary) {
            const cb = box.querySelector('.primary-class-cb');
            cb.checked = true;
            primaryClassUid = parseInt(box.dataset.uid);
        }

        // Skills
        const skillSet = new Set(cls.skills ?? cls.skill_prof?.map(sp => sp.skill) ?? []);
        box.querySelectorAll('.skill-cb:not(:disabled)').forEach(cb => {
            cb.checked = skillSet.has(cb.parentElement.textContent.trim());
        });

        // Feature choices
        const features = cls.decisions?.features ?? {};
        const newUid   = String(box.dataset.uid);
        const oldUid   = cls._uid
            ? String(cls._uid)
            : (() => {
                for (const key of Object.keys(features)) {
                    let m = key.match(/uid(\d+)/);
                    if (m) return m[1];
                    m = key.match(/^equip_weapon_(\d+)_/) ?? key.match(/^equip_(\d+)_/);
                    if (m) return m[1];
                }
                return null;
            })();

        for (const [rawKey, value] of Object.entries(features)) {
            const name = oldUid && oldUid !== newUid
                ? rawKey
                    .replace(new RegExp(`equip_weapon_${oldUid}_`, 'g'), `equip_weapon_${newUid}_`)
                    .replace(new RegExp(`uid${oldUid}`, 'g'),            `uid${newUid}`)
                    .replace(new RegExp(`equip_${oldUid}_`, 'g'),        `equip_${newUid}_`)
                : rawKey;

            const values = [].concat(value);

            // Radios — match by label text
            box.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(r => {
                const txt = (r.closest('label') ?? r.parentElement).textContent.trim().replace(/\s+/g, ' ');
                if (txt === values[0]) r.checked = true;
            });

            // Checkboxes — match by value
            values.forEach(v => {
                const cb = box.querySelector(`input[type="checkbox"][name="${name}"][value="${v}"]`);
                if (cb) cb.checked = true;
            });

            // Weapon selects — match by element id
            const sel = box.querySelector(`select#${name}`);
            if (sel && values[0] && values[0] !== '— choose —') sel.value = values[0];
        }

        // Fallback for old characters without form_data:
        // derive choices from char.features entries like "Feature Name: Choice"
        if (Object.keys(features).length === 0) {
            const sourceId = cls.id ?? 'class-0';
            const grouped  = {};

            for (const f of (char.features ?? [])) {
                if (f.source_id !== sourceId || !f.name?.includes(': ')) continue;
                const colon  = f.name.indexOf(': ');
                const base   = f.name.slice(0, colon).trim();
                const chosen = f.name.slice(colon + 2).trim();
                (grouped[base] ??= []).push(chosen);
            }

            box.querySelectorAll('.feature-container .feature-block').forEach(block => {
                const baseName = block.dataset.featureName;
                const choices  = grouped[baseName];
                if (!choices?.length) return;

                // Set all checkboxes/radios WITHOUT firing change events
                choices.forEach(chosen => {
                    // Checkbox (multi-select, e.g. Eldritch Invocations)
                    const cb = block.querySelector(`input[type="checkbox"][value="${chosen}"]`);
                    if (cb) { cb.checked = true; return; }

                    // Radio (single choice, e.g. Fighting Style, Pact Boon)
                    block.querySelectorAll('input[type="radio"]').forEach(r => {
                        if (r.parentElement.textContent.trim().replace(/\s+/g, ' ') === chosen)
                            r.checked = true;
                    });
                });

                // Now enforce limits once, after all are set
                const wrapper = block.querySelector('.external-choice-list');
                if (wrapper) {
                    const radioName = wrapper.dataset.radioName;
                    const max       = parseInt(wrapper.dataset.numChoices || '1');
                    enforceExternalChoiceLimit(wrapper, radioName, max);
                    syncExternalChoicesAcrossBoxes(wrapper.dataset.listName);
                }
            });
        }

        // ASI rows
        const asiData = cls.decisions?.asi ?? [];
        const STAT_TO_ABBREV = {
            Strength:'STR', Dexterity:'DEX', Constitution:'CON',
            Intelligence:'INT', Wisdom:'WIS', Charisma:'CHA'
        };

        box.querySelectorAll('.asi-row').forEach((row, i) => {
            let picks;
            if (asiData[i]?.picks?.length) {
                // form_data path — picks are already abbreviations
                picks = asiData[i].picks;
            } else {
                // fallback — read from stat modifiers for this row
                picks = [];
                (char.stats ?? []).forEach(stat => {
                    stat.modifiers?.forEach(mod => {
                        if (mod.source_id === `${cls.id}-asi-r${i}-p${picks.length}`) {
                            const abbrev = STAT_TO_ABBREV[stat.stat];
                            if (abbrev) picks.push(abbrev);
                        }
                    });
                });
            }
            row.querySelectorAll('select').forEach((sel, j) => {
                if (picks[j]) sel.value = picks[j];
            });
        });
    }

    // Edit mode UI
    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
        document.getElementById('saveCharacterBtn').textContent = 'Save to Current Character';
        document.getElementById('saveAsNewBtn').style.display   = '';

        // Disable equipment inputs
        const disableEquipment = () => {
            document.querySelectorAll(
                '.equipment-container input[type="radio"], .equipment-container select'
            ).forEach(el => {
                el.disabled = true;
                const lbl = el.closest('label');
                if (lbl) lbl.style.opacity = '0.5';
            });
        };
        disableEquipment();

        // Also disable when new class boxes are added
        new MutationObserver(disableEquipment)
            .observe(document.getElementById('classContainer'), { childList: true, subtree: true });
    }
}

function restorePanelDecisions(panelSelector, decisions, dataObj) {
    const content = document.querySelector(panelSelector);
    if (!content || !decisions) return;

    for (const [key, value] of Object.entries(decisions)) {
        const values = [].concat(value);

        // Key is a feature id — look up the feature to find its name, then find the DOM block
        const feat = (dataObj?.features ?? []).find(f => f.id === key);
        if (feat) {
            const block = [...content.querySelectorAll('.feature-block')]
                .find(b => b.dataset.featureName === feat.feature_name);
            if (block) {
                values.forEach(v => {
                    const input = block.querySelector(`input[value="${v}"]`);
                    if (input) input.checked = true;
                });
                continue;
            }
        }

        // Key is a lang/tool select id (e.g. lang_3_0, tool_3_1)
        const sel = content.querySelector(`select#${key}`);
        if (sel && values[0] && values[0] !== '— choose —') {
            sel.value = values[0];
            continue;
        }

        // Fallback: try matching by name attribute (covers any other inputs)
        values.forEach(v => {
            const input = content.querySelector(`input[name="${key}"][value="${v}"]`);
            if (input) input.checked = true;
        });
    }
}

function restorePanelFromFeatures(panelSelector, char, dataObj, sourceType) {
    const content = document.querySelector(panelSelector);
    if (!content || !dataObj) return;

    const sourceId = `${sourceType}-${dataObj.id}`;

    // 1. external_choice features: "Feature Name: Choice" entries in char.features
    const grouped = {};
    for (const f of (char.features ?? [])) {
        if (f.source_id !== sourceId || !f.name?.includes(': ')) continue;
        const colon  = f.name.indexOf(': ');
        const base   = f.name.slice(0, colon).trim();
        const chosen = f.name.slice(colon + 2).trim();
        (grouped[base] ??= []).push(chosen);
    }

    content.querySelectorAll('.feature-block').forEach(block => {
        const baseName = block.dataset.featureName;
        const choices  = grouped[baseName];
        if (!choices?.length) return;

        choices.forEach(chosen => {
            const cb = block.querySelector(`input[type="checkbox"][value="${chosen}"]`);
            if (cb) { cb.checked = true; return; }
            block.querySelectorAll('input[type="radio"]').forEach(r => {
                if (r.parentElement.textContent.trim().replace(/\s+/g, ' ') === chosen)
                    r.checked = true;
            });
        });

        const wrapper = block.querySelector('.external-choice-list');
        if (wrapper) {
            enforceExternalChoiceLimit(wrapper, wrapper.dataset.radioName,
                parseInt(wrapper.dataset.numChoices || '1'));
        }
    });

    // 2. Lang selects — from lang_prof on the template (type !== 'fixed')
    //    Chosen langs = char.languages minus fixed langs from this template
    const fixedLangs = new Set(['Common']);
    for (const f of (dataObj.features ?? [])) {
        for (const entry of (f.prof_to_add ?? [])) {
            for (const lang of (entry.lang_prof ?? [])) fixedLangs.add(lang);
        }
    }
    (dataObj.lang_prof ?? [])
        .filter(e => e.type === 'fixed' && e.value)
        .forEach(e => fixedLangs.add(e.value));

    const chosenLangs = (char.languages ?? []).filter(l => !fixedLangs.has(l));
    content.querySelectorAll('select.lang-select').forEach((sel, i) => {
        if (chosenLangs[i]) sel.value = chosenLangs[i];
    });

    // 3. Tool selects — from tool_prof on the template (type !== 'fixed')
    //    Chosen tools = char.tool_proficiencies for this source, excluding fixed ones
    const fixedTools = new Set(
        (dataObj.tool_prof ?? []).filter(e => e.type === 'fixed' && e.value).map(e => e.value)
    );
    const chosenTools = (char.tool_proficiencies ?? [])
        .filter(t => t.source_id === sourceId && !fixedTools.has(t.tool))
        .map(t => t.tool);

    content.querySelectorAll('select.tool-select').forEach((sel, i) => {
        if (chosenTools[i]) sel.value = chosenTools[i];
    });
}

/* Init */
 
async function init() {
    await Promise.all([
        loadCollection('/api/classes',     CLASS_DATA,      d => d.name),
        loadCollection('/api/backgrounds', BACKGROUND_DATA, d => d.name),
        loadCollection('/api/races',       RACE_DATA,       d => d.name),
        loadAllSubclasses(),
        loadAllExternalLists(),
    ]).catch(err => console.error('Init failed:', err));
 
    document.getElementById('addClassBtn').addEventListener('click', () => {
        classCount++;
        boxUid++;
        const uid      = boxUid;
        const template = document.getElementById('classTemplate');
        const clone    = template.content.cloneNode(true);
 
        clone.querySelector('.class-title').textContent = `Class ${classCount}`;
        clone.querySelector('.remove-btn').addEventListener('click', function () {
            const removedBox = this.closest('.character-class-box');
            const wasFirst = removedBox === document.getElementById('classContainer').firstElementChild;
            removedBox.remove();
            if (wasFirst) {
                const remaining = document.getElementById('classContainer').firstElementChild;
                if (remaining) {
                    const cb = remaining.querySelector('.primary-class-cb');
                    cb.disabled = false;
                    cb.checked = true;
                    primaryClassUid = parseInt(remaining.dataset.uid);
                    cb.disabled = true;
                }
            }
        });
 
        const classSelect    = clone.querySelector('.class-select');
        classSelect.innerHTML = Object.keys(CLASS_DATA).sort()
            .map(name => `<option value="${name}">${name}</option>`)
            .join('');
 
        document.getElementById('classContainer').appendChild(clone);
        const box = document.getElementById('classContainer').lastElementChild;
        box.dataset.uid = uid;
 
        const primaryCb = box.querySelector('.primary-class-cb');
        const isFirstClass = document.getElementById('classContainer').children.length === 1;
        if (isFirstClass) {
            primaryCb.checked = true;
            primaryClassUid = uid;
        }
        primaryCb.disabled = true;
 
        box.querySelector('.class-select').addEventListener('change',   () => renderClassBox(box, uid));
        box.querySelector('.level-input').addEventListener('change',    () => {
            const input = box.querySelector('.level-input');
            input.value = Math.min(Math.max(parseInt(input.value) || 1, 1), 20);
            renderClassBox(box, uid);
        });
        box.querySelector('.subclass-select').addEventListener('change', () => renderFeaturesOnly(box, uid));
 
        renderClassBox(box, uid);
    });

    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
        const res = await fetch(`/api/characters/${editId}`);
        const char = await res.json();
        await populateFromCharacter(char);
    }
}
 
init();






// Character parsing

//  Helpers to get selected Race/Background objects from in-memory data
function getSelectedRaceObj() {
  const el = document.getElementById("race");
  const id = el ? el.value : "";
  if (!id) return null;

  return Object.values(RACE_DATA).find(r => r.id === Number(id)) || null;
}

function getSelectedBackgroundObj() {
  const el = document.getElementById("background");
  const id = el ? el.value : "";
  if (!id) return null;

  return Object.values(BACKGROUND_DATA).find(b => b.id === Number(id)) || null;
}

// Background skills should come from BACKGROUND_DATA (source-of-truth)
function getBackgroundSkills(bgObj) {
  if (!bgObj || !Array.isArray(bgObj.skill_prof)) return [];
  return bgObj.skill_prof
    .filter(s => s && s.prof === true)
    .map(s => s.skill);
}

// Class-picked skills come from checked checkboxes in the class box (exclude disabled = background-granted)
function getClassPickedSkills(box) {
  return Array.from(box.querySelectorAll(".skill-cb:checked"))
    .filter(cb => !cb.disabled)
    .map(cb => cb.parentElement.textContent.trim().replace(/\s+/g, " "));
}

// Feature choices: feature inputs in DOM order + equipment choices + ASI rows
function getFeatureChoices(box) {
  const features = {};

  // Single DOM-order pass over all feature inputs (level 1 → level N).
  // Doing this as one traversal preserves level ordering so class and subclass
  // decisions interleave correctly — the parser can rely on this ordering to
  // attribute choices to the right source.
  // .optional-cb checkboxes have no name and are skipped by the guard below.
  box.querySelectorAll(
    '.feature-container input[type="radio"]:checked,' +
    '.feature-container input[type="checkbox"]:checked'
  ).forEach(input => {
    if (!input.name) return;
    if (input.type === 'radio') {
      features[input.name] = input.parentElement.textContent.trim().replace(/\s+/g, " ");
    } else {
      // checkbox: multiple selections under the same name accumulate into an array
      if (Array.isArray(features[input.name])) {
        features[input.name].push(input.value);
      } else {
        features[input.name] = [input.value];
      }
    }
  });

  // Equipment choices are in a separate container and processed independently.
  // Option letter (a/b/c) from the checked radio:
  box.querySelectorAll('.equipment-container input[type="radio"]:checked').forEach(r => {
    features[r.name] = r.parentElement.textContent.trim().replace(/\s+/g, " ");
  });

  // Specific weapon selects — only from the chosen option, not unchosen ones.
  // Multi-option rows wrap each option in a <label class="equipment-option-line">;
  // single-option rows use a <div>, so closest('label.equipment-option-line') is null
  // and the weapon is always included.
  box.querySelectorAll('.equipment-container .equipment-weapon-select').forEach(sel => {
    if (!sel.value || sel.value === '— choose —' || !sel.id) return;
    const optionLabel = sel.closest('label.equipment-option-line');
    if (optionLabel) {
      const radio = optionLabel.querySelector('input[type="radio"]');
      if (!radio || !radio.checked) return;
    }
    features[sel.id] = sel.value;
  });

  // ASI rows: store the numeric choice and the dropdown picks
  const asi = Array.from(box.querySelectorAll(".asi-row")).map(row => {
    const num = Number(row.querySelector('input[type="number"]')?.value || 0);
    const picks = Array.from(row.querySelectorAll("select")).map(s => s.value);
    return { num, picks };
  });

  return { features, asi };
}

// Collect all user decisions from a sidebar panel generically.
// Feature-block inputs are keyed by the feature's id from the data object.
// Any inputs outside feature blocks (e.g. top-level lang/tool selects) are
// keyed by their element id or name attribute.
function collectPanelDecisions(panelSelector, dataObj) {
    const decisions = {};
    const content = document.querySelector(panelSelector);
    if (!content || !dataObj) return decisions;

    // Inputs inside feature blocks — keyed by feature id
    content.querySelectorAll('.feature-block').forEach(block => {
        const featureName = block.dataset.featureName;
        const feat = (dataObj.features ?? []).find(f => f.feature_name === featureName);
        if (!feat) return;

        const choices = [];
        block.querySelectorAll('.external-choice-list input:checked').forEach(inp => {
            choices.push(inp.value);
        });
        block.querySelectorAll('select').forEach(sel => {
            if (sel.value && sel.value !== '— choose —') choices.push(sel.value);
        });
        if (choices.length > 0) {
            decisions[feat.id] = choices.length === 1 ? choices[0] : choices;
        }
    });

    // Any interactive inputs outside feature blocks — keyed by element id or name
    content.querySelectorAll('select, input[type="checkbox"], input[type="radio"]').forEach(el => {
        if (el.closest('.feature-block')) return;
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        const val = el.value;
        if (!val || val === '— choose —') return;
        const key = el.id || el.name;
        if (!key) return;
        if (key in decisions) {
            decisions[key] = [].concat(decisions[key], val);
        } else {
            decisions[key] = val;
        }
    });

    return decisions;
}

// Build the payload exactly in the structure you described
function buildCharacterPayload() {
  const name = (document.getElementById("character-name")?.value || "").trim();

  const stats = {
      str: parseInt(document.getElementById('ability-str')?.value) || 10,
      dex: parseInt(document.getElementById('ability-dex')?.value) || 10,
      con: parseInt(document.getElementById('ability-con')?.value) || 10,
      int: parseInt(document.getElementById('ability-int')?.value) || 10,
      wis: parseInt(document.getElementById('ability-wis')?.value) || 10,
      cha: parseInt(document.getElementById('ability-cha')?.value) || 10,
  };

  const raceObj = getSelectedRaceObj();
  const bgObj = getSelectedBackgroundObj();

  const classes = Array.from(document.querySelectorAll(".character-class-box")).map((box, idx) => {
    const className    = box.querySelector(".class-select")?.value || "";
    const subclassName = box.querySelector(".subclass-select")?.value || "";
    const level        = Math.min(20, Math.max(1, Number(box.querySelector(".level-input")?.value) || 1));
    const skills       = getClassPickedSkills(box);
    const { features, asi } = getFeatureChoices(box);
    const primaryClass = !!box.querySelector(".primary-class-cb")?.checked;

    return {
      id:    `class-${idx}`,
      _uid:  box.dataset.uid,            // ← added: lets populate know the original uid
      name:  className,
      level,
      skills,
      decisions: {
        primaryClass,
        features,
        asi
      },
      subclass: {
        id:        subclassName || "",
        name:      subclassName || "",
        decisions: {}
      }
    };
  });

  return {
    name,
    stats,
    race:       raceObj ? { id: raceObj.id, name: raceObj.name, decisions: collectPanelDecisions('#race-info-panel .info-panel-content', raceObj) } : null,
    background: bgObj   ? { id: bgObj.id,   name: bgObj.name,   decisions: collectPanelDecisions('#background-info-panel .info-panel-content', bgObj) }   : null,
    classes
  };
}


// Save character handler
async function saveCharacter(forceNew = false) {
    const payload = buildCharacterPayload();
    const editId  = new URLSearchParams(window.location.search).get('id');
    const isEdit  = editId && !forceNew;

    if (!payload.name) {
        alert('Please enter a character name.');
        return;
    }

    try {
        const res = await fetch(
            isEdit ? `/api/characters/${editId}` : '/api/characters',
            {
                method:  isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload)
            }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.error || 'Failed to save character.');
            return;
        }

        if (isEdit) {
            window.location.href = `sheet.html?id=${editId}`;
        } else {
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `${payload.name.replace(/\s+/g, '_')}_character.json`;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
            alert('Character saved!');
        }
    } catch (err) {
        console.error(err);
        alert('Network error while saving character.');
    }
}

// attach the handler
document.getElementById('saveCharacterBtn').addEventListener('click', () => saveCharacter(false));
document.getElementById('saveAsNewBtn').addEventListener('click',     () => saveCharacter(true));


