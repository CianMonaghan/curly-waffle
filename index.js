const express = require("express");
const fs = require('fs');
const path = require('path');
const { parseCharacter } = require('./parseCharacter');
const app = express();
const port = 3000;
require('dotenv').config();

app.use(express.json());

/**
 * DATABASE
 * //TODO: create database schema w/ mongoose
 */

const {MongoClient} = require("mongodb");
const mongoose = require("mongoose");
const mongoURL = process.env.BLITE_DB;
mongoose.connect(mongoURL, { dbName: 'bliteDB' })
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
    data:        { type: mongoose.Schema.Types.Mixed, default: null },   // handler parameters
    source_id:   String                                                  // which race/class/bg/item added this
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

const characterSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: {type: String, required: true},
    alignment: String,
    stats: {type: [{
        stat:      { type: String, required: true },
        base:      { type: Number, required: true },
        modifiers: [{
            source_id: String,
            type:      { type: String, enum: ['add', 'set'] },
            value:     Number
        }],
        score:     { type: Number, required: true }   // computed from base + modifiers
    }], required: true },
    hitpoints: {type: [{
        current_hit_points: {type: Number, min: 0, required: true},
        temp_hp: {type: Number, min:0, required: true}
    }], required: true},
    size: String,
    prof_bonus: {type: Number, min: 2, max: 7},
    saves: {type: [{
        stat:  {type: String, unique: true, required: true},
        save: {type: Number, required: true}
    }], required: true},
    skill_proficiencies: [{ skill: String, expertise: { type: Boolean, default: false }, source_id: String }],
    tool_proficiencies:  [{ tool: String, source_id: String }],
    item_proficiencies:  [{ item: String, source_id: String }],
    ac_modifiers: [{
        source_id: String,
        type:      { type: String, enum: ['set', 'add'] },
        value:     Number
    }],
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
    equipped_armor: {
        body:   { type: String, default: null },
        shield: { type: String, default: null }
    },
    attuned_items: [{
        item_id: String,
        name:    String
    }],
    attuned_cap: { type: Number, default: 3 },
    equipped_weapons: [{
        slot:       String,   // "main_hand" | "off_hand" | "two_hand"
        item_id:    String,
        feature_id: String,
        name:       String,
        damage:     String,
        mode:       String    // "melee" | "ranged"
    }]
});

/* Account Connection */
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

