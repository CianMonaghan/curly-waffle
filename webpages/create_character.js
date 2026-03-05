/*  Beta Classes */

const CLASS_DATA = {};

/*
const CLASS_DATA = {
    Fighter: {
        type: "class",
        numSkills: 2,
        skill_prof: ["Athletics", "Acrobatics", "History", "Insight", "Intimidation", "Perception", "Survival"],
        subclasses: ["Champion", "Battle Master", "Eldritch Knight"],
        features: {
            1: [
                { name: "Fighting Style", type: "choice", options: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"] },
                { name: "Second Wind", type: "resource", uses: "1", description: "You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. \n Once you use this feature, you must finish a short or long rest before you can use it again."},
            ],
            2: { name: "Action Surge", type: "passive", description: "On your turn, you can take one additional action. You can use this once per short or long rest." },
            3: { name: "Martial Archetype", type: "subclass" },
            4: { name: "Ability Score Improvement", type: "asi" },
            5: { name: "Extra Attack", type: "passive", description: "You can attack twice when you take the Attack action on your turn." },
            6: { name: "Ability Score Improvement", type: "asi" },
            7: { name: "Martial Archetype Feature", type: "subclass" },
            8: { name: "Ability Score Improvement", type: "asi" },
            9: { name: "Indomitable", type: "passive", description: "You can reroll a saving throw that you fail. You must use the new roll." },
            10: { name: "Martial Archetype Feature", type: "subclass" },
            11: {},
            12: {},
            13: {},
            14: {},
            15: { name: "Martial Archetype Feature", type: "subclass" },
            16: {},
            17: {},
            18: { name: "Martial Archetype Feature", type: "subclass" },
            19: {},
            20: {}
        }
    },
    Wizard: {
        numSkills: 2,
        skills: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"],
        subclasses: ["School of Evocation", "School of Abjuration", "School of Illusion", "School of Necromancy"],
        features: {
            1: { name: "Arcane Recovery", type: "passive", description: "Once per day during a short rest, you can recover expended spell slots with a combined level equal to half your wizard level (rounded up)." },
            2: { name: "Arcane Tradition", type: "subclass" },
            4: { name: "Ability Score Improvement", type: "asi" },
            6: { name: "Arcane Tradition Feature", type: "subclass" },
            8: { name: "Ability Score Improvement", type: "asi" },
            10: { name: "Arcane Tradition Feature", type: "subclass" },
        }
    },
    Monk: {
        numSkills: 2,
        skills: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"],
        subclasses: ["Way of the Open Hand", "Way of Shadow", "Way of the Four Elements"],
        features: {
            1: { name: "Unarmored Defense", type: "passive", description: "While not wearing armor or wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier." },
            2: { name: "Ki", type: "passive", description: "You have ki points equal to your monk level. You can spend them to fuel Flurry of Blows, Patient Defense, and Step of the Wind. Ki points refresh on a short or long rest." },
            3: { name: "Monastic Tradition", type: "subclass" },
            4: { name: "Ability Score Improvement", type: "asi" },
            5: { name: "Stunning Strike", type: "passive", description: "When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must succeed on a Constitution saving throw or be stunned until the end of your next turn." },
            6: { name: "Monastic Tradition Feature", type: "subclass" },
            7: { name: "Evasion", type: "passive", description: "When subjected to an effect that allows a Dexterity saving throw for half damage, you instead take no damage on a success and half on a failure." },
            8: { name: "Ability Score Improvement", type: "asi" },
            9: { name: "Unarmored Movement Improvement", type: "passive", description: "You can move along vertical surfaces and across liquids on your turn without falling during the move." },
            10: { name: "Monastic Tradition Feature", type: "subclass" },
        }
    },
    Warlock: {
        numSkills: 2,
        skills: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"],
        subclasses: ["The Fiend", "The Great Old One", "The Archfey"],
        features: {
            1: { name: "Otherworldly Patron", type: "subclass" },
            2: { name: "Eldritch Invocations", type: "choice", options: ["Agonizing Blast", "Armor of Shadows", "Beast Speech", "Beguiling Influence", "Devil's Sight", "Eldritch Sight", "Mask of Many Faces", "Misty Visions", "Repelling Blast", "Thief of Five Fates"] },
            3: { name: "Pact Boon", type: "choice", options: ["Pact of the Blade", "Pact of the Chain", "Pact of the Tome"] },
            4: { name: "Ability Score Improvement", type: "asi" },
            5: { name: "Otherworldly Patron Feature", type: "subclass" },
            6: { name: "Otherworldly Patron Feature", type: "subclass" },
            7: { name: "Eldritch Invocation (Additional)", type: "passive", description: "You learn an additional Eldritch Invocation of your choice." },
            8: { name: "Ability Score Improvement", type: "asi" },
            9: { name: "Mystic Arcanum (5th level)", type: "passive", description: "You gain a 5th-level spell from your patron's list as a mystic arcanum, usable once per long rest without expending a spell slot." },
            10: { name: "Otherworldly Patron Feature", type: "subclass" },
        }
    }
};

*/


