/**
 * Registra la entrada de un nuevo lote y el movimiento correspondiente.
 * Utiliza una transacción para asegurar la atomicidad de la operación.
 * @param {object} db - Instancia de la base de datos SQLite.
 * @param {object} datos - Datos del lote a registrar.
 * @param {number} datos.id_medicamento - ID del medicamento.
 * @param {string} datos.numero_lote - Número de lote.
 * @param {number} datos.cantidad_entrada - Cantidad de unidades que ingresan.
 * @param {string} datos.fecha_vencimiento - Fecha de vencimiento en formato YYYY-MM-DD.
 * @param {string|null} datos.proveedor - Nombre del proveedor (opcional).
 * @param {number|null} datos.precio_unitario - Precio unitario de compra (opcional).
 * @returns {Promise<{success: boolean, message: string}>}
 */
function registrarEntradaLote(db, datos) {
    return new Promise((resolve, reject) => {
        const { id_medicamento, numero_lote, cantidad_entrada, fecha_vencimiento, proveedor, precio_unitario } = datos;
        // Fecha local en formato YYYY-MM-DD (zona Guatemala)
        const fecha_entrada_lote = new Date().toLocaleDateString('sv-SE');

        // Iniciar transacción
        db.serialize(() => {
            db.run("BEGIN TRANSACTION;", (err) => {
                if (err) {
                    return reject(new Error(`Error al iniciar la transacción: ${err.message}`));
                }
            });

            // 1. Insertar en la tabla Lotes
            const sqlLote = `
                INSERT INTO Lotes (id_medicamento, numero_lote, fecha_vencimiento, cantidad_actual, precio_unitario_compra, importe_total, fecha_ingreso_lote)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            // `this.lastID` nos dará el ID del lote recién insertado
            const importeTotal = cantidad_entrada * (precio_unitario || 0);
            db.run(sqlLote, [id_medicamento, numero_lote, fecha_vencimiento, cantidad_entrada, precio_unitario || null, importeTotal, fecha_entrada_lote], function(err) {
                if (err) {
                    console.error('Error al insertar en Lotes:', err.message);
                    return db.run("ROLLBACK;", () => reject(new Error(`El número de lote '${numero_lote}' ya podría existir para este medicamento.`)));
                }

                const id_lote = this.lastID;

                // 2. Insertar en la tabla Movimientos
                const sqlMovimiento = `
                    INSERT INTO Movimientos (id_lote, tipo_movimiento, cantidad, fecha_hora_movimiento, motivo)
                    VALUES (?, 'Entrada', ?, datetime('now','localtime'), ?)
                `;
                // El id_usuario se puede añadir más adelante cuando se implemente la autenticación
                const motivo = `Ingreso inicial del lote. Proveedor: ${proveedor || 'No especificado'}`;
                db.run(sqlMovimiento, [id_lote, cantidad_entrada, motivo], (err) => {
                    if (err) {
                        console.error('Error al insertar en Movimientos:', err.message);
                        return db.run("ROLLBACK;", () => reject(new Error('Error al registrar el movimiento de entrada.')));
                    }

                    // Si todo fue bien, confirmar la transacción
                    db.run("COMMIT;", (err) => {
                        if (err) {
                            return reject(new Error(`Error al confirmar la transacción: ${err.message}`));
                        }
                        resolve({ success: true, message: 'Entrada de lote registrada exitosamente.' });
                    });
                });
            });
        });
    });
}

function obtenerLotesPorMedicamento(db, idMedicamento) {
    return new Promise((resolve, reject) => {
        if (!idMedicamento) {
            return reject(new Error('ID de medicamento inválido'));
        }
        const sql = `SELECT * FROM Lotes WHERE id_medicamento = ? ORDER BY fecha_vencimiento`;
        db.all(sql, [idMedicamento], (err, rows) => {
            if (err) {
                console.error('Error al obtener lotes por medicamento:', err.message);
                return reject(new Error('Error al consultar los lotes.'));
            }
            resolve(rows);
        });
    });
}

function actualizarLote(db, idLote, datos){
    return new Promise((resolve,reject)=>{
        const campos=[]; const valores=[];
        ['numero_lote','fecha_vencimiento','cantidad_actual','precio_unitario_compra','importe_total'].forEach(k=>{
            if(datos[k]!==undefined){campos.push(`${k} = ?`); valores.push(datos[k]);}
        });
        if(campos.length===0) return reject(new Error('Sin datos para actualizar'));
        valores.push(idLote);
        const sql=`UPDATE Lotes SET ${campos.join(', ')} WHERE id_lote = ?`;
        db.run(sql,valores,function(err){
            if(err){return reject(err);} 
            resolve({success:true,changes:this.changes});
        });
    });
}

function obtenerLotePorId(db,id){
    return new Promise((resolve,reject)=>{
        db.get('SELECT * FROM Lotes WHERE id_lote = ?', [id], (err,row)=>{
            if(err) return reject(err);
            resolve(row);
        });
    });
}

function softDeleteLote(db, idLote){
    return new Promise((resolve,reject)=>{
        db.run(`UPDATE Lotes SET cantidad_actual = 0 WHERE id_lote = ?`, [idLote], function(err){
            if(err) return reject(err);
            resolve({success:true,changes:this.changes});
        });
    });
}

module.exports = {
    registrarEntradaLote,
    obtenerLotesPorMedicamento,
    obtenerLotePorId,
    actualizarLote,
    softDeleteLote
};
