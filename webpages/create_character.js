const CLASS_DATA = {};
const SUBCLASS_DATA = {};
const BACKGROUND_DATA = {};
const RACE_DATA = {};

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


/* Race and Background Functions */

let currentPopupField = null;

const overlay      = document.getElementById('popup-overlay');
const popupTitle   = document.getElementById('popup-title');
const popupList    = document.getElementById('popup-list');
const popupDetail  = document.getElementById('popup-detail');
const popupClose   = document.getElementById('popup-close');
const confirmBtn   = document.getElementById('popup-confirm');

let pendingSelection = null; // holds the option object before confirm

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
        // Refresh all class skill lists to reflect new background
        document.querySelectorAll('.character-class-box').forEach(box => {
            const uid = box.dataset.uid;
            renderClassBox(box, uid);
        });
    }

    renderSidebarPanel(currentPopupField, pendingSelection);
    overlay.classList.add('hidden');
}

function buildInfoHTML(item) {
    const isBackground = 'skill_prof' in item;

    let metaHTML = '';
    if (isBackground) {
        const skills = item.skill_prof ? item.skill_prof.filter(s => s.prof).map(s => s.skill).join(', ') : '—';
        const tools  = item.tool_prof  ? item.tool_prof : '—';
        const langs  = item.lang_prof  ? item.lang_prof.join(', ') : '—';
        metaHTML = `
            <div class="popup-meta">
                <span><strong>Skills:</strong> ${skills}</span>
                <span><strong>Tools:</strong> ${tools}</span>
                <span><strong>Languages:</strong> ${langs}</span>
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
    const panelId  = field === 'race' ? 'race-info-panel' : 'background-info-panel';
    const panel    = document.getElementById(panelId);
    const content  = panel.querySelector('.info-panel-content');
    content.innerHTML = buildInfoHTML(item);
    panel.classList.remove('hidden');
}

function closePopup() {
    overlay.classList.add('hidden');
    currentPopupField = null;
    pendingSelection  = null;
}


document.getElementById('race-btn').addEventListener('click',       () => openPopup('race'));
document.getElementById('background-btn').addEventListener('click', () => openPopup('background'));
document.getElementById('saveCharacterBtn').addEventListener('click', saveCharacter);
popupClose.addEventListener('click',  closePopup);
confirmBtn.addEventListener('click',  confirmSelection);
overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
document.addEventListener('keydown',  e => { if (e.key === 'Escape') closePopup(); });

/* Class Functions */

let classCount = 0;
let boxUid     = 0;
let backgroundSkills = new Set();

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

function buildFeature(level, feature, uid) {
    const block = document.createElement('div');
    block.classList.add('feature-block');

    const title = document.createElement('div');
    title.classList.add('feature-title');
    title.textContent = `Level ${level} – ${feature.feature_name}`;
    block.appendChild(title);

    if (feature.feature_type === 'passive') {
        const desc = document.createElement('div');
        desc.textContent = feature.description ?? '';
        block.appendChild(desc);
    } else if (feature.feature_type === 'resource') {
        const desc = document.createElement('div');
        desc.textContent = feature.description ?? '';
        block.appendChild(desc);
    } else if (feature.feature_type === 'choice') {
        const prompt = document.createElement('div');
        prompt.textContent = 'Select one:';
        block.appendChild(prompt);
        const options = document.createElement('div');
        options.classList.add('feature-options');
        const radioName = `feat_lvl${level}_uid${uid}`;
        feature.options.forEach(opt => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="radio" name="${radioName}"> ${opt}`;
            options.appendChild(label);
        });
        block.appendChild(options);
    } else if (feature.feature_type === 'asi') {
        const row = document.createElement('div');
        row.classList.add('asi-row');
        const attrs = ['STR','DEX','CON','INT','WIS','CHA'].map(a => `<option>${a}</option>`).join('');
        row.innerHTML = `
            <span> +1</span>
            <select>${attrs}</select>
            <select>${attrs}</select>
        `;
        block.appendChild(row);
    } else if (feature.feature_type === 'subclass') {
        if (feature.subclassFeatures && feature.subclassFeatures.length > 0) {
            feature.subclassFeatures.forEach(sf => {
                const sfBlock = document.createElement('div');
                sfBlock.classList.add('subclass-feature-block');
                sfBlock.innerHTML = `
                    <div class="subclass-feature-name">${sf.feature_name}</div>
                    <div class="subclass-feature-desc">${sf.description.replace(/\n/g, '<br><br>')}</div>
                `;
                block.appendChild(sfBlock);
            });
        } else {
            const note = document.createElement('div');
            note.style.fontStyle = 'italic';
            note.style.color = '#555';
            note.textContent = 'Feature determined by your subclass choice.';
            block.appendChild(note);
        }
    }

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
        subByLevel[parseInt(lvl)] = [f];
        });
    }

    const featureContainer = box.querySelector('.feature-container');
    featureContainer.innerHTML = '';
    let anyFeature = false;
    for (let lvl = 1; lvl <= selectedLevel; lvl++) {
        if (data.features[lvl]) {
            const feats = Array.isArray(data.features[lvl])
                ? data.features[lvl]
                : [data.features[lvl]];

            feats.forEach(feat => {
            const f = { ...feat };
            if (f.feature_type === 'subclass' && subByLevel[lvl]) {
                // Call buildFeature for each subclass feature directly
                subByLevel[lvl].forEach(sf => {
                    featureContainer.appendChild(buildFeature(lvl, sf, uid));
                });
            } else {
                featureContainer.appendChild(buildFeature(lvl, f, uid));
            }
            anyFeature = true;
        });
        } else {
            const filler = document.createElement('div');
            filler.classList.add('feature-block');
            filler.innerHTML = `
                <div class="feature-title">Level ${lvl}</div>
                <div style="font-style: italic; color: #555;">No new features at this level.</div>
            `;
            featureContainer.appendChild(filler);
            anyFeature = true;
        }
    }
    if (!anyFeature) {
        const msg = document.createElement('div');
        msg.classList.add('no-features-msg');
        msg.textContent = 'No features at this level.';
        featureContainer.appendChild(msg);
    }
}

