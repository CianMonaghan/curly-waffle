const express = require("express");
const path = require('path');
const app = express();
const port = 3000;

/**
 * DATABASE
 * //TODO: create database schema w/ mongoose
 */

const {MongoClient} = require("mongodb");
const mongoose = require("mongoose");
const mongoURL = "mongodb://localhost:27017";
mongoose.connect(mongoURL)
  .then(() => {
    console.log('MongoDB connected successfully!');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
const client = new MongoClient(mongoURL);

const featureSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    description: String,
    trigger: String,
    //TODO: fill in here
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
            num: {type: Number, min: 1, required: true},
            sides: {type: Number, min: 1, required: true}
        },
        twoHand: {
            num: {type: Number, min: 1, required: true},
            sides: {type: Number, min: 1, required: true}
        }
    },
    range: {type: Number, min: 5},
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

const characterSchema = new mongoose.Schema({
    _id: {type: Number, unique: true, required: true},
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
        items: [{}] //only for items,weapons, wonderous items, etc
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

/**
 * ROUTES
 * //TODO: remove .html from pathnames after html update
 */
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
    res.sendFile(path.join(__dirname,'webpages','sheet.html'));
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