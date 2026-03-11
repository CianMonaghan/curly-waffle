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


async function parseCharacter(charJSON){
    await Promise.all([loadAllClasses(), loadAllSubclasses(), loadAllBackgrounds(), loadAllRaces()]);
    //parse into object
    const input = JSON.parse(charJSON);

    //do math to create character sheet

    //calculate ability scores 
    input.stats.forEach(stat => {
        const abilityScore = stat.raw_score;
        //calculate race asi boosts
        const raceData = Object.values(RACE_DATA).find(r => r.input.race.id === Number(input.race.id))
        for (let i= 0; i<raceData.features.length; i++){
            feature = raceData.features[i];
            if(feature.id.includes("feat-asi")){//if the feature is an ASI booster
                let featureIDSplit = feature.id.split("-")
                if(featureIDSplit[2] === stat.stat.split(0,3).toLowerCase){
                    abilityScore += Number(featureIDSplit[3])
                }
            }
        }
        //calculate class asi boosts
        input.classes.forEach(playerClass => {
            if(playerClass.asi){//if asi list isn't null
                playerClass.asi.forEach(singleASI => {
                    if(singleASI.picks[0] == singleASI.picks[1]){//+2 to one ability score
                        if(singleASI.picks[0] == stat.stat){//if the ability score boosted is the same one we're looking at
                            abilityScore += 2;
                        }
                    } else {//+1 to two ability scores
                        if(singleASI.picks[0] == stat.stat){
                            abilityScore += 1;
                        } else if (singleASI.picks[1] == stat.stat){
                            abilityScore += 1;
                        }
                    }
                })
            }
        })
    });

    //parse race info for speed, size, languages, etc.

    //create object to turn into JSON
    const characterSheet = {
        _id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), //random number (0- (INTMAX-1))
        name: input.name,
        alignment: input.alignment,
        stats: [],
        hitpoints: {
            current_hit_points 
        }
    }
}
//test example
charJSON = {
    "name": "John",
    "alignment": "Neutral",
    "stats": [
        {
            "stat": "Strength",
            "raw_score": 15
        },
        {
            "stat": "Dexterity",
            "raw_score": 14
        },
        {
            "stat": "Constitution",
            "raw_score": 13
        },
        {
            "stat": "Intelligence",
            "raw_score": 12
        },
        {
            "stat": "Wisdom",
            "raw_score": 10
        },
        {
            "stat": "Charisma",
            "raw_score": 8
        }
    ],
    "race": {
        "id": "r-2",
        "name": "Hill Dwarf",
        "decisions": {}
    },
    "background": {
        "id": "b-1",
        "name": "Acolyte",
        "skills": ["Insight","Religion"],
        "decisions": {}
    },
    "classes": [
    {
      "id": "class-0",
      "name": "Fighter",
      "level": 5,
      "skills": [
        "Athletics",
        "Acrobatics"
      ],
      "decisions": {
        "primaryClass": true,
        "features": {
          "equip_1_0": "b) Leather Armor,Longbow,20 Arrows",
          "equip_1_1": "a) Martial Weapon,Shield",
          "equip_1_2": "a) Light Crossbow,20 Bolts",
          "equip_1_3": "a) Dungeoneer's pack",
          "feat_lvl1_uid1": "Defense"
        },
        "asi": [
          {
            "num": 0,
            "picks": [
              "STR",
              "STR"
            ]
          }
        ]
      },
      "subclass": {
        "id": "Champion",
        "name": "Champion",
        "decisions": {}
      }
    }
  ]
}