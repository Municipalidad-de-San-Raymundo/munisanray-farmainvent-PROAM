// src/backend/ipcHandlers/dashboardHandlers.js
const dashboardService = require('../services/dashboardService');

function registerHandlers(ipcMain, db) {
    ipcMain.handle('dashboard:stats', async () => {
        try {
            const stats = await dashboardService.obtenerEstadisticas(db);
            return { success: true, stats };
        } catch (err) {
            console.error(err);
            return { success: false, message: err.message };
        }
    });
}

module.exports = { registerHandlers };
