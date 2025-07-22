// src/backend/ipcHandlers/reporteHandlers.js
const { generarExcelDia, generarExcelRango, generarExcelRecibos } = require('../services/reporteService');
const { shell } = require('electron');

function registerHandlers(ipcMain, db) {
    ipcMain.handle('reporte:excelDia', async (event, tipo) => {
        try {
            const filePath = await generarExcelDia(db, tipo);
            // Abrir el archivo generado
            await shell.openPath(filePath);
            return { success: true, message: `Reporte generado: ${filePath}` };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });

    ipcMain.handle('reporte:excelRango', async (event, {tipoReporte, desde, hasta}) => {
        try {
            const fp = await generarExcelRango(db, tipoReporte, desde, hasta);
            await shell.openPath(fp);
            return { success: true, message: `Reporte generado: ${fp}` };
        } catch(err){
            return { success:false, message: err.message };
        }
    });
    
    ipcMain.handle('reporte:excelRecibos', async (event, { desde, hasta, mostrarAnulados }) => {
        try {
            const filePath = await generarExcelRecibos(db, desde, hasta, mostrarAnulados);
            await shell.openPath(filePath);
            return { success: true, message: `Reporte de recibos generado: ${filePath}` };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });
}

module.exports = { registerHandlers };
