const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const User = require('../models/User');

// GET /api/leads
// Obtiene una lista de contactos pendientes para el usuario, basándose en su país
router.get('/', auth, async (req, res) => {
    try {
        const { codigoPais, id: userId } = req.user;
        const settings = await Settings.findOne() || { plantillaMensaje: 'Hola!', loteAsignacion: 50, horaInicio: 8, horaFin: 18 };
        
        // Multiplicar capacidad según cantidad de números del vendedor
        const userDb = await User.findById(userId);
        const factorMultiplicador = 1 + (userDb.numerosExtra ? userDb.numerosExtra.length : 0);
        const limite = (settings.loteAsignacion || 50) * factorMultiplicador;

        // 1. Buscar leads que YA están asignados a este usuario y siguen pendientes
        let pendingLeads = await Lead.find({ assignedTo: userId, status: 'pending' });

        // 2. Verificar límite diario basado en la fecha de asignación
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const assignedTodayCount = await Lead.countDocuments({ 
            assignedTo: userId, 
            assignedAt: { $gte: today } 
        });

        // 3. Si se le han asignado hoy menos del límite diario permitido, buscar más
        if (assignedTodayCount < limite) {
            const needed = limite - assignedTodayCount;
            const newLeads = await Lead.find({ assignedTo: null, codigoPais, status: 'pending' }).limit(needed);
            
            if (newLeads.length > 0) {
                const newLeadIds = newLeads.map(l => l._id);
                // Asignar permanentemente estos leads al usuario con fecha de hoy
                await Lead.updateMany({ _id: { $in: newLeadIds } }, { assignedTo: userId, assignedAt: new Date() });
                // Agregarlos a la lista de respuesta
                pendingLeads = [...pendingLeads, ...newLeads];
            }
        }

        const sentLeads = await Lead.find({ assignedTo: userId, status: 'sent' }).sort({ sentAt: -1 }).limit(50);
        
        res.json({ 
            pendingLeads, 
            sentLeads, 
            plantilla: settings.plantillaMensaje,
            horaInicio: settings.horaInicio || 8,
            horaFin: settings.horaFin || 18
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener contactos' });
    }
});

// POST /api/leads/mark-sent/:id
// Marca un contacto como enviado
router.post('/mark-sent/:id', auth, async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Contacto no encontrado' });
        
        if (lead.status === 'sent') return res.status(400).json({ message: 'Ya fue enviado' });

        lead.status = 'sent';
        lead.assignedTo = req.user.id;
        lead.sentAt = new Date();
        await lead.save();

        res.json({ message: 'Marcado como enviado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar contacto' });
    }
});

module.exports = router;
