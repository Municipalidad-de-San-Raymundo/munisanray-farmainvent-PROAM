const vencimientoService = require('../services/vencimientoService');

function registerHandlers(ipcMain, db) {
    ipcMain.handle('vencimientos:obtener', async (event, dias = 90) => {
        try {
            const data = await vencimientoService.obtenerLotesProximosAVencer(db, dias);
            return { success: true, data };
        } catch (err) {
            console.error('Error al obtener vencimientos:', err);
            return { success: false, message: err.message };
        }
    });
}

module.exports = { registerHandlers };
