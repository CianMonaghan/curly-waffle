const CLASS_DATA = {};
const SUBCLASS_DATA = {};
const BACKGROUND_DATA = {};
const RACE_DATA = {};
const EXTERNAL_LISTS = {};

/* Load JSON data files */

async function loadAllClasses() {
    const res        = await fetch('/api/classes');
    const classFiles = await res.json();

    await Promise.all(classFiles.map(async fileName => {
        const fileRes = await fetch(`/static_json/classes/${fileName}.json`);
        const data    = await fileRes.json();
        CLASS_DATA[data.name] = data;
    }));
}

async function loadAllSubclasses() {
    const res = await fetch('/api/subclasses');
    const subclassFiles = await res.json();

    await Promise.all(subclassFiles.map(async fileName => {
        const fileRes = await fetch(`/static_json/subclasses/${fileName}.json`);
        const data = await fileRes.json();

        // Normalize to match CLASS_DATA keys (e.g. "Fighter" not "fighter")
        const classKey = data.class.charAt(0).toUpperCase() + data.class.slice(1);

        if (!SUBCLASS_DATA[classKey]) SUBCLASS_DATA[classKey] = [];
        SUBCLASS_DATA[classKey].push(data);
    }));
}

async function loadAllBackgrounds() {
    const res        = await fetch('/api/backgrounds');
    const classFiles = await res.json();

    await Promise.all(classFiles.map(async fileName => {
        const fileRes = await fetch(`/static_json/backgrounds/${fileName}.json`);
        const data    = await fileRes.json();
        BACKGROUND_DATA[data.name] = data;
    }));
}

async function loadAllRaces() {
    const res        = await fetch('/api/races');
    const classFiles = await res.json();

    await Promise.all(classFiles.map(async fileName => {
        const fileRes = await fetch(`/static_json/races/${fileName}.json`);
        const data    = await fileRes.json();
        RACE_DATA[data.name] = data;
    }));
}

async function loadAllExternalLists() {
    const res        = await fetch('/api/external_lists');
    const classFiles = await res.json();

    await Promise.all(classFiles.map(async fileName => {
        const fileRes = await fetch(`/static_json/external_lists/${fileName}.json`);
        const data    = await fileRes.json();

        if (Array.isArray(data)) {
            data.forEach(entry => {
                EXTERNAL_LISTS[entry.name] = entry.options;
            });
        } else {
            EXTERNAL_LISTS[data.name] = data.options;
        }
    }));
}


/* Race and Background Functions */

let currentPopupField = null;

const overlay      = document.getElementById('popup-overlay');
const popupTitle   = document.getElementById('popup-title');
const popupList    = document.getElementById('popup-list');
const popupDetail  = document.getElementById('popup-detail');
const popupClose   = document.getElementById('popup-close');
const confirmBtn   = document.getElementById('popup-confirm');

let pendingSelection = null; // holds the option object before confirm

