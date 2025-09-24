// src/backend/ipcHandlers/importacionHandlers.js
const importacionService = require('../services/importacionService');

function registerHandlers(ipcMain, db) {
  // Previsualizar Excel (no altera la BD)
  ipcMain.handle('importacion:previsualizar', async (event, payload) => {
    try {
      if (!payload || !payload.file || !payload.file.dataBase64) {
        return { success: false, message: 'Archivo no proporcionado' };
      }
      const { file, options } = payload;
      const base64 = file.dataBase64;
      const buffer = Buffer.from(base64, 'base64');

      const resultado = await importacionService.previsualizarExcel(db, buffer, options || {});
      return { success: true, ...resultado };
    } catch (error) {
      console.error('Error en previsualización:', error);
      return { success: false, message: error.message };
    }
  });

  // Importar Excel (aplica cambios a la BD y emite progreso)
  ipcMain.handle('importacion:importar', async (event, payload) => {
    try {
      if (!payload || !payload.file || !payload.file.dataBase64) {
        return { success: false, message: 'Archivo no proporcionado' };
      }
      const { file, options } = payload;
      const base64 = file.dataBase64;
      const buffer = Buffer.from(base64, 'base64');

      const webContents = event.sender;
      const onProgress = (prog) => {
        try { webContents.send('importacion:progress', prog); } catch (_) {}
      };

      const resultado = await importacionService.importarExcel(db, buffer, options || {}, onProgress);
      return { success: true, ...resultado };
    } catch (error) {
      console.error('Error al importar:', error);
      return { success: false, message: error.message };
    }
  });

  console.log('Manejadores IPC de importación registrados.');
}

module.exports = { registerHandlers };