app.use(session({
    secret: process.env.SESSION_SECRET || 'blite-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoURL, dbName: 'bliteDB' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    next();
}

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        const existing = await User.findOne({ username });
        if (existing) return res.status(409).json({ error: 'Username already taken' });
        const hash = await bcrypt.hash(password, 12);
        const user = await User.create({ username, password: hash });
        req.session.userId = user._id;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid username or password' });
        req.session.userId = user._id;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    res.json({ userId: req.session.userId });
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

app.get('/api/items', (req, res) => {
    const baseDir = path.join(__dirname, 'static_json', 'items');
    const items = [];
    function scanDir(dir) {
        for (const f of fs.readdirSync(dir)) {
            const full = path.join(dir, f);
            if (fs.statSync(full).isDirectory()) {
                scanDir(full);
            } else if (f.endsWith('.json') && !f.includes('template')) {
                try { items.push(JSON.parse(fs.readFileSync(full, 'utf8'))); } catch {}
            }
        }
    }
    scanDir(baseDir);
    res.json(items);
});


/* Grab specific things from characters */
app.patch('/api/characters/:id/hitpoints', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const { current_hit_points, temp_hp } = req.body;
        const update = {};
        if (current_hit_points !== undefined) update['hitpoints.current_hit_points'] = current_hit_points;
        if (temp_hp             !== undefined) update['hitpoints.temp_hp']            = temp_hp;
        await characters.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/hit_dice', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { hit_dice_current: req.body.current } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/inspiration', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { inspiration: req.body.inspiration } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/notes', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { notes: req.body.notes } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/spell_slots', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const { level, current } = req.body;
        const char = await characters.findOne({ _id: new ObjectId(req.params.id) });
        if (!char) return res.status(404).json({ error: 'Not found' });

        const idx = (char.spell_slots ?? []).findIndex(s => s.level === level);
        if (idx === -1) return res.status(404).json({ error: 'Slot level not found' });

        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { [`spell_slots.${idx}.current`]: current } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/pact_slots', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const { level, current } = req.body;
        const char = await characters.findOne({ _id: new ObjectId(req.params.id) });
        if (!char) return res.status(404).json({ error: 'Not found' });

        const idx = (char.pact_slots ?? []).findIndex(s => s.level === level);
        if (idx === -1) return res.status(404).json({ error: 'Slot level not found' });

        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { [`pact_slots.${idx}.current`]: current } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/inventory/items/quantity', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const char = await characters.findOne({ _id: new ObjectId(req.params.id) });
        if (!char) return res.status(404).json({ error: 'Not found' });

        const invIsArray = Array.isArray(char.inventory);
        const inv = invIsArray ? char.inventory[0] : char.inventory;
        const items = inv?.items ?? [];
        const { _uid, name, type, quantity } = req.body;

        const idx = items.findIndex(i =>
            (_uid && i._uid === _uid) ||
            (!_uid && i.name === name && (type ? i.type === type : true))
        );
        if (idx === -1) return res.status(404).json({ error: 'Item not found' });

        const basePath = invIsArray ? `inventory.0.items.${idx}.quantity` : `inventory.items.${idx}.quantity`;
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { [basePath]: quantity } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/inventory/items', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { 'inventory.items': req.body } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/equipped_weapons', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { equipped_weapons: req.body } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/characters/:id/inventory/items', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const char = await characters.findOne({ _id: new ObjectId(req.params.id) });
        if (!char) return res.status(404).json({ error: 'Not found' });

        const invIsArray = Array.isArray(char.inventory);
        const inv = invIsArray ? char.inventory[0] : char.inventory;
        const items = inv?.items ?? [];
        const { _uid, name, type } = req.body;

        const idx = items.findIndex(i =>
            (_uid && i._uid === _uid) ||
            (!_uid && i.name === name && (type ? i.type === type : true))
        );
        if (idx === -1) return res.json({ success: true });

        const basePath = invIsArray ? 'inventory.0.items' : 'inventory.items';
        await characters.updateOne({ _id: new ObjectId(req.params.id) }, { $unset: { [`${basePath}.${idx}`]: 1 } });
        await characters.updateOne({ _id: new ObjectId(req.params.id) }, { $pull:  { [basePath]: null } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/characters/:id/equipped_weapons', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const char = await characters.findOne({ _id: new ObjectId(req.params.id) });
        if (!char) return res.status(404).json({ error: 'Not found' });

        const weapons = char.equipped_weapons ?? [];
        const { _uid, item_id, name } = req.body;

        const idx = weapons.findIndex(w =>
            (_uid && w._uid === _uid) ||
            (!_uid && item_id && w.item_id === item_id && w.name === name) ||
            (!_uid && !item_id && w.name === name)
        );
        if (idx === -1) return res.json({ success: true });

        await characters.updateOne({ _id: new ObjectId(req.params.id) }, { $unset: { [`equipped_weapons.${idx}`]: 1 } });
        await characters.updateOne({ _id: new ObjectId(req.params.id) }, { $pull:  { equipped_weapons: null } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/characters/:id/chosen_spells', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const { name, level } = req.body;
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { chosen_spells: { name, level } } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/characters/:id/chosen_spells', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const { name, level } = req.body;
        await characters.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $pull: { chosen_spells: { name, level } } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/characters', requireAuth, async (req, res) => {
    try {
        const characterFile = parseCharacter(req.body);
        characterFile.form_data = req.body;  // store original decisions
        const { ObjectId } = require('mongodb');
        characterFile.userId = new ObjectId(req.session.userId);

        // Save to MongoDB
        await characters.insertOne(characterFile);

        // ── Local debug save ─────────────────────────────────────────────────
        // Comment out the four lines below to stop writing to parsed_characters/
        const saveName = (characterFile.name || 'unnamed').replace(/\s+/g, '_');
        const saveDir  = path.join(__dirname, 'parsed_characters');
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);
        const savePath = path.join(saveDir, `${saveName}.json`);
        fs.writeFileSync(savePath, JSON.stringify(characterFile, null, 2));
        console.log(`Character saved locally: ${savePath}`);
        // ────────────────────────────────────────────────────────────────────

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('[POST /api/characters]', err);
        return res.status(500).json({ error: err.message });
    }
});


app.get('/api/characters/:id', requireAuth, async (req, res) => {
    try {
        const char = await character.findById(req.params.id);
        if (!char) return res.status(404).json({ error: 'Not found' });
        res.json(char);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/characters', requireAuth, async (req, res) => {
    try {
        const chars = await character.find({ userId: req.session.userId }, 'name race classes');
        res.json(chars);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/characters/:id', requireAuth, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const chars = await character.find({ userId: new ObjectId(req.session.userId) }, 'name race classes');
        const existing = await characters.findOne({ _id: new ObjectId(req.params.id) });
        if (!existing) return res.status(404).json({ error: 'Not found' });

        const rebuilt = parseCharacter(req.body);
        rebuilt.form_data = req.body;

        // Preserve sheet-level fields that live outside character creation
        for (const field of ['hitpoints', 'spell_slots', 'pact_slots', 'chosen_spells',
                             'hit_dice_current', 'notes', 'inspiration']) {
            if (existing[field] !== undefined) rebuilt[field] = existing[field];
        }

        await characters.replaceOne({ _id: new ObjectId(req.params.id) }, rebuilt);
        res.json({ success: true });
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