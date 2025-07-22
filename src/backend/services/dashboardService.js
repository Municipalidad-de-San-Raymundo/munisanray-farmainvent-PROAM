// src/backend/services/dashboardService.js

/**
 * Devuelve un objeto con diversas métricas para el dashboard.
 * @param {object} db Instancia sqlite
 * @returns {Promise<object>} métricas
 */
function obtenerEstadisticas(db) {
    return new Promise((resolve, reject) => {
        const stats = {};
        db.serialize(() => {
            // Total medicamentos
            db.get(`SELECT COUNT(*) AS total FROM Medicamentos WHERE activo = 1`, [], (err, row) => {
                if (err) return reject(err);
                stats.total_medicamentos = row.total || 0;
            });
            // Próximos a vencer <= 40 días
            db.get(`SELECT COUNT(*) AS proximos FROM Lotes l JOIN Medicamentos m ON m.id_medicamento = l.id_medicamento WHERE m.activo = 1 AND DATE(fecha_vencimiento) <= DATE('now', '+40 day') AND cantidad_actual > 0`, [], (err, row) => {
                if (err) return reject(err);
                stats.proximos_vencer = row.proximos || 0;
            });
            // Agotados stock 0
            db.get(`SELECT COUNT(*) AS agotados FROM (SELECT m.id_medicamento, COALESCE(SUM(l.cantidad_actual),0) AS stock_total FROM Medicamentos m LEFT JOIN Lotes l ON l.id_medicamento = m.id_medicamento WHERE m.activo = 1 GROUP BY m.id_medicamento HAVING stock_total = 0)`, [], (err, row) => {
                if (err) return reject(err);
                stats.agotados = row.agotados || 0;
            });
            // Valor inventario
            db.get(`SELECT ROUND(SUM(cantidad_actual * precio_unitario_compra),2) AS valor FROM Lotes l JOIN Medicamentos m ON m.id_medicamento = l.id_medicamento WHERE m.activo = 1 AND cantidad_actual > 0 AND precio_unitario_compra IS NOT NULL`, [], (err, row) => {
                if (err) return reject(err);
                stats.valor_inventario = row.valor || 0;
            });
            // Por debajo stock minimo
            db.get(`SELECT COUNT(*) AS bajos FROM (SELECT m.id_medicamento, m.stock_minimo, COALESCE(SUM(l.cantidad_actual),0) AS stock_total FROM Medicamentos m LEFT JOIN Lotes l ON l.id_medicamento = m.id_medicamento WHERE m.activo = 1 GROUP BY m.id_medicamento HAVING stock_total < m.stock_minimo)`, [], (err, row) => {
                if (err) return reject(err);
                stats.por_debajo_minimo = row.bajos || 0;
            });
            // Vencidos
            db.get(`SELECT COUNT(*) AS vencidos FROM Lotes l JOIN Medicamentos m ON m.id_medicamento = l.id_medicamento WHERE m.activo = 1 AND DATE(fecha_vencimiento) < DATE('now') AND cantidad_actual > 0`, [], (err, row) => {
                if (err) return reject(err);
                stats.vencidos = row.vencidos || 0;
                resolve(stats);
            });
        });
    });
}

module.exports = {
    obtenerEstadisticas
};
