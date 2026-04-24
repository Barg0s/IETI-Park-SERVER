const mongoose = require('mongoose');

const JugadorSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true },
    color: { type: String, default: 'base' },
    total_partides: { type: Number, default: 0 },
    millor_temps_segons: { type: Number, default: null },
    nivell_maxim_assolit: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Jugador', JugadorSchema);
