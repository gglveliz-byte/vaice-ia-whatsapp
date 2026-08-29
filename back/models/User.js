const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    telefonoCompleto: { type: String, required: true, unique: true }, // e.g. +593999123456
    codigoPais: { type: String, required: true }, // e.g. +593
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
