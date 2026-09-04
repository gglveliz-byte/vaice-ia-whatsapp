const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

let qrCodeDataUrl = null;
let isConnected = false;
let sock = null;

async function initializeClient() {
    const authDir = path.join(__dirname, '.auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

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
                initializeClient();
            } else {
                console.log('Sesión cerrada o inválida. Limpiando caché de Baileys...');
                cleanAuthAndRestart();
            }
        } else if (connection === 'open') {
            console.log('=== CLIENTE WHATSAPP VALIDADOR LISTO (BAILEYS) ===');
            isConnected = true;
            qrCodeDataUrl = null;
        }
    });
}

function cleanAuthAndRestart() {
    isConnected = false;
    qrCodeDataUrl = null;
    sock = null;
    
    try {
        const authDir = path.join(__dirname, '.auth_info_baileys');
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('✅ Carpeta .auth_info_baileys eliminada con éxito.');
        }
    } catch(e) {
        console.error('Error eliminando caché de Baileys:', e);
    }
    
    setTimeout(() => {
        initializeClient();
    }, 2000);
}

initializeClient();

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
