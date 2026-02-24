/*  Beta Classes */

const CLASS_DATA = {
    Fighter: {
        numSkills: 2,
        skills: ["Athletics", "Acrobatics", "History", "Insight", "Intimidation", "Perception", "Survival"],
        subclasses: ["Champion", "Battle Master", "Eldritch Knight"],
        features: {
            1: { name: "Fighting Style", type: "choice", options: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"] },
            2: { name: "Action Surge", type: "passive", description: "On your turn, you can take one additional action. You can use this once per short or long rest." },
            3: { name: "Martial Archetype", type: "subclass" },
            4: { name: "Ability Score Improvement", type: "asi" },
            5: { name: "Extra Attack", type: "passive", description: "You can attack twice when you take the Attack action on your turn." },
            6: { name: "Ability Score Improvement", type: "asi" },
            7: { name: "Martial Archetype Feature", type: "subclass" },
            8: { name: "Ability Score Improvement", type: "asi" },
            9: { name: "Indomitable", type: "passive", description: "You can reroll a saving throw that you fail. You must use the new roll." },
            10: { name: "Martial Archetype Feature", type: "subclass" },
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

/* Class Functions */

let classCount = 0;
let boxUid = 0;

function enforceSkillLimit(skillList, max) {
    const checked = skillList.querySelectorAll('.skill-cb:checked');
    skillList.querySelectorAll('.skill-cb').forEach(cb => {
        cb.disabled = !cb.checked && checked.length >= max;
    });
}

function buildFeature(level, feature, uid) {
    const block = document.createElement('div');
    block.classList.add('feature-block');

    const title = document.createElement('div');
    title.classList.add('feature-title');
    title.textContent = `Level ${level} – ${feature.name}`;
    block.appendChild(title);

    if (feature.type === 'passive') {
        const desc = document.createElement('div');
        desc.textContent = feature.description ?? '';
        block.appendChild(desc);

    } else if (feature.type === 'choice') {
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

    } else if (feature.type === 'asi') {
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

    } else if (feature.type === 'subclass') {
        const note = document.createElement('div');
        note.style.fontStyle = 'italic';
        note.style.color = '#555';
        note.textContent = 'Feature determined by your subclass choice.';
        block.appendChild(note);
    }

    return block;
}

function renderClassBox(box, uid) {
    const selectedClass = box.querySelector('.class-select').value;
    const selectedLevel = Math.min(Math.max(parseInt(box.querySelector('.level-input').value) || 1, 1), 20);
    const data = CLASS_DATA[selectedClass];

    /* Subclasses */
    const subclassSelect = box.querySelector('.subclass-select');
    subclassSelect.innerHTML = data.subclasses.map(s => `<option value="${s}">${s}</option>`).join('');

    /* Skills */
    const skillList = box.querySelector('.skill-list');
    const skillLabel = box.querySelector('.skill-count-label');
    skillLabel.textContent = `Skills (pick ${data.numSkills}):`;
    skillList.innerHTML = '';
    data.skills.forEach(skill => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="skill-cb"> ${skill}`;
        skillList.appendChild(label);
    });
    skillList.querySelectorAll('.skill-cb').forEach(cb => {
        cb.addEventListener('change', () => enforceSkillLimit(skillList, data.numSkills));
    });

    /* Features */
    const featureContainer = box.querySelector('.feature-container');
    featureContainer.innerHTML = '';

    let anyFeature = false;
    for (let lvl = 1; lvl <= selectedLevel; lvl++) {
        if (data.features[lvl]) {
            featureContainer.appendChild(buildFeature(lvl, data.features[lvl], uid));
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

document.getElementById('addClassBtn').addEventListener('click', () => {
    classCount++;
    boxUid++;
    const uid = boxUid;

    const template = document.getElementById('classTemplate');
    const clone = template.content.cloneNode(true);

    clone.querySelector('.class-title').textContent = `Class ${classCount}`;

    clone.querySelector('.remove-btn').addEventListener('click', function () {
        this.closest('.character-class-box').remove();
    });

    document.getElementById('classContainer').appendChild(clone);

    // Grab the actual DOM node now that it's appended
    const box = document.getElementById('classContainer').lastElementChild;

    box.querySelector('.class-select').addEventListener('change', () => renderClassBox(box, uid));
    box.querySelector('.level-input').addEventListener('change', () => renderClassBox(box, uid));

    renderClassBox(box, uid);
});