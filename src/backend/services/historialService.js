// src/backend/services/historialService.js

/**
 * Obtiene movimientos con join a medicamento y lote.
 * @param {object} db instancia sqlite
 * @param {number} limit cantidad por página
 * @param {number} offset desplazamiento
 * @param {string|null} tipo 'Entrada'|'Salida'|null
 * @returns {Promise<{total:number, items:Array}>}
 */
function obtenerMovimientos(db, limit = 20, offset = 0, tipo = null) {
    return new Promise((resolve, reject) => {
        const params = [];
        let whereClause = '';
        if (tipo) {
            whereClause = 'WHERE mov.tipo_movimiento = ?';
            params.push(tipo);
        }
        const countSql = `SELECT COUNT(*) AS total FROM Movimientos mov ${whereClause}`;
        db.get(countSql, params, (err, row) => {
            if (err) return reject(err);
            const total = row.total;
            const dataSql = `SELECT mov.id_movimiento, mov.tipo_movimiento, mov.cantidad, mov.fecha_hora_movimiento,
                                mov.usuario_responsable, mov.dpi_solicitante, mov.motivo, med.descripcion AS medicamento,
                                l.numero_lote
                             FROM Movimientos mov
                             JOIN Lotes l ON l.id_lote = mov.id_lote
                             JOIN Medicamentos med ON med.id_medicamento = l.id_medicamento
                             ${whereClause}
                             ORDER BY mov.fecha_hora_movimiento DESC
                             LIMIT ? OFFSET ?`;
            db.all(dataSql, [...params, limit, offset], (err2, rows) => {
                if (err2) return reject(err2);
                resolve({ total, items: rows });
            });
        });
    });
}

module.exports = { obtenerMovimientos };
