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