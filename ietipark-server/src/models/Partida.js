const mongoose = require('mongoose');

const PartidaSchema = new mongoose.Schema({
    data_inici: { type: Date, required: true },
    data_fi: { type: Date, default: null },
    duracio_segons: { type: Number, default: null },
    nivell_completat: { type: Number, default: 0 },
    victoria: { type: Boolean, default: false },
    jugadors_participants: [{ nickname: String, color: String }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Partida', PartidaSchema);
