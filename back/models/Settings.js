const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    plantillaMensaje: { type: String, default: 'Hola, vi tu perfil y me interesa.' },
    loteAsignacion: { type: Number, default: 50 },
    horaInicio: { type: Number, default: 8 },
    horaFin: { type: Number, default: 18 }
});

module.exports = mongoose.model('Settings', settingsSchema);
