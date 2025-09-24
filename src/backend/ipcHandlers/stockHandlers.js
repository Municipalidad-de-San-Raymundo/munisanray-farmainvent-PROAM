// src/backend/ipcHandlers/stockHandlers.js
const stockService = require('../services/stockService');

/**
 * Registra manejadores IPC para la vista "sin stock".
 * @param {Electron.IpcMain} ipcMain
 * @param {object} db Instancia de SQLite
 */
function registerHandlers(ipcMain, db) {
    ipcMain.handle('stock:obtenerBajo', async () => {
        try {
            const data = await stockService.obtenerMedicamentosBajoStock(db);
            return { success: true, data };
        } catch (err) {
            console.error('Error al obtener medicamentos bajo stock:', err);
            return { success: false, message: err.message };
        }
    });

    ipcMain.handle('stock:excel', async () => {
        try {
            const file = await stockService.generarExcelBajoStock(db);
            const { shell } = require('electron');
            await shell.openPath(file);
            return { success:true, message:`Excel generado: ${file}` };
        } catch(err){
            return { success:false, message: err.message };
        }
    });
}

module.exports = { registerHandlers };