function buildLangProfHTML(langProf, itemId) {
    if (!langProf || langProf.length === 0) return '<span>—</span>';

    return langProf.map((entry, i) => {
        if (entry.type === 'fixed') {
            return `<span class="lang-fixed">${entry.value}</span>`;
        }

        const standard = EXTERNAL_LISTS['standard_languages'] ?? [];
        const exotic   = EXTERNAL_LISTS['exotic_languages']   ?? [];

        const options = entry.type === 'standard' ? standard
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

function wireLanguageSelects(container, itemId) {
    const selects = [...container.querySelectorAll(`.lang-select[data-item-id="${itemId}"]`)];

    selects.forEach(sel => {
        sel.addEventListener('change', () => {
            const chosen = new Set(selects.map(s => s.value).filter(v => v !== '— choose —'));

            selects.forEach(other => {
                [...other.options].forEach(opt => {
                    if (opt.value === '— choose —') return;
                    // Disable if chosen by a DIFFERENT select
                    opt.disabled = chosen.has(opt.value) && other.value !== opt.value;
                });
            });
        });
    });
}

function buildToolProfHTML(toolProf, itemId) {
    if (!toolProf || toolProf.length === 0) return '<span>—</span>';

    return toolProf.map((entry, i) => {
        if (entry.type === 'fixed') {
            return `<span class="tool-fixed">${entry.value}</span>`;
        }

        const options = EXTERNAL_LISTS[entry.type] ?? [];
        const optionHTML = ['— choose —', ...options]
            .map(t => `<option value="${t}">${t}</option>`)
            .join('');

        return `<select id="tool_${itemId}_${i}" class="tool-select" data-item-id="${itemId}" data-index="${i}">
                    ${optionHTML}
                </select>`;
    }).join(' ');
}

function wireToolSelects(container, itemId) {
    const selects = [...container.querySelectorAll(`.tool-select[data-item-id="${itemId}"]`)];

    selects.forEach(sel => {
        sel.addEventListener('change', () => {
            const chosen = new Set(selects.map(s => s.value).filter(v => v !== '— choose —'));

            selects.forEach(other => {
                [...other.options].forEach(opt => {
                    if (opt.value === '— choose —') return;
                    // Disable if chosen by a DIFFERENT select
                    opt.disabled = chosen.has(opt.value) && other.value !== opt.value;
                });
            });
        });
    });
}

function openPopup(field) {
    currentPopupField = field;
    pendingSelection  = null;
    confirmBtn.disabled = true;

    const dataset = field === 'race' ? Object.values(RACE_DATA) : Object.values(BACKGROUND_DATA);
    popupTitle.textContent = field === 'race' ? 'Choose a Race' : 'Choose a Background';

    // Race/Background Features
    popupList.innerHTML = '';
    dataset.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('popup-list-item');
        btn.textContent = item.name;

        const hiddenVal = document.getElementById(field).value;
        if (hiddenVal === item.id) {
            btn.classList.add('active');
            showDetail(item);
            pendingSelection = item;
            confirmBtn.disabled = false;
        }

        btn.addEventListener('click', () => {
            popupList.querySelectorAll('.popup-list-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showDetail(item);
            pendingSelection = item;
            confirmBtn.disabled = false;
        });

        popupList.appendChild(btn);
    });

    // If nothing pre-selected, clear detail panel
    if (!pendingSelection) popupDetail.innerHTML = '<p class="popup-placeholder">Select an option to see details.</p>';

    overlay.classList.remove('hidden');
}

function showDetail(item) {
    popupDetail.innerHTML = buildInfoHTML(item);
    if (item.lang_prof) wireLanguageSelects(popupDetail, item.id);
    if (item.tool_prof) wireToolSelects(popupDetail, item.id);
}

function confirmSelection() {
    if (!pendingSelection || !currentPopupField) return;

    document.getElementById(currentPopupField).value = pendingSelection.id;
    const btn = document.getElementById(`${currentPopupField}-btn`);
    btn.textContent = `${pendingSelection.name} ▾`;
    btn.classList.add('has-value');

    if (currentPopupField === 'background') {
        backgroundSkills.clear();
        if (pendingSelection.skill_prof) {
            pendingSelection.skill_prof
                .filter(s => s.prof)
                .forEach(s => backgroundSkills.add(s.skill));
        }
        document.querySelectorAll('.character-class-box').forEach(box => {
            const uid = box.dataset.uid;
            renderClassBox(box, uid);
        });

        // Save chosen languages from the popup selects
        pendingSelection._chosenLanguages = [];
        popupDetail.querySelectorAll('.lang-select').forEach(sel => {
            pendingSelection._chosenLanguages.push(sel.value); // store even '— choose —'
        });
        (pendingSelection.lang_prof || [])
            .filter(e => e.type === 'fixed')
            .forEach(e => pendingSelection._chosenLanguages.push(e.value));

        // Save chosen tools from the popup selects
        pendingSelection._chosenTools = [];
        popupDetail.querySelectorAll('.tool-select').forEach(sel => {
            pendingSelection._chosenTools.push(sel.value);
        });
        (pendingSelection.tool_prof || [])
            .filter(e => e.type === 'fixed')
            .forEach(e => pendingSelection._chosenTools.push(e.value));
    }


    renderSidebarPanel(currentPopupField, pendingSelection);
    overlay.classList.add('hidden');
}

function buildInfoHTML(item) {
    const isBackground = 'skill_prof' in item;

    let metaHTML = '';
    if (isBackground) {
        const skills = item.skill_prof ? item.skill_prof.filter(s => s.prof).map(s => s.skill).join(', ') : '—';
        metaHTML = `
            <div class="popup-meta">
                <span><strong>Skills:</strong> ${skills}</span>
                <span><strong>Tools:</strong> ${buildToolProfHTML(item.tool_prof, item.id)}</span>
                <span><strong>Languages:</strong> ${buildLangProfHTML(item.lang_prof, item.id)}</span>
            </div>`;
    }

    const featuresHTML = item.features.map(f => `
        <div class="popup-feature">
            <div class="popup-feature-name">${f.name}</div>
            <div class="popup-feature-desc">${f.description}</div>
        </div>`).join('');

    return `
        <h2 class="popup-detail-title">${item.name}</h2>
        <p class="popup-detail-desc">${item.description.replace(/\n/g, '<br><br>')}</p>
        ${metaHTML}
        <div class="popup-features-label">Features</div>
        <div class="popup-features-list">${featuresHTML}</div>
    `;
}

function renderSidebarPanel(field, item) {
    const panelId = field === 'race' ? 'race-info-panel' : 'background-info-panel';
    const panel   = document.getElementById(panelId);
    const content = panel.querySelector('.info-panel-content');
    content.innerHTML = buildInfoHTML(item);
    if (item.lang_prof) wireLanguageSelects(content, item.id);
    if (item.tool_prof) wireToolSelects(content, item.id);

    // Restore previously chosen languages
    if (item._chosenLanguages) {
        const selects = [...content.querySelectorAll('.lang-select')];
        selects.forEach((sel, i) => {
            if (item._chosenLanguages[i]) sel.value = item._chosenLanguages[i];
        });
        // Re-run wire so duplicate prevention reflects restored values
        if (item.lang_prof) wireLanguageSelects(content, item.id);
    }

    // Restore previously chosen tools
    if (item._chosenTools) {
        const selects = [...content.querySelectorAll('.tool-select')];
        selects.forEach((sel, i) => {
            if (item._chosenTools[i]) sel.value = item._chosenTools[i];
        });
        // Re-run wire so duplicate prevention reflects restored values
        if (item.tool_prof) wireToolSelects(content, item.id);
    }

    panel.classList.remove('hidden');
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
overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
document.addEventListener('keydown',  e => { if (e.key === 'Escape') closePopup(); });

/* Class Functions */

let classCount = 0;
let boxUid     = 0;
let backgroundSkills = new Set();
let primaryClassUid = null;

function populateClassSelects() {
    document.querySelectorAll('.class-select').forEach(select => {
        const current = select.value;
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
        const radioName = currentWrapper.dataset.radioName;
        const max = parseInt(currentWrapper.dataset.numChoices || '1');
        const checkedHere = currentWrapper.querySelectorAll('input:checked').length;

        // Collect values checked in OTHER wrappers only
        const checkedElsewhere = new Set();
        allWrappers.forEach(other => {
            if (other === currentWrapper) return;
            other.querySelectorAll('input:checked').forEach(cb => checkedElsewhere.add(cb.value));
        });

        currentWrapper.querySelectorAll('input:not(:checked)').forEach(cb => {
            const takenElsewhere = checkedElsewhere.has(cb.value);
            const atLimit = checkedHere >= max;
            cb.disabled = takenElsewhere || atLimit;
        });
    });
}

function buildFeature(level, feature, uid, featureContainer = null) {

    const block = document.createElement('div');
    block.classList.add('feature-block');
    block.dataset.featureName = feature.feature_name;

    const isOptional = feature.optional === true || feature.optional === 'true';

    const title = document.createElement('div');
    title.classList.add('feature-title');
    title.textContent = feature.feature_name;
    block.appendChild(title);

    if (isOptional) {
        const toggle = document.createElement('label');
        toggle.classList.add('optional-toggle');
        const checkbox = document.createElement('input');
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

    // Feature Types
    if (feature.feature_type === 'passive') {
        const desc = document.createElement('div');
        desc.textContent = feature.description ?? '';
        target.appendChild(desc);

    } else if (feature.feature_type === 'modifier') {
        const desc = document.createElement('div');
        desc.textContent = feature.description ?? '';
        target.appendChild(desc);
        block.dataset.statToMod    = feature.stat_to_mod   ?? '';
        block.dataset.modification = feature.modification  ?? '';

    } else if (feature.feature_type === 'asi') {
        const row = document.createElement('div');
        row.classList.add('asi-row');
        const attrs = ['STR','DEX','CON','INT','WIS','CHA'].map(a => `<option>${a}</option>`).join('');
        row.innerHTML = `<span> +1</span><select>${attrs}</select><select>${attrs}</select>`;
        target.appendChild(row);

    } else if (feature.feature_type === 'subclass') {
        if (feature.subclassFeatures && feature.subclassFeatures.length > 0) {
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
            note.style.fontStyle = 'italic';
            note.style.color = '#555';
            note.textContent = 'Feature determined by your subclass choice.';
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
                    : feature.new_value
                    ? parseInt(feature.new_value)
                    : null;

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
                            cb.replaceWith(cb.cloneNode(true));
                        });
                        wrapper.querySelectorAll(`input[name="${radioName}"]`).forEach(cb => {
                            cb.addEventListener('change', () => {
                                enforceExternalChoiceLimit(wrapper, radioName, newMax);
                                syncExternalChoicesAcrossBoxes(listName);
                            });
                        });
                    }
                }

                if (feature.description) {
                    const upgradeNote = document.createElement('div');
                    upgradeNote.classList.add('upgrade-note');
                    upgradeNote.textContent = `[Level ${level} upgrade] ${feature.description}`;
                    prior.appendChild(upgradeNote);
                } else if (feature.new_value) {
                    const upgradeNote = document.createElement('div');
                    upgradeNote.classList.add('upgrade-note');
                    upgradeNote.textContent = `[Level ${level} upgrade] Choices increased to ${feature.new_value}.`;
                    prior.appendChild(upgradeNote);
                }
            }
        }

        const ref = document.createElement('div');
        ref.style.fontStyle = 'italic';
        ref.style.color = '#555';
        ref.textContent = `Upgrades "${feature.feature_to_upgrade}" — see above.`;
        target.appendChild(ref);
    }

    // Feature Subtypes 
    const subtypes = Array.isArray(feature.subtype) ? feature.subtype : [];

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
                const prompt = document.createElement('div');
                prompt.textContent = numChoices > 1 ? `Choose ${numChoices}:` : 'Choose one:';
                target.appendChild(prompt);

                const options = document.createElement('div');
                options.classList.add('feature-options');
                const radioName = `feat_lvl${level}_uid${uid}_choice`;

                (feature.options ?? []).forEach(opt => {
                    const label = document.createElement('label');
                    label.innerHTML = `<input type="radio" name="${radioName}"> ${opt}`;
                    options.appendChild(label);
                });
                target.appendChild(options);
                break;
            }

            case 'external_choice': {
                const list       = EXTERNAL_LISTS[feature.external_list] || [];
                const numChoices = feature.numChoices ?? 1;
                const radioName  = `extchoice_lvl${level}_uid${uid}`;

                block.dataset.externalList = feature.external_list;
                block.dataset.radioName    = radioName;
                block.dataset.numChoices   = numChoices;

                const prompt = document.createElement('div');
                prompt.classList.add('external-choice-prompt');
                prompt.textContent = `Choose ${numChoices}:`;
                target.appendChild(prompt);

                const optionsWrapper = document.createElement('div');
                optionsWrapper.classList.add('external-choice-list');
                optionsWrapper.dataset.listName   = feature.external_list;
                optionsWrapper.dataset.radioName  = radioName;
                optionsWrapper.dataset.numChoices = numChoices;

                list.forEach(option => {
                    const inputType = numChoices === 1 ? 'radio' : 'checkbox';
                    const label = document.createElement('label');
                    label.classList.add('external-choice-item');
                    label.innerHTML = `<input type="${inputType}" name="${radioName}" value="${option.name}"> ${option.name}`;

                    if (option.description) {
                        label.title = option.description;
                        label.classList.add('has-tooltip');
                    }
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
                // Rendered like passive — actual DC calculation handled elsewhere
                if (feature.save_dc != null) {
                    const dc = document.createElement('div');
                    dc.classList.add('feature-save-dc');
                    dc.textContent = `Save DC: ${feature.save_dc}`;
                    target.appendChild(dc);
                }
                break;
            }

            case 'spell_list_addition': {
                // Rendered like passive — spell slot logic handled elsewhere
                if (feature.spells_to_add) {
                    const spellDiv = document.createElement('div');
                    spellDiv.classList.add('feature-spells');
                    const lines = feature.spells_to_add.map(entry => {
                        const [lvl, name] = Object.entries(entry)[0];
                        return `${name} (level ${lvl})`;
                    });
                    spellDiv.textContent = `Spells added: ${lines.join(', ')}`;
                    target.appendChild(spellDiv);
                }
                break;
            }
        }
    });

    return block;
}

