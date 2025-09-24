// src/backend/services/stockService.js

/**
 * Devuelve los medicamentos cuyo stock total es 0 o está por debajo del stock mínimo.
 * @param {object} db Instancia de SQLite
 * @returns {Promise<Array>} Listado de medicamentos bajos o sin stock
 */
function obtenerMedicamentosBajoStock(db) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT
                m.id_medicamento,
                m.codigo_medicamento,
                m.descripcion,
                m.stock_minimo,
                COALESCE(SUM(l.cantidad_actual), 0) AS stock_total
            FROM Medicamentos m
            LEFT JOIN Lotes l ON l.id_medicamento = m.id_medicamento
            WHERE m.activo = 1
            GROUP BY m.id_medicamento
            HAVING stock_total <= m.stock_minimo
            ORDER BY stock_total ASC, m.descripcion ASC;`;

        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

const ExcelJS = require('exceljs');
const path = require('path');
const { app } = require('electron');

/**
 * Genera un archivo Excel con el listado de medicamentos sin stock o bajos de stock.
 * @param {object} db instancia sqlite
 * @returns {Promise<string>} ruta del archivo excel
 */
async function generarExcelBajoStock(db){
    const meds = await obtenerMedicamentosBajoStock(db);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('BajoStock');

    ws.addRow(['Medicamentos sin/bajo stock']).font = { bold:true, size:14 };
    ws.addRow([]);

    ws.columns = [
        { header:'Código', key:'codigo', width:15},
        { header:'Descripción', key:'desc', width:35},
        { header:'Stock Total', key:'stock', width:15},
        { header:'Stock Mínimo', key:'min', width:15}
    ];

    meds.forEach(m => {
        ws.addRow({codigo:m.codigo_medicamento, desc:m.descripcion, stock:m.stock_total, min:m.stock_minimo});
    });

    const filename = `bajo_stock_${new Date().toISOString().substring(0,10)}.xlsx`;
    const filePath = path.join(app.getPath('temp'), filename);
    await wb.xlsx.writeFile(filePath);
    return filePath;
}

module.exports = { obtenerMedicamentosBajoStock, generarExcelBajoStock };
