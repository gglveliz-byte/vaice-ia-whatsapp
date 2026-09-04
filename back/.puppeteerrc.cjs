const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Cambia la ubicación de la caché de Puppeteer al directorio del proyecto.
  // Esto es obligatorio para que funcione correctamente en servidores gratuitos como Render o Heroku.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
