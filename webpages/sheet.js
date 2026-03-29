// Spell List Buttons
let SPELL_DATA = {};

fetch('/static_json/external_lists/spell_list.json')
    .then(res => res.json())
    .then(data => {
        SPELL_DATA = data.spells;
    });

CHARACTER_CLASSES = (char.classes ?? []).flatMap(c => {
    const result = [c.name.toLowerCase()];
    if (c.subclass?.name) result.push(c.subclass.name.toLowerCase());
    return result;
});

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
    if (!document.getElementById('spell-modal-body').hasChildNodes()) {
        buildSpellModal();
    }
    document.getElementById('spell-search').value = '';
    filterSpells();
    modal.style.display = 'block';
}

function openClassSpellListModal() {
    openSpellListModal(); // builds modal and resets search

    document.querySelectorAll('.spell-entry').forEach(entry => {
        const entryClasses = entry.dataset.classes.split(',');
        const matches = entryClasses.some(c => CHARACTER_CLASSES.includes(c));
        entry.style.display = matches ? '' : 'none';
    });

    document.querySelectorAll('.spell-modal-section').forEach(section => {
        const anyVisible = [...section.querySelectorAll('.spell-entry')]
            .some(e => e.style.display !== 'none');
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
    // hide section headings when all their spells are hidden
    document.querySelectorAll('.spell-modal-section').forEach(section => {
        const anyVisible = [...section.querySelectorAll('.spell-entry')]
            .some(e => e.style.display !== 'none');
        section.style.display = anyVisible ? '' : 'none';
    });
}

// Close Spell List when clicking the dark backdrop
document.getElementById('spell-list-modal')
    .addEventListener('click', function(e) {
        if (e.target === this) closeSpellListModal();
    });


//Send character back to character creation screen to make changes
function editCharacter() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) window.location.href = `create_character.html?id=${id}`;
}

// Async Functions

async function loadSheet() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return; // no character selected yet

    const res = await fetch(`/api/characters/${id}`);
    const char = await res.json();

    // Basic info
    document.getElementById('char-name').textContent = char.name;

    // Race / Class / Level
    document.getElementById('race-val').textContent     = char.race?.name ?? '—';
    document.getElementById('class-val').textContent    = char.classes?.[0]?.name ?? '—';
    document.getElementById('subclass-val').textContent = char.classes?.[0]?.subclasses?.[0]?.name ?? '—';
    document.getElementById('level-val').textContent    = char.classes?.[0]?.level ?? 0;

    // Ability scores
    const statOrder = ['STR','DEX','CON','INT','WIS','CHA'];
    const shortNames = ['Str','Dex','Con','Int','Wis','Cha'];
    statOrder.forEach((stat, i) => {
        const entry = char.stats.find(s => s.stat === stat);
        const score = entry?.score ?? 10;
        const mod   = Math.floor((score - 10) / 2);
        document.getElementById(`score-${i}`).textContent = score;
        document.getElementById(`mod-${i}`).textContent   = (mod >= 0 ? '+' : '') + mod;
    });

    // Saving throws
    statOrder.forEach((stat, i) => {
        const save = char.saves.find(s => s.stat === stat);
        document.getElementById(`save-${i}`).textContent = 
            save ? (save.save >= 0 ? '+' : '') + save.save : '+0';
    });

    // Skills, HP, AC
    document.getElementById('hp-current').textContent = char.hitpoints?.[0]?.current_hit_points ?? 0;
    document.getElementById('ac-val').textContent     = char.armor_class ?? 0;
    document.getElementById('speed-val').textContent  = char.speed ?? 0;
    document.getElementById('init-val').textContent   = char.initiative ?? 0;
    document.getElementById('prof-val').textContent   = '+' + (char.prof_bonus ?? 2);
}

loadSheet();