function renderFeaturesOnly(box, uid) {
    const selectedClass  = box.querySelector('.class-select').value;
    const selectedLevel  = Math.min(Math.max(parseInt(box.querySelector('.level-input').value) || 1, 1), 20);
    const data           = CLASS_DATA[selectedClass];

    const selectedSub = box.querySelector('.subclass-select').value;
    const subList = SUBCLASS_DATA[selectedClass] || [];
    const subData = subList.find(s => s.name === selectedSub) || null;

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
        const levelGroup = document.createElement('div');
        levelGroup.classList.add('level-group');

        const levelHeader = document.createElement('div');
        levelHeader.classList.add('level-header');
        levelHeader.textContent = `Level ${lvl}`;
        levelGroup.appendChild(levelHeader);

        if (data.features[lvl]) {
            const feats = Array.isArray(data.features[lvl])
                ? data.features[lvl]
                : [data.features[lvl]];

            feats.forEach(feat => {
                const f = { ...feat };
                if (f.feature_type === 'subclass' && subByLevel[lvl]) {
                    subByLevel[lvl].forEach(sf => {
                        levelGroup.appendChild(buildFeature(lvl, sf, uid, featureContainer));
                    });
                } else {
                    levelGroup.appendChild(buildFeature(lvl, f, uid, featureContainer));
                }
                anyFeature = true;
            });
        } else {
            const filler = document.createElement('div');
            filler.classList.add('feature-block');
            filler.innerHTML = `<div style="font-style: italic; color: #555;">No new features at this level.</div>`;
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
        const max = parseInt(wrapper.dataset.numChoices || '1');
        if (max > 1) enforceExternalChoiceLimit(wrapper, radioName, max);
        syncExternalChoicesAcrossBoxes(wrapper.dataset.listName);
    });
}

