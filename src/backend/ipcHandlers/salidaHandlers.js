// src/backend/ipcHandlers/salidaHandlers.js
const salidaService = require('../services/salidaService');

function registerHandlers(ipcMain, db) {
    // Registrar salida
    ipcMain.handle('salidas:registrar', async (event, datos) => {
        try {
            const res = await salidaService.registrarSalida(db, datos);
            return res;
        } catch (err) {
            return { success: false, message: err.message };
        }
    });

    // Medicamentos con stock > 0
    ipcMain.handle('salidas:medicamentosConStock', async () => {
        const sql = `SELECT m.id_medicamento, m.descripcion, COALESCE(SUM(l.cantidad_actual),0) AS stock_total
                     FROM Medicamentos m
                     JOIN Lotes l ON l.id_medicamento = m.id_medicamento
                     GROUP BY m.id_medicamento
                     HAVING stock_total > 0
                     ORDER BY m.descripcion`;
        return new Promise((resolve) => {
            db.all(sql, [], (err, rows) => {
                if (err) return resolve({ success: false, message: err.message });
                resolve({ success: true, items: rows });
            });
        });
    });

    // Lotes con stock de un medicamento
    ipcMain.handle('salidas:lotesPorMedicamento', async (event, idMedicamento) => {
        const sql = `SELECT id_lote, numero_lote, cantidad_actual, fecha_vencimiento, precio_unitario_compra
                     FROM Lotes
                     WHERE id_medicamento = ? AND cantidad_actual > 0
                     ORDER BY fecha_vencimiento`;
        return new Promise((resolve) => {
            db.all(sql, [idMedicamento], (err, rows) => {
                if (err) return resolve({ success: false, message: err.message });
                resolve({ success: true, items: rows });
            });
        });
    });
}

module.exports = { registerHandlers };
