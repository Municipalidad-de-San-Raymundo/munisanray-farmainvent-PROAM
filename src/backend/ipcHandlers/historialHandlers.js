// src/backend/ipcHandlers/historialHandlers.js
const historialService = require('../services/historialService');

function registerHandlers(ipcMain, db) {
    ipcMain.handle('historial:obtener', async (event, {page = 1, limit = 20, tipo = null} = {}) => {
        try {
            const offset = (page - 1) * limit;
            const res = await historialService.obtenerMovimientos(db, limit, offset, tipo);
            return { success: true, ...res };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });
}

module.exports = { registerHandlers };
