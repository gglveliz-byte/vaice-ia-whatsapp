const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    nombre: { type: String, default: '' },
    telefono: { type: String, required: true },
    codigoPais: { type: String, required: true }, // Extraido o asignado, e.g. +593
    status: { type: String, enum: ['pending', 'sent'], default: 'pending' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Quién lo envió
    assignedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lead', leadSchema);
