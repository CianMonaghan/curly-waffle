const express = require("express");
const path = require('path');
const app = express();
const port = 3000;

/**
 * DATABASE
 * TODO: create database schema w/ mongoose
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

/**
 * ROUTES
 * TODO: remove .html from pathnames after html update
 */
app.get('/', async (req, res) => {
    app.use(express.static(__dirname));
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