function renderEquipment(box, uid, savedEquipment = {}) {
    const selectedClass = box.querySelector('.class-select').value;
    const data = CLASS_DATA[selectedClass];
    const container = box.querySelector('.equipment-container');
    container.innerHTML = '';

    if (!data.equipment) return;

    data.equipment.forEach((row, i) => {
        const block = document.createElement('div');
        block.classList.add('feature-block');
        const radioName = `equip_${uid}_${i}`;

        if (row.options.length === 1) {
            const label = document.createElement('div');
            label.textContent = row.options[0];
            block.appendChild(label);
        } else {
            row.options.forEach((opt, j) => {
                const label = document.createElement('label');
                const wasSelected = savedEquipment[radioName] === String(j);
                label.innerHTML = `<input type="radio" name="${radioName}" value="${j}" ${wasSelected ? 'checked' : ''}> 
                                   ${String.fromCharCode(97 + j)}) ${opt}`;
                block.appendChild(label);
            });
        }

        container.appendChild(block);
    });
}

function renderClassBox(box, uid) {
    const selectedClass  = box.querySelector('.class-select').value;
    const selectedLevel  = Math.min(Math.max(parseInt(box.querySelector('.level-input').value) || 1, 1), 20);
    const data           = CLASS_DATA[selectedClass];

    const subclassSelect = box.querySelector('.subclass-select');
    const prevSub = subclassSelect.value;

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
    skillList.innerHTML = '';
    data.skill_prof.forEach(skill => {
        const fromBackground = backgroundSkills.has(skill);
        const label = document.createElement('label');
        const wasChecked = savedSkills.has(skill);
        label.innerHTML = `<input type="checkbox" class="skill-cb" ${fromBackground || wasChecked ? 'checked' : ''} ${fromBackground ? 'disabled' : ''}> ${skill}`;
        if (fromBackground) {
            label.style.opacity = '0.5';
            label.style.cursor = 'not-allowed';
            label.title = 'Granted by background';
        }
        skillList.appendChild(label);
    });
    skillList.querySelectorAll('.skill-cb').forEach(cb => {
        cb.addEventListener('change', () => enforceSkillLimit(skillList, data.numSkills));
    });
    
    enforceSkillLimit(skillList, data.numSkills);

    renderFeaturesOnly(box, uid);
}

