const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    plantillaMensaje: { type: String, default: 'Hola, vi tu perfil y me interesa.' },
    loteAsignacion: { type: Number, default: 50 }
});

module.exports = mongoose.model('Settings', settingsSchema);
