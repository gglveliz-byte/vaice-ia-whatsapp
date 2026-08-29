const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Lead = require('./models/Lead');
const Settings = require('./models/Settings');

dotenv.config();

async function checkDB() {
    try {
        console.log("Conectando a la base de datos...");
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log("¡Conectado exitosamente!\n");

        const userCount = await User.countDocuments();
        const users = await User.find().select('nombre telefonoCompleto role');
        
        const leadCount = await Lead.countDocuments();
        
        const settingsCount = await Settings.countDocuments();

        console.log("--- RESULTADOS DE LA BASE DE DATOS 'voiceia' ---");
        console.log(`- Usuarios registrados: ${userCount}`);
        if(userCount > 0) console.log("  Lista:", users);
        console.log(`- Contactos (Leads) guardados: ${leadCount}`);
        console.log(`- Configuraciones guardadas: ${settingsCount}`);
        
    } catch (err) {
        console.error("Error al conectar o consultar:", err);
    } finally {
        await mongoose.connection.close();
    }
}

checkDB();