/* Subclass Beta */

const SUBCLASS_DATA = {
    "Champion": {
        id: "sc-1",
        name: "Champion",
        class: "fighter",
        description: "The archetypal Champion focuses on the development of raw physical power honed to deadly perfection.\nThose who model themselves on this archetype combine rigorous training with physical excellence to deal devastating blows.",
        features: {
            3:  { id: "improved-crit",              name: "Improved Critical",           description: "Your weapon attacks score a critical hit on a roll of 19 or 20." },
            7:  { id: "remarkable-athlete",         name: "Remarkable Athlete",          description: "You can add half your proficiency bonus (rounded up) to any Strength, Dexterity, or Constitution check you make that doesn't already use your proficiency bonus.\nIn addition, when you make a running long jump, the distance you can cover increases by a number of feet equal to your Strength modifier." },
            10: { id: "fighter-fighting-style-add", name: "Additional Fighting Style",   description: "You can choose a second option from the Fighting Style class feature." },
            15: { id: "superior-crit",              name: "Superior Critical",           description: "Your weapon attacks score a critical hit on a roll of 18–20." },
            18: { id: "survivor",                   name: "Survivor",                    description: "At the start of each of your turns, you regain hit points equal to 5 + your Constitution modifier if you have no more than half of your hit points left. You don't gain this benefit if you have 0 hit points." }
        }
    }
    // Add more subclasses here — key must match the subclass name string in CLASS_DATA
};

/*  Race and Background Beta */

const RACE_DATA = [
    {
        id: "r-2",
        name: "Hill Dwarf",
        description: "As a hill dwarf, you have keen senses, deep intuition, and remarkable resilience.\nThe gold dwarves of Faerun in their mighty southern kingdom are hill dwarves, as are the exiled Neidar and the debased Klar of Krynn in the Dragonlance setting.",
        features: [
            { id: "feat-asi-con-2",    name: "Ability Score Increase (CON +2)", description: "Your Constitution score increases by 2." },
            { id: "speed-25-dwarf",    name: "Speed",                           description: "Your base walking speed is 25 feet. Your speed is not reduced by heavy armor." },
            { id: "darkvision-60",     name: "Darkvision",                      description: "You can see in dim light within 60 ft as if bright, and in darkness as if dim. You can't discern color in darkness, only shades of gray." },
            { id: "dwarf-resilience",  name: "Dwarven Resilience",              description: "You have advantage on saving throws against poison, and resistance to poison damage." },
            { id: "dwarf-weapon-prof", name: "Dwarven Weapon Training",         description: "You have proficiency with the battleaxe, handaxe, light hammer, and warhammer." },
            { id: "dwarf-tool-prof",   name: "Tool Proficiency",                description: "You gain proficiency with one artisan's tool of your choice: smith's tools, brewer's supplies, or mason's tools." },
            { id: "stonecunning",      name: "Stonecunning",                    description: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient and add double your proficiency bonus." },
            { id: "dwarf-lang",        name: "Languages",                       description: "You can speak, read, and write Common and Dwarvish." },
            { id: "feat-asi-wis-1",   name: "Ability Score Increase (WIS +1)", description: "Your Wisdom score increases by 1." },
            { id: "dwarf-toughness",  name: "Dwarven Toughness",               description: "Your hit point maximum increases by 1, and it increases by 1 every time you gain a level." },
        ]
    }
];

const BACKGROUND_DATA = [
    {
        id: "b-1",
        name: "Acolyte",
        description: "You have spent your life in the service of a temple to a specific god or pantheon of gods. You act as an intermediary between the realm of the holy and the mortal world, performing sacred rites and offering sacrifices in order to conduct worshipers into the presence of the divine.\nChoose a god, a pantheon of gods, or some other quasi-divine being, and work with your DM to detail the nature of your religious service.",
        skill_prof: [
            { skill: "Insight",   prof: true },
            { skill: "Religion",  prof: true }
        ],
        tool_prof: null,
        lang_prof: ["Language of your choice", "Language of your choice"],
        features: [
            {
                id: "shelter-faithful",
                name: "Shelter of the Faithful",
                description: "As an acolyte, you command the respect of those who share your faith, and you can perform the religious ceremonies of your deity. You and your adventuring companions can expect to receive free healing and care at a temple, shrine, or other established presence of your faith, though you must provide any material components needed for spells."
            }
        ]
    }
];

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

    const dataset = field === 'race' ? RACE_DATA : BACKGROUND_DATA;
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

    // ✅ Update backgroundSkills and refresh all class boxes
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
popupClose.addEventListener('click',  closePopup);
confirmBtn.addEventListener('click',  confirmSelection);
overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
document.addEventListener('keydown',  e => { if (e.key === 'Escape') closePopup(); });


/* Class Functions */

let classCount = 0;
let boxUid     = 0;
let backgroundSkills = new Set();

async function loadAllClasses() {
    const res        = await fetch('/api/classes');
    const classFiles = await res.json();

    await Promise.all(classFiles.map(async fileName => {
        const fileRes = await fetch(`/static_json/classes/${fileName}.json`);
        const data    = await fileRes.json();
        CLASS_DATA[data.name] = data;
    }));
}

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
            <span>+</span>
            <input type="number" min="1" max="2" value="2">
            <select>${attrs}</select>
            <span>or +1</span>
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
                    <div class="subclass-feature-name">${sf.name}</div>
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
    const selectedSub    = box.querySelector('.subclass-select').value;
    const data           = CLASS_DATA[selectedClass];
    const subData        = SUBCLASS_DATA[selectedSub] || null;

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
                if (f.type === 'subclass' && subByLevel[lvl]) {
                    f.subclassFeatures = subByLevel[lvl];
                }
                featureContainer.appendChild(buildFeature(lvl, f, uid));
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
    // Only rebuild subclass options when class changes (preserve selection otherwise)
    const prevSub = subclassSelect.value;
    subclassSelect.innerHTML = data.subclasses.map(s => `<option value="${s}">${s}</option>`).join('');
    if (data.subclasses.includes(prevSub)) subclassSelect.value = prevSub;

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
    await loadAllClasses();

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
  if (typeof RACE_DATA === "undefined") return null;
  return RACE_DATA.find(r => r.id === id) || null;
}

