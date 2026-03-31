const express = require("express");
const fs = require('fs');
const path = require('path');
const { parseCharacter } = require('./parseCharacter');
const app = express();
const port = 3000;

app.use(express.json());

/**
 * DATABASE
 * //TODO: create database schema w/ mongoose
 */

const {MongoClient} = require("mongodb");
const mongoose = require("mongoose");
const mongoURL = "mongodb://ciancmonaghan_db_user:TOxkUCEJjQua0RXe@ac-0zx0xa0-shard-00-00.ywjbdxr.mongodb.net:27017,ac-0zx0xa0-shard-00-01.ywjbdxr.mongodb.net:27017,ac-0zx0xa0-shard-00-02.ywjbdxr.mongodb.net:27017/?ssl=true&replicaSet=atlas-2anpto-shard-0&authSource=admin&appName=blite-server";
mongoose.connect(mongoURL)
  .then(() => {
    console.log('MongoDB connected successfully!');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
const client = new MongoClient(mongoURL);
const bliteDB = client.db("bliteDB");
const characters = bliteDB.collection("characters");

const featureSchema = new mongoose.Schema({
    id:          { type: String, unique: true },
    name:        String,
    description: String,
    trigger:     String,
    handler:     { type: String, default: null },                        // dispatch key → featureDispatch
    data:        { type: mongoose.Schema.Types.Mixed, default: null }    // handler parameters
}, {_id: false});

const appliedModSchema = new mongoose.Schema({
    feature_instance_id: {type: String, unique: true},
    source_id: String,
    feature_id: String,
    trigger: String,
    applied: [{
        modification: String,
        reversalData: {}
    }]
}, {_id: false});

const backgroundSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    name: String,
    description: String,
    skill_prof: [{
        skill: String,
        prof: Boolean
    }],
    tool_prof: [String],
    lang_prof: [String],
    features: [featureSchema]
}, { _id: false });

const classSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    name: String,
    caster: Boolean,
    casterStat: String,
    level: { type: Number, min: 0, max: 20, required: true},
    casterLevel: Number,
    class_hp: { type: Number, min: 0, required: true},
    features: [featureSchema],
    skill_prof: [{
        skill: String,
        prof: Boolean
    }],
    saving_throws: [String],
    spell_list: [{
        name: String,
        url: {
            type: String,
            required: true,
            validate: {
                validator: function(v) {
                    // Simple regex for URL validation (can be more complex depending on requirements)
                    return /^(ftp|http|https):\/\/[^ "]+$/.test(v); 
                }
            }
        }
    }]
}, { _id: false });

const raceSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true},
    name: String,
    description: String,
    features: [featureSchema]
}, { _id: false });

const itemSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true},
    local_id: {type: Number, min: 0, required: true},
    name: String,
    description: String,
    equipped: Boolean,
    features_on_obtain: [featureSchema],
    features_on_loss: [featureSchema],
    features_on_equip: [featureSchema],
    features_on_unequip: [featureSchema],
    dice : {
        oneHand: {
            num: {type: Number, min: 0, required: true},
            sides: {type: Number, min: 1, required: true}
        },
        twoHand: {
            num: {type: Number, min: 0, required: true},
            sides: {type: Number, min: 1, required: true}
        }
    },
    range: [],
    primary_stat: [String],
    martial: Boolean,
    improvised: Boolean,
    attack_bonus: Number,
    damage_bonus: Number,
    prof: Boolean,
    attuned: Boolean,
    features_on_attune: [featureSchema],
    features_on_detune: [featureSchema]
}, {_id: false});

const subclassSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true},
    name: String,
    class: String,
    description: String,
    features: [featureSchema]
}, {_id: false});

