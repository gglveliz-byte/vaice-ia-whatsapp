const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { useMongoDBAuthState, AuthSession } = require('./mongoAuthState');
const qrcode = require('qrcode');

let qrCodeDataUrl = null;
let isConnected = false;
let sock = null;

async function initializeClient() {
    const { state, saveCreds } = await useMongoDBAuthState('voiceia');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('NUEVO QR GENERADO (Baileys). Escanea en el panel web.');
            try {
                qrCodeDataUrl = await qrcode.toDataURL(qr);
            } catch (err) {
                console.error('Error al generar QR:', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. ¿Debe reconectar?', shouldReconnect);
            
            isConnected = false;
            qrCodeDataUrl = null;

            if (shouldReconnect) {
                setTimeout(initializeClient, 5000); // 5 seg de delay
            } else {
                console.log('Sesión cerrada o inválida. Limpiando sesión en MongoDB...');
                cleanAuthAndRestart();
            }
        } else if (connection === 'open') {
            console.log('=== CLIENTE WHATSAPP VALIDADOR LISTO (BAILEYS) ===');
            isConnected = true;
            qrCodeDataUrl = null;
        }
    });
}

async function cleanAuthAndRestart() {
    isConnected = false;
    qrCodeDataUrl = null;
    sock = null;
    
    try {
        await AuthSession.deleteMany({ _id: new RegExp('^voiceia-') });
        console.log('✅ Sesión de WhatsApp borrada de MongoDB con éxito.');
    } catch(e) {
        console.error('Error eliminando caché de Baileys:', e);
    }
    
    setTimeout(() => {
        initializeClient();
    }, 5000);
}

// Retrasar inicio hasta que mongoose esté conectado desde server.js
setTimeout(initializeClient, 3000);

const getStatus = () => {
    return {
        isConnected,
        qr: qrCodeDataUrl
    };
};

const isValidWhatsApp = async (phone) => {
    if (!isConnected || !sock) {
        throw new Error('El cliente de WhatsApp no está conectado.');
    }
    try {
        const cleanPhone = phone.replace('+', '');
        const [result] = await sock.onWhatsApp(cleanPhone);
        return result && result.exists ? true : false;
    } catch (err) {
        console.error('Error validando número:', phone, err);
        return false; 
    }
};

module.exports = {
    getStatus,
    isValidWhatsApp
};
