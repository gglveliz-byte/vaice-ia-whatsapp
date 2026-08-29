const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');

// GET /api/leads
// Obtiene una lista de contactos pendientes para el usuario, basándose en su país
router.get('/', auth, async (req, res) => {
    try {
        const { codigoPais, id: userId } = req.user;
        const settings = await Settings.findOne() || { plantillaMensaje: 'Hola!', loteAsignacion: 50 };
        const limite = settings.loteAsignacion || 50;

        // 1. Buscar leads que YA están asignados a este usuario y siguen pendientes
        let pendingLeads = await Lead.find({ assignedTo: userId, status: 'pending' });

        // 2. Si tiene menos del límite permitido, buscar más leads "huerfanos" (sin asignar)
        if (pendingLeads.length < limite) {
            const needed = limite - pendingLeads.length;
            const newLeads = await Lead.find({ assignedTo: null, codigoPais, status: 'pending' }).limit(needed);
            
            if (newLeads.length > 0) {
                const newLeadIds = newLeads.map(l => l._id);
                // Asignar permanentemente estos leads al usuario
                await Lead.updateMany({ _id: { $in: newLeadIds } }, { assignedTo: userId });
                // Agregarlos a la lista de respuesta
                pendingLeads = [...pendingLeads, ...newLeads];
            }
        }

        const sentLeads = await Lead.find({ assignedTo: userId, status: 'sent' }).sort({ sentAt: -1 }).limit(50);
        
        res.json({ pendingLeads, sentLeads, plantilla: settings.plantillaMensaje });
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
