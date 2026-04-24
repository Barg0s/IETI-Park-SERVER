const mongoose = require('mongoose');

const RecordSchema = new mongoose.Schema({
    nickname: { type: String, required: true },
    nivell: { type: Number, required: true },
    temps_segons: { type: Number, required: true },
    jugadors_totals: { type: Number, default: 1 },
    data: { type: Date, default: Date.now }
});

// Index per consultar ràpidament els millors temps per nivell
RecordSchema.index({ nivell: 1, temps_segons: 1 });

module.exports = mongoose.model('Record', RecordSchema);
