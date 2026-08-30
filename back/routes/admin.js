const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

// Middleware to verify Admin role
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });
    next();
};

// Configure multer for file uploads (we use memory or temp folder, /tmp for Render)
const upload = multer({ dest: '/tmp/csv/' });

// GET /api/admin/users
router.get('/users', auth, isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const usersWithStats = await Promise.all(users.map(async (u) => {
            const sentToday = await Lead.countDocuments({ assignedTo: u._id, status: 'sent', sentAt: { $gte: today } });
            return { ...u.toObject(), sentToday };
        }));

        res.json(usersWithStats);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo usuarios' });
    }
});

// GET /api/admin/stats
router.get('/stats', auth, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const pendingLeads = await Lead.countDocuments({ status: 'pending' });
        const sentLeads = await Lead.countDocuments({ status: 'sent' });
        res.json({ totalUsers, pendingLeads, sentLeads });
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo estadísticas' });
    }
});

// GET /api/admin/leads-summary
router.get('/leads-summary', auth, isAdmin, async (req, res) => {
    try {
        const summary = await Lead.aggregate([
            { 
                $group: { 
                    _id: "$codigoPais", 
                    total: { $sum: 1 }, 
                    sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } } 
                } 
            },
            { $sort: { total: -1 } }
        ]);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo resumen de leads' });
    }
});

// GET /api/admin/template
router.get('/template', auth, isAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        res.json({ 
            plantilla: settings.plantillaMensaje, 
            loteAsignacion: settings.loteAsignacion,
            horaInicio: settings.horaInicio,
            horaFin: settings.horaFin
        });
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo configuración' });
    }
});

// POST /api/admin/template
router.post('/template', auth, isAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();
        
        if (req.body.plantillaMensaje !== undefined) settings.plantillaMensaje = req.body.plantillaMensaje;
        if (req.body.loteAsignacion !== undefined) settings.loteAsignacion = req.body.loteAsignacion;
        if (req.body.horaInicio !== undefined) settings.horaInicio = req.body.horaInicio;
        if (req.body.horaFin !== undefined) settings.horaFin = req.body.horaFin;
        
        await settings.save();
        res.json({ 
            message: 'Configuración actualizada', 
            plantilla: settings.plantillaMensaje, 
            loteAsignacion: settings.loteAsignacion,
            horaInicio: settings.horaInicio,
            horaFin: settings.horaFin
        });
    } catch (err) {
        res.status(500).json({ message: 'Error actualizando configuración' });
    }
});

// POST /api/admin/upload-leads
// Sube un archivo TXT o CSV de números
router.post('/upload-leads', auth, isAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No se subió archivo' });

        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        // Separar solo por saltos de linea
        const lines = fileContent.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 5);
        
        let inserted = 0;
        for (const line of lines) {
            let nombre = '';
            let telefono = '';

            // Si hay coma, asumimos "Nombre, Telefono"
            if (line.includes(',')) {
                const parts = line.split(',');
                nombre = parts[0].trim();
                telefono = parts[1].trim();
            } else {
                telefono = line;
            }

            // Limpiar espacios en el teléfono
            telefono = telefono.replace(/\s+/g, '');

            // Extraer código de país exacto usando libphonenumber-js
            let codigoPais = '+1';
            const numberForParsing = telefono.startsWith('+') ? telefono : '+' + telefono;
            const parsedPhone = parsePhoneNumberFromString(numberForParsing);
            if (parsedPhone) {
                codigoPais = `+${parsedPhone.countryCallingCode}`;
            } else {
                const codigoPaisMatch = telefono.match(/^(\+\d{1,4})/);
                codigoPais = codigoPaisMatch ? codigoPaisMatch[1] : '+1';
            }
            
            // Verifica si ya existe
            const exists = await Lead.findOne({ telefono });
            if (!exists) {
                await Lead.create({ nombre, telefono, codigoPais });
                inserted++;
            }
        }
        
        // Limpiar
        fs.unlinkSync(req.file.path);
        
        res.json({ message: `Se insertaron ${inserted} contactos exitosamente` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error procesando archivo' });
    }
});

// POST /api/admin/liquidation
// Calcula el cierre de caja (reparto) basado en mensajes enviados
router.post('/liquidation', auth, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, fPool, mTarget } = req.body;
        if (!startDate || !endDate || !fPool || !mTarget) {
            return res.status(400).json({ message: 'Faltan parámetros' });
        }

        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        const end = new Date(endDate);
        end.setHours(23,59,59,999);

        const users = await User.find({ role: 'user' });
        let totalPuntosEcosistema = 0;
        const processedUsers = [];

        for (const u of users) {
            const mi = await Lead.countDocuments({ 
                assignedTo: u._id, 
                status: 'sent', 
                sentAt: { $gte: start, $lte: end } 
            });
            const pi = Math.min(1.0, mi / parseFloat(mTarget));
            totalPuntosEcosistema += pi;
            processedUsers.push({
                id: u._id,
                nombre: u.nombre,
                telefonoCompleto: u.telefonoCompleto,
                mi,
                pi
            });
        }

        const fPoolNum = parseFloat(fPool);
        const k = totalPuntosEcosistema > 0 ? (fPoolNum / totalPuntosEcosistema) : 0;
        
        const pagosFinales = processedUsers.map(u => {
            const pagoNeto = u.pi * k;
            return {
                ...u,
                pagoNeto: pagoNeto.toFixed(2)
            };
        });

        pagosFinales.sort((a, b) => parseFloat(b.pagoNeto) - parseFloat(a.pagoNeto));

        res.json({
            totalPuntosEcosistema: totalPuntosEcosistema.toFixed(2),
            k: k.toFixed(2),
            pagosFinales
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al calcular la liquidación' });
    }
});

module.exports = router;
