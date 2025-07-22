// src/backend/services/medicamentoService.js

/**
 * Agrega un nuevo medicamento a la base de datos.
 * @param {object} db - Instancia de la base de datos SQLite.
 * @param {object} datos - Objeto con los datos del medicamento.
 * @returns {Promise<object>} Promesa que resuelve con el medicamento agregado (incluyendo su nuevo ID).
 */
function agregarMedicamento(db, datos) {
    return new Promise((resolve, reject) => {
        const {
            codigo_medicamento,
            descripcion,
            principio_activo = null, // Proporcionar valores predeterminados si son opcionales
            forma_farmaceutica = null,
            concentracion = null,
            unidad_medida = null,
            stock_minimo = 0 // Asegurar que stock_minimo tenga un valor
        } = datos;

        // Validaciones básicas de los campos requeridos
        if (!codigo_medicamento || !descripcion || stock_minimo === undefined || stock_minimo === null) {
            return reject(new Error('Código, descripción y stock mínimo son campos requeridos.'));
        }
        if (typeof stock_minimo !== 'number' || stock_minimo < 0) {
            return reject(new Error('Stock mínimo debe ser un número no negativo.'));
        }

        const sql = `INSERT INTO Medicamentos (
                        codigo_medicamento, 
                        descripcion, 
                        principio_activo, 
                        forma_farmaceutica, 
                        concentracion, 
                        unidad_medida, 
                        stock_minimo
                     )
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.run(sql, [
            codigo_medicamento,
            descripcion,
            principio_activo,
            forma_farmaceutica,
            concentracion,
            unidad_medida,
            parseInt(stock_minimo, 10) // Asegurar que es un entero
        ], function(err) {
            if (err) {
                console.error('Error al insertar medicamento en DB:', err.message);
                if (err.message.includes('UNIQUE constraint failed: Medicamentos.codigo_medicamento')) {
                    return reject(new Error(`El código de medicamento '${codigo_medicamento}' ya existe.`));
                }
                return reject(new Error('Error al guardar el medicamento en la base de datos.'));
            } else {
                console.log(`Medicamento agregado con ID: ${this.lastID}`);
                resolve({ id_medicamento: this.lastID, ...datos, stock_minimo: parseInt(stock_minimo, 10) });
            }
        });
    });
}

// Aquí se podrían agregar más funciones de servicio para medicamentos (obtener, actualizar, eliminar)

/**
 * Obtiene todos los medicamentos de la base de datos.
 * @param {object} db - Instancia de la base de datos SQLite.
 * @returns {Promise<Array<object>>} Promesa que resuelve con un array de todos los medicamentos.
 */
function obtenerTodosMedicamentos(db) {
    return new Promise((resolve, reject) => {
        // Unimos Medicamentos con Lotes para calcular el stock total de cada medicamento.
        // Usamos LEFT JOIN para incluir medicamentos que aún no tienen lotes (stock 0).
        // COALESCE(SUM(l.cantidad_actual), 0) asegura que si no hay lotes, el stock sea 0 en lugar de NULL.
        const sql = `
            SELECT
                m.id_medicamento,
                m.codigo_medicamento,
                m.descripcion,
                m.principio_activo,
                m.forma_farmaceutica,
                m.concentracion,
                m.unidad_medida,
                m.stock_minimo,
                COALESCE(SUM(l.cantidad_actual), 0) AS stock_total
            FROM
                Medicamentos m
            LEFT JOIN
                Lotes l ON m.id_medicamento = l.id_medicamento
            WHERE m.activo = 1
            GROUP BY
                m.id_medicamento
            ORDER BY
                m.descripcion ASC`;

        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error al obtener todos los medicamentos:', err.message);
                reject(new Error('Error al obtener los medicamentos de la base de datos.'));
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Obtiene medicamentos con stock total, paginados.
 * @param {object} db instancia sqlite
 * @param {number} limit cantidad por página
 * @param {number} offset desplazamiento
 * @returns {Promise<{total:number, items:Array}>}
 */
function obtenerMedicamentosPaginados(db, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
        const countSql = `SELECT COUNT(*) as total FROM Medicamentos WHERE activo = 1`;
        db.get(countSql, [], (err, row) => {
            if (err) return reject(err);
            const total = row.total;
            const dataSql = `
                SELECT m.*, COALESCE(SUM(l.cantidad_actual),0) AS stock_total
                FROM Medicamentos m
                LEFT JOIN Lotes l ON l.id_medicamento = m.id_medicamento
                WHERE m.activo = 1
                GROUP BY m.id_medicamento
                ORDER BY m.descripcion ASC
                LIMIT ? OFFSET ?`;
            db.all(dataSql, [limit, offset], (err2, rows) => {
                if (err2) return reject(err2);
                resolve({ total, items: rows });
            });
        });
    });
}

/**
 * Busca medicamentos por descripción o código con paginación.
 * @param {object} db
 * @param {string} termino
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<{total:number, items:Array}>}
 */
function buscarMedicamentosPaginados(db, termino='', limit=20, offset=0){
    return new Promise((resolve,reject)=>{
        const likeTerm=`%${termino}%`;
        const countSql=`SELECT COUNT(*) AS total FROM Medicamentos WHERE activo = 1 AND (descripcion LIKE ? OR codigo_medicamento LIKE ?)`;
        db.get(countSql,[likeTerm, likeTerm],(err,row)=>{
            if(err) return reject(err);
            const total=row.total;
            const dataSql=`SELECT m.*, COALESCE(SUM(l.cantidad_actual),0) AS stock_total
                           FROM Medicamentos m
                           LEFT JOIN Lotes l ON l.id_medicamento = m.id_medicamento
                           WHERE m.activo = 1 AND (m.descripcion LIKE ? OR m.codigo_medicamento LIKE ?)
                           GROUP BY m.id_medicamento
                           ORDER BY m.descripcion ASC
                           LIMIT ? OFFSET ?`;
            db.all(dataSql,[likeTerm, likeTerm, limit, offset],(err2,rows)=>{
                if(err2) return reject(err2);
                resolve({total, items: rows});
            });
        });
    });
}

/**
 * Marca un medicamento como inactivo (soft delete)
 * @param {object} db
 * @param {number} id
 * @returns {Promise<void>}
 */
/**
 * Obtiene un medicamento por id
 */
function obtenerMedicamentoPorId(db, id){
    return new Promise((resolve,reject)=>{
        db.get('SELECT * FROM Medicamentos WHERE id_medicamento = ? AND activo = 1',[id],(err,row)=>{
            if(err) return reject(err);
            if(!row) return reject(new Error('No encontrado'));
            resolve(row);
        });
    });
}

/** Actualiza medicamento */
function actualizarMedicamento(db, id, datos){
    return new Promise((resolve,reject)=>{
        const {
            codigo_medicamento,
            descripcion,
            principio_activo=null,
            forma_farmaceutica=null,
            concentracion=null,
            unidad_medida=null,
            stock_minimo=0
        } = datos;
        db.run(`UPDATE Medicamentos SET codigo_medicamento=?, descripcion=?, principio_activo=?, forma_farmaceutica=?, concentracion=?, unidad_medida=?, stock_minimo=? WHERE id_medicamento=? AND activo=1`,
            [codigo_medicamento, descripcion, principio_activo, forma_farmaceutica, concentracion, unidad_medida, stock_minimo, id],function(err){
                if(err) return reject(err);
                if(this.changes===0) return reject(new Error('No actualizado'));
                resolve();
            });
    });
}

function eliminarMedicamento(db, id){
    return new Promise((resolve,reject)=>{
        if(!id) return reject(new Error('ID inválido'));
        db.run('UPDATE Medicamentos SET activo = 0 WHERE id_medicamento = ?', [id], function(err){
            if(err) return reject(err);
            if(this.changes===0) return reject(new Error('El medicamento no existe'));
            resolve();
        });
    });
}

module.exports = {
    agregarMedicamento,
    obtenerTodosMedicamentos,
    obtenerMedicamentosPaginados,
    buscarMedicamentosPaginados,
    obtenerMedicamentoPorId,
    actualizarMedicamento,
    eliminarMedicamento
};
