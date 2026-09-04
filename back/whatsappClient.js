const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

let qrCodeDataUrl = null;
let isConnected = false;
let client = null;

function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        console.log('NUEVO QR GENERADO (Puppeteer). Escanea en el panel web.');
        try {
            qrCodeDataUrl = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('Error al generar QR:', err);
        }
    });

    client.on('ready', () => {
        console.log('=== CLIENTE WHATSAPP VALIDADOR LISTO (PUPPETEER) ===');
        isConnected = true;
        qrCodeDataUrl = null;
    });

    client.on('authenticated', () => {
        console.log('Autenticado correctamente con sesión guardada.');
    });

    client.on('auth_failure', msg => {
        console.error('Fallo en la autenticación, sesión inválida:', msg);
        cleanAuthAndRestart();
    });

    client.on('disconnected', (reason) => {
        console.log('Cliente desconectado (posible cierre desde el móvil):', reason);
        cleanAuthAndRestart();
    });

    client.initialize().catch(e => {
        console.error('Error fatal al inicializar Puppeteer:', e);
        cleanAuthAndRestart();
    });
}

// Función estricta de auto-limpieza ante cualquier error
function cleanAuthAndRestart() {
    isConnected = false;
    qrCodeDataUrl = null;
    console.log('Iniciando limpieza profunda de sesión corrupta/desconectada...');
    
    try {
        if (client) {
            client.destroy().catch(() => {});
        }
    } catch(e) {}
    
    // Esperar unos segundos a que Puppeteer libere los archivos
    setTimeout(() => {
        try {
            const authPath = path.join(__dirname, '.wwebjs_auth');
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('✅ Carpeta .wwebjs_auth eliminada con éxito (Sesión reseteada a fábrica).');
            }
        } catch(e) {
            console.error('Error eliminando .wwebjs_auth. Puede estar en uso.', e);
        }
        
        console.log('Reiniciando cliente de WhatsApp...');
        initializeClient();
    }, 4000);
}

// Inicializar por primera vez
initializeClient();

const getStatus = () => {
    return {
        isConnected,
        qr: qrCodeDataUrl
    };
};

const isValidWhatsApp = async (phone) => {
    if (!isConnected || !client) {
        throw new Error('El cliente de WhatsApp no está conectado.');
    }
    try {
        const cleanPhone = phone.replace('+', '');
        // whatsapp-web.js comprueba si el número existe en WhatsApp
        const numberId = await client.getNumberId(cleanPhone);
        return numberId ? true : false;
    } catch (err) {
        console.error('Error validando número:', phone, err);
        return false; 
    }
};

module.exports = {
    getStatus,
    isValidWhatsApp
};