async function init() {
    await Promise.all([loadAllClasses(), loadAllSubclasses(), loadAllBackgrounds(), loadAllRaces(), loadAllExternalLists()]).catch(err => console.error('Init failed:', err));;

    document.getElementById('addClassBtn').addEventListener('click', () => {
        classCount++;
        boxUid++;
        const uid = boxUid;

        const template = document.getElementById('classTemplate');
        const clone    = template.content.cloneNode(true);
        clone.querySelector('.class-title').textContent = `Class ${classCount}`;

        clone.querySelector('.remove-btn').addEventListener('click', function () {
            this.closest('.character-class-box').remove();
        });

        const classSelect = clone.querySelector('.class-select');
        classSelect.innerHTML = Object.keys(CLASS_DATA)
            .sort()
            .map(name => `<option value="${name}">${name}</option>`)
            .join('');

        document.getElementById('classContainer').appendChild(clone);
        const box = document.getElementById('classContainer').lastElementChild;
        box.dataset.uid = uid;

        const primaryCb = box.querySelector('.primary-class-cb');
        primaryCb.addEventListener('change', () => {
            if (primaryCb.checked) {
                primaryClassUid = uid;
                
                document.querySelectorAll('.character-class-box').forEach(b => {
                    if (b.dataset.uid != uid) {
                        b.querySelector('.primary-class-cb').checked = false;
                    }
                });
            } else {
                primaryClassUid = null;
            }
        });

        box.querySelector('.class-select').addEventListener('change', () => renderClassBox(box, uid));

        box.querySelector('.level-input').addEventListener('change', () => {
            const input = box.querySelector('.level-input');
            input.value = Math.min(Math.max(parseInt(input.value) || 1, 1), 20);
            renderClassBox(box, uid);
        });
        box.querySelector('.subclass-select').addEventListener('change', () => renderFeaturesOnly(box, uid));
        renderClassBox(box, uid);
    });
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

// Feature choices: radio picks + ASI rows (as generated by your buildFeature())
function getFeatureChoices(box) {
  const features = {};

  // radio feature choices
  Array.from(box.querySelectorAll('input[type="radio"]:checked')).forEach(r => {
    features[r.name] = r.parentElement.textContent.trim().replace(/\s+/g, " ");
  });

  // ASI rows: store the numeric choice and the dropdown picks
  const asi = Array.from(box.querySelectorAll(".asi-row")).map(row => {
    const num = Number(row.querySelector('input[type="number"]')?.value || 0);
    const picks = Array.from(row.querySelectorAll("select")).map(s => s.value);
    return { num, picks };
  });

  return { features, asi };
}

// Build the payload exactly in the structure you described
function buildCharacterPayload() {
  const name = (document.getElementById("character-name")?.value || "").trim();

  const raceObj = getSelectedRaceObj();
  const bgObj = getSelectedBackgroundObj();

  const classes = Array.from(document.querySelectorAll(".character-class-box")).map((box, idx) => {
    const className = box.querySelector(".class-select")?.value || "";
    const subclassName = box.querySelector(".subclass-select")?.value || "";
    const level = Number(box.querySelector(".level-input")?.value || 1);

    const skills = getClassPickedSkills(box);
    const { features, asi } = getFeatureChoices(box);

    const primaryClass = !!box.querySelector(".primary-class-cb")?.checked;

    return {
      id: `class-${idx}`,              // stable per-save
      name: className,
      level,
      skills,                          // class-related skill picks
      decisions: {
        primaryClass,
        features,                      // feature radio choices keyed by radio group name
        asi                            // ASI rows if present
      },
      subclass: {
        id: subclassName || "",        // you can map to a true id later if you have SUBCLASS_DATA ids
        name: subclassName || "",
        decisions: {}
      }
    };
  });

  return {
    name,
    race: raceObj ? { id: raceObj.id, name: raceObj.name, decisions: {} } : null,
    background: bgObj
      ? { id: bgObj.id, name: bgObj.name, skills: getBackgroundSkills(bgObj), decisions: {} }
      : null,
    classes
  };
}


// Save character handler
async function saveCharacter() {
  const payload = buildCharacterPayload();

  // basic validation
  if (!payload.name) {
    alert("Please enter a character name.");
    return;
  }

  // ---------- send to server ----------
  try {
    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || "Failed to save character.");
      return;
    }

    console.log("Character saved to server:", data);
  } catch (err) {
    console.error(err);
    alert("Network error while saving character.");
    return;
  }

  // ---------- download JSON ----------
  const jsonString = JSON.stringify(payload, null, 2);

  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${payload.name.replace(/\s+/g, "_")}_character.json`;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log("Character JSON:", payload);
  alert("Character saved!");
}

// attach the handler
document.getElementById('saveCharacterBtn').addEventListener('click', saveCharacter);