const characterSchema = new mongoose.Schema({//accountID?
    name: {type: String, required: true},
    alignment: String,
    stats: {type: [{
        stat: {type: String, unique: true, required: true},
        score: {type: Number, min: 0, max: 30, required: true}
    }], required: true },
    hitpoints: {type: [{
        current_hit_points: {type: Number, min: 0, required: true},
        temp_hp: {type: Number, min:0, required: true}
    }], required: true},
    speed: {type: Number, min: 0},
    initiative: Number,
    size: String,
    prof_bonus: {type: Number, min: 2, max: 7},
    saves: {type: [{
        stat:  {type: String, unique: true, required: true},
        save: {type: Number, required: true}
    }], required: true},
    skill_proficiencies: [{ skill: String, expertise: { type: Boolean, default: false } }],
    tool_proficiencies:  [String],
    item_proficiencies:  [String],
    armor_class: {type: Number, min: 1, required: true},
    languages: [String],
    race: raceSchema,
    background: backgroundSchema,
    classes: [classSchema],
    subclasses: [subclassSchema],
    features: [featureSchema],
    inventory: [{
        currency: [{
            currencyName: String,
            amount: {type: Number, min: 0}
        }],
        items: [itemSchema]
    }],
    active_features: [{
        feature: {type: String, unique: true, required: true},
        applied_feature_record: [{
            applied_modifications: [appliedModSchema]
        }]
    }],
    equipped_weapons: [{
        id: {type: String, unique: true, required: true},
        name: String,
        damage: String,
        reference_id: {
            local_id: {type: Number, min: 0, required: true}
        }
    }]
});

const character = mongoose.model("character", characterSchema);
/**
 * ROUTES
 * //TODO: remove .html from pathnames after html update
 */


/* Grab JSON data files */
app.use('/static_json', express.static(path.join(__dirname, 'static_json')));

app.get('/api/classes', (req, res) => {
    const dir = path.join(__dirname, 'static_json\\classes');
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    res.json(files);
});

app.get('/api/subclasses', (req, res) => {
    const dir = path.join(__dirname, 'static_json\\subclasses');
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    res.json(files);
});

app.get('/api/backgrounds', (req, res) => {
    const dir = path.join(__dirname, 'static_json\\backgrounds');
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    res.json(files);
});

app.get('/api/races', (req, res) => {
    const dir = path.join(__dirname, 'static_json\\races');
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    res.json(files);
});

app.get('/api/external_lists', (req, res) => {
    const dir = path.join(__dirname, 'static_json\\external_lists');
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    res.json(files);
});

app.post('/api/characters', async (req, res) => {
    try {
        const characterFile = parseCharacter(req.body);

        // Save locally until MongoDB access is available
        const saveName = (characterFile.name || 'unnamed').replace(/\s+/g, '_');
        const saveDir  = path.join(__dirname, 'parsed_characters');
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);
        const savePath = path.join(saveDir, `${saveName}.json`);
        fs.writeFileSync(savePath, JSON.stringify(characterFile, null, 2));
        console.log(`Character saved locally: ${savePath}`);

        // TODO: swap back to MongoDB when access is granted
        // await characters.insertOne(characterFile);

        return res.status(200).json({ success: true, savedTo: savePath });
    } catch (err) {
        console.error('[POST /api/characters]', err);
        return res.status(500).json({ error: err.message });
    }
});


app.get('/api/characters/:id', async (req, res) => {
    try {
        const char = await character.findById(req.params.id);
        if (!char) return res.status(404).json({ error: 'Not found' });
        res.json(char);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/characters', async (req, res) => {
    try {
        const chars = await character.find({}, 'name race classes'); // lean projection
        res.json(chars);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* Grab webpages */
app.use(express.static(path.join(__dirname, 'webpages')));  // serves CSS, JS, images
app.use(express.static(__dirname));  // fallback for root-level files

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname,'webpages','login.html'));
});

app.get('/account.html', async (req,res)=>{ 
    res.sendFile(path.join(__dirname,'webpages','account.html'));
});

app.get('/character_box.html', async (req,res)=>{
    res.sendFile(path.join(__dirname,'webpages','character_box.html'));
});

app.get('/create_character.html', async (req,res)=>{
    res.sendFile(path.join(__dirname,'webpages','create_character.html'));
});

app.get('/sheet.html', async (req,res)=>{
    //default to first character associated with account if no other character
    if(req.body == null){
        res.sendFile(path.join(__dirname,'webpages','sheet.html'));
    } else {
        //await characters.findOne({name = req.body.name, accountId = req.body.accountId}) //req.body.name will contain the character name of the character we want to find in the server
        //show the sheet with the character info put in
        res.sendFile(path.join(__dirname,'webpages','sheet.html'));
    }
});

app.get('/signup.html', async (req,res)=>{
    res.sendFile(path.join(__dirname,'webpages','signup.html'));
});

/**
 * END ROUTES
 */
app.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
});