function renderEquipment(box, uid) {
    const selectedClass = box.querySelector('.class-select').value;
    const data = CLASS_DATA[selectedClass];
    const container = box.querySelector('.equipment-container');
    container.innerHTML = '';

    if (!data.equipment) return;

    data.equipment.forEach((row, i) => {
        const block = document.createElement('div');
        block.classList.add('feature-block');
        row.options.forEach((opt, j) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="radio" name="equip_${uid}_${i}" value="${j}"> 
                               ${String.fromCharCode(97 + j)}) ${opt}`;
            block.appendChild(label);
        });
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
    subclassSelect.innerHTML = available.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    if (available.find(s => s.name === prevSub)) subclassSelect.value = prevSub;

    renderEquipment(box, uid);

    const skillList  = box.querySelector('.skill-list');
    const skillLabel = box.querySelector('.skill-count-label');
    skillLabel.textContent = `Skills (pick ${data.numSkills}):`;
    skillList.innerHTML = '';
    data.skill_prof.forEach(skill => {
        const fromBackground = backgroundSkills.has(skill);
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="skill-cb" ${fromBackground ? 'checked disabled' : ''}> ${skill}`;
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

    renderFeaturesOnly(box, uid);
}

async function init() {
    await Promise.all([loadAllClasses(), loadAllSubclasses(), loadAllBackgrounds(), loadAllRaces()]);

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
            .map(name => `<option value="${name}">${name}</option>`)
            .join('');

        document.getElementById('classContainer').appendChild(clone);
        const box = document.getElementById('classContainer').lastElementChild;
        box.dataset.uid = uid;
        box.querySelector('.class-select').addEventListener('change', () => renderClassBox(box, uid));
        box.querySelector('.level-input').addEventListener('change',  () => renderClassBox(box, uid));
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