function getSelectedBackgroundObj() {
  const el = document.getElementById("background");
  const id = el ? el.value : "";
  if (typeof BACKGROUND_DATA === "undefined") return null;
  return BACKGROUND_DATA.find(b => b.id === id) || null;
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


//temp save handler
(function attachSaveHandler() {
  const btn = document.getElementById("saveCharacterBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {

    const payload = buildCharacterPayload();

    // basic validation
    if (!payload.name) {
      alert("Please enter a character name.");
      return;
    }

    // convert to formatted JSON
    const jsonString = JSON.stringify(payload, null, 2);

    // create downloadable file
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // create temporary download link
    const a = document.createElement("a");
    a.href = url;
    a.download = `${payload.name.replace(/\s+/g, "_")}_character.json`;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("Character JSON:", payload);
  });
})();


// Wire up the Save button: POST JSON to the server
// (function attachSaveHandler() {
//   const btn = document.getElementById("saveCharacterBtn");
//   if (!btn) return;

//   btn.addEventListener("click", async () => {
//     const payload = buildCharacterPayload();

//     // Minimal validation
//     if (!payload.name) {
//       alert("Please enter a character name.");
//       return;
//     }
//     if (!payload.race || !payload.race.id) {
//       alert("Please select a race.");
//       return;
//     }
//     if (!payload.background || !payload.background.id) {
//       alert("Please select a background.");
//       return;
//     }
//     if (!Array.isArray(payload.classes) || payload.classes.length === 0) {
//       alert("Please add at least one class.");
//       return;
//     }
//     if (payload.classes.some(c => !c.name)) {
//       alert("Please select a class in each class box.");
//       return;
//     }

//     try {
//       const res = await fetch("/api/characters", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload)
//       });

//       const data = await res.json().catch(() => ({}));

//       if (!res.ok) {
//         alert(data.error || "Failed to save character.");
//         return;
//       }

//       alert("Character saved!");
//       // optional redirect:
//       // window.location.href = "account.html";
//     } catch (err) {
//       console.error(err);
//       alert("Network error while saving character.");
//     }
//   });
// })();
