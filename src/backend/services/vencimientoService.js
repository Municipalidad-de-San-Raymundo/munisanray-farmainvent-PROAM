/**
 * Obtiene los lotes que vencerán dentro de los próximos X días.
 * @param {object} db - instancia de SQLite.
 * @param {number} dias - ventana en días (por defecto 90).
 * @returns {Promise<Array>} array de lotes con datos de medicamento.
 */
function obtenerLotesProximosAVencer(db, dias = 90) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT l.id_lote,
                   m.codigo_medicamento,
                   m.descripcion,
                   l.numero_lote,
                   l.fecha_vencimiento,
                   l.cantidad_actual,
                   CAST((JULIANDAY(l.fecha_vencimiento) - JULIANDAY('now')) AS INTEGER) AS dias_restantes
            FROM Lotes l
            JOIN Medicamentos m ON m.id_medicamento = l.id_medicamento
            WHERE m.activo = 1
              AND l.cantidad_actual > 0
              AND DATE(l.fecha_vencimiento) BETWEEN DATE('now') AND DATE('now', '+' || ? || ' day')
            ORDER BY dias_restantes ASC;`;
        db.all(sql, [dias], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}

module.exports = { obtenerLotesProximosAVencer };
