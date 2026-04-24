/**
 * Script per poblar la base de dades MongoDB amb dades d'exemple.
 * Executa: node scripts/seedDB.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Nivel = require('../src/models/Nivel');
const Jugador = require('../src/models/Jugador');
const Partida = require('../src/models/Partida');
const Record = require('../src/models/Record');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ietipark';

async function seed() {
    await mongoose.connect(MONGODB_URI);
    console.log('[SEED] Connectat a MongoDB:', MONGODB_URI);

    // Esborrar dades anteriors
    await Promise.all([Nivel.deleteMany(), Jugador.deleteMany(), Partida.deleteMany(), Record.deleteMany()]);
    console.log('[SEED] Col·leccions esborrades');

    // ---- NIVELLS ----
    await Nivel.insertMany([
        {
            num_nivell: 1,
            nom: 'El Parc',
            descripcio: 'Primer nivell amb la clau, l\'obstacle i la porta tancada.',
            mapa_amplada: 800, mapa_alcada: 400,
            te_precipici: false, te_plataforma: false, te_clau: true
        },
        {
            num_nivell: 2,
            nom: 'El Precipici',
            descripcio: 'Segon nivell amb un precipici i una plataforma per creuar.',
            mapa_amplada: 800, mapa_alcada: 400,
            te_precipici: true, te_plataforma: true, te_clau: false
        }
    ]);
    console.log('[SEED] Nivells inserits');

    // ---- JUGADORS ----
    await Jugador.insertMany([
        { nickname: 'PixelHero',  color: 'azul',    total_partides: 5, millor_temps_segons: 142, nivell_maxim_assolit: 2 },
        { nickname: 'Gamer2026',  color: 'rojo',    total_partides: 3, millor_temps_segons: 187, nivell_maxim_assolit: 1 },
        { nickname: 'OwletKing',  color: 'verde',   total_partides: 8, millor_temps_segons: 95,  nivell_maxim_assolit: 2 },
        { nickname: 'DenisGPT',   color: 'amarillo',total_partides: 2, millor_temps_segons: 210, nivell_maxim_assolit: 1 }
    ]);
    console.log('[SEED] Jugadors inserits');

    // ---- PARTIDES ----
    const ara = new Date();
    await Partida.insertMany([
        {
            data_inici: new Date(ara - 3600000),
            data_fi: new Date(ara - 3458000),
            duracio_segons: 142,
            nivell_completat: 2,
            victoria: true,
            jugadors_participants: [
                { nickname: 'PixelHero', color: 'azul' },
                { nickname: 'OwletKing', color: 'verde' }
            ]
        },
        {
            data_inici: new Date(ara - 7200000),
            data_fi: new Date(ara - 7013000),
            duracio_segons: 187,
            nivell_completat: 1,
            victoria: false,
            jugadors_participants: [
                { nickname: 'Gamer2026', color: 'rojo' }
            ]
        }
    ]);
    console.log('[SEED] Partides inserides');

    // ---- RÈCORDS DE TEMPS ----
    await Record.insertMany([
        { nickname: 'OwletKing',  nivell: 1, temps_segons: 45,  jugadors_totals: 2 },
        { nickname: 'PixelHero',  nivell: 1, temps_segons: 68,  jugadors_totals: 2 },
        { nickname: 'Gamer2026',  nivell: 1, temps_segons: 120, jugadors_totals: 1 },
        { nickname: 'OwletKing',  nivell: 2, temps_segons: 97,  jugadors_totals: 2 },
        { nickname: 'PixelHero',  nivell: 2, temps_segons: 142, jugadors_totals: 2 }
    ]);
    console.log('[SEED] Rècords inserits');

    await mongoose.disconnect();
    console.log('[SEED] Fet! Base de dades poblada correctament.');
}

seed().catch(err => { console.error('[SEED] Error:', err); process.exit(1); });
