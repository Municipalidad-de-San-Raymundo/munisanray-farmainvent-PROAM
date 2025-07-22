// src/backend/services/salidaService.js

/**
 * Registra una salida de inventario para un lote específico.
 * Disminuye la cantidad_actual del lote y crea un registro de movimiento.
 * @param {object} db instancia sqlite
 * @param {object} datos
 * @param {number} datos.id_lote
 * @param {number} datos.cantidad_salida
 * @param {string|null} datos.destino
 * @param {string|null} datos.observaciones
 * @param {string|null} datos.usuario
 * @returns {Promise<{success:boolean, message:string}>}
 */
function registrarSalida(db, datos) {
    return new Promise((resolve, reject) => {
        const { id_lote, cantidad_salida, destino, observaciones, usuario, dpi_solicitante } = datos;
        if (!id_lote || !cantidad_salida || cantidad_salida <= 0) {
            return reject(new Error('Datos de salida inválidos.'));
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            // Obtener stock actual del lote
            db.get('SELECT cantidad_actual FROM Lotes WHERE id_lote = ?', [id_lote], (err, row) => {
                if (err) return db.run('ROLLBACK;', () => reject(err));
                if (!row) return db.run('ROLLBACK;', () => reject(new Error('Lote no encontrado.')));
                if (row.cantidad_actual < cantidad_salida) {
                    return db.run('ROLLBACK;', () => reject(new Error('Stock insuficiente en el lote.')));
                }

                // Actualizar lote
                db.run('UPDATE Lotes SET cantidad_actual = cantidad_actual - ? WHERE id_lote = ?', [cantidad_salida, id_lote], (err2) => {
                    if (err2) return db.run('ROLLBACK;', () => reject(err2));

                    // Insertar movimiento
                    const sqlMov = `INSERT INTO Movimientos (id_lote, tipo_movimiento, cantidad, fecha_hora_movimiento, usuario_responsable, motivo, referencia_externa, dpi_solicitante)
                                    VALUES (?, 'Salida', ?, datetime('now','localtime'), ?, ?, ?, ?)`;
                    db.run(sqlMov, [id_lote, cantidad_salida, usuario || null, 'Salida inventario', destino || null, dpi_solicitante || null], (err3) => {
                        if (err3) return db.run('ROLLBACK;', () => reject(err3));
                        db.run('COMMIT;', (err4) => {
                            if (err4) return reject(err4);
                            resolve({ success: true, message: 'Salida registrada correctamente.' });
                        });
                    });
                });
            });
        });
    });
}

module.exports = { registrarSalida };
