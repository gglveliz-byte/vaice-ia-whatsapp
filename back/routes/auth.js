const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { nombre, telefonoCompleto, password } = req.body;
        
        let user = await User.findOne({ telefonoCompleto });
        if (user) return res.status(400).json({ message: 'El usuario ya existe' });

        // Extraer código de país (asumiendo formato +XXX...)
        const codigoPaisMatch = telefonoCompleto.match(/^(\+\d{1,4})/);
        const codigoPais = codigoPaisMatch ? codigoPaisMatch[1] : '+1';

        // Hacer admin al primer usuario
        const isFirst = (await User.countDocuments()) === 0;

        user = new User({
            nombre,
            telefonoCompleto,
            codigoPais,
            password,
            role: isFirst ? 'admin' : 'user'
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        res.status(201).json({ message: 'Registro exitoso' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { telefonoCompleto, password } = req.body;
        
        const user = await User.findOne({ telefonoCompleto });
        if (!user) return res.status(400).json({ message: 'Credenciales inválidas' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Credenciales inválidas' });

        const payload = { id: user.id, role: user.role, codigoPais: user.codigoPais };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '365d' });

        res.json({ token, user: { nombre: user.nombre, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

module.exports = router;
