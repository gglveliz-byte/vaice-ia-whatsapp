const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');

let qrCodeDataUrl = null;
let isConnected = false;
let sock = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // Silenciar logs extensos
        browser: ['VoiceIA Admin', 'Chrome', '1.0.0']
    });

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
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. ¿Reconectar?', shouldReconnect);
            isConnected = false;
            qrCodeDataUrl = null;
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 2000);
            } else {
                console.log('Te has desconectado manualmente. Reinicia el servidor o borra la carpeta auth_info_baileys para nuevo QR.');
                // Limpiar auth si se deslogueó
                try {
                    fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
                } catch(e) {}
                setTimeout(connectToWhatsApp, 2000);
            }
        } else if (connection === 'open') {
            console.log('=== CLIENTE WHATSAPP VALIDADOR LISTO (BAILEYS) ===');
            isConnected = true;
            qrCodeDataUrl = null; // Limpiar QR
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Inicializar
connectToWhatsApp();

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
        // Baileys devuelve un array con el status del numero. Si existe devuelve [{ exists: true, jid: '...' }]
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
