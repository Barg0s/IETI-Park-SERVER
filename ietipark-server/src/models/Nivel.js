const mongoose = require('mongoose');

const NivelSchema = new mongoose.Schema({
    num_nivell: { type: Number, required: true, unique: true },
    nom: { type: String, required: true },
    descripcio: { type: String },
    mapa_amplada: { type: Number, default: 800 },
    mapa_alcada: { type: Number, default: 400 },
    te_precipici: { type: Boolean, default: false },
    te_plataforma: { type: Boolean, default: false },
    te_clau: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Nivel', NivelSchema);
