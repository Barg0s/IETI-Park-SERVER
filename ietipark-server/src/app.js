const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('public'));

app.use('/descarga', express.static(path.join('public_qr')));
// Basic Middleware
app.use(express.json());

// Enable CORS for Flutter Web connections
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Simple health-check route
app.get('/', (req, res) => {
    res.send({ status: 'IETI Park Server running (WebSocket mode)' });
});

module.exports = app;
