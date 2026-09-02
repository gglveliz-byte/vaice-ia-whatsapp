const express = require('express');
const mongoose = require('mongoose');
const whatsappClient = require('./whatsappClient'); // Inicializa cliente WP
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('<h1>Voice IA Backend is Running</h1><p>Sistema Operativo. Las llamadas API se deben hacer a /api/... </p>');
});

app.get('/api/ping', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Backend is awake' });
});

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/voiceia').then(() => {
    console.log('MongoDB Connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
    console.error('Database connection error:', err);
});
