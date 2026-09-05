const mongoose = require('mongoose');
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');

// Definir el esquema para guardar la sesión en MongoDB
const AuthSessionSchema = new mongoose.Schema({
    _id: String,
    data: String
}, { _id: false });

// Usar el modelo si existe, o crearlo
const AuthSession = mongoose.models.AuthSession || mongoose.model('AuthSession', AuthSessionSchema);

/**
 * Adaptador de estado de autenticación para Baileys usando MongoDB.
 * @param {string} sessionId - Identificador único de la sesión (por si queremos múltiples bots a futuro)
 */
const useMongoDBAuthState = async (sessionId = 'default') => {
    
    // Función para escribir un valor a MongoDB
    const writeData = async (data, id) => {
        const json = JSON.stringify(data, BufferJSON.replacer);
        await AuthSession.updateOne(
            { _id: `${sessionId}-${id}` },
            { $set: { data: json } },
            { upsert: true }
        );
    };

    // Función para leer un valor de MongoDB
    const readData = async (id) => {
        try {
            const doc = await AuthSession.findById(`${sessionId}-${id}`);
            if (doc && doc.data) {
                return JSON.parse(doc.data, BufferJSON.reviver);
            }
        } catch (error) {
            console.error('Error leyendo sesión de MongoDB:', error);
        }
        return null;
    };

    // Función para borrar un valor de MongoDB
    const removeData = async (id) => {
        try {
            await AuthSession.deleteOne({ _id: `${sessionId}-${id}` });
        } catch (error) {
            console.error('Error eliminando sesión de MongoDB:', error);
        }
    };

    // Cargar credenciales iniciales (o generar nuevas si no existen)
    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        },
        clearState: async () => {
             await AuthSession.deleteMany({ _id: new RegExp(`^${sessionId}-`) });
             console.log('✅ Sesión de WhatsApp borrada de MongoDB');
        }
    };
};

module.exports = { useMongoDBAuthState, AuthSession };
