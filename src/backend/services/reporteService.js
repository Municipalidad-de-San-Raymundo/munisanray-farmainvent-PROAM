// src/backend/services/reporteService.js
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * Genera un archivo Excel con las entradas o salidas del día.
 * @param {object} db - instancia sqlite
 * @param {'Entrada'|'Salida'} tipo - tipo de movimiento
 * @returns {Promise<string>} ruta del archivo generado en la carpeta temporal
 */
async function generarExcelDia(db, tipo = 'Entrada') {
    const hoySqlite = "date('now','localtime')";
    const sql = `SELECT mov.fecha_hora_movimiento, med.descripcion, l.numero_lote, mov.cantidad,
                        l.precio_unitario_compra,
                        (l.precio_unitario_compra*1.5) AS precio_venta,
                        (mov.cantidad * l.precio_unitario_compra) AS importe,
                        (mov.cantidad * l.precio_unitario_compra*1.5) AS importe_venta
                 FROM Movimientos mov
                 JOIN Lotes l ON l.id_lote = mov.id_lote
                 JOIN Medicamentos med ON med.id_medicamento = l.id_medicamento
                 WHERE mov.tipo_movimiento = ? AND date(mov.fecha_hora_movimiento,'localtime') = ${hoySqlite}
                 ORDER BY mov.fecha_hora_movimiento`;
    const datos = await new Promise((resolve, reject) => {
        db.all(sql, [tipo], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${tipo}s del Día`);

    ws.addRow([`Reporte de ${tipo}s del día`]).font = { bold: true, size: 14 };
    ws.addRow([]);

    ws.columns = [
        { header: 'Fecha/Hora', key: 'fecha', width: 20 },
        { header: 'Medicamento', key: 'medicamento', width: 30 },
        { header: 'Lote', key: 'lote', width: 15 },
        { header: 'Cantidad', key: 'cantidad', width: 10 },
        { header: 'Precio Unitario (compra)', key: 'precio', width: 18 },
        { header: 'Precio Venta', key: 'precio_venta', width: 15 },
        { header: 'Importe (costo)', key: 'importe', width: 18 },
        { header: 'Importe Venta', key: 'importe_venta', width: 18 }
    ];

    let total = 0;
    let totalVenta = 0;
    datos.forEach(r => {
        total += r.importe;
        totalVenta += r.importe_venta;
        ws.addRow({
            fecha: r.fecha_hora_movimiento,
            medicamento: r.descripcion,
            lote: r.numero_lote,
            cantidad: r.cantidad,
            precio: r.precio_unitario_compra,
            precio_venta: r.precio_venta,
            importe: r.importe,
            importe_venta: r.importe_venta
        });
    });

    ws.addRow([]);
    ws.addRow(['', '', '', '', 'TOTAL', total, '', totalVenta]).font = { bold: true };

    const tempDir = app.getPath('temp');
    const filename = `reporte_${tipo.toLowerCase()}s_${new Date().toISOString().substring(0,10)}.xlsx`;
    const tempPath = path.join(tempDir, filename);
    await wb.xlsx.writeFile(tempPath);
    return tempPath;
}

/**
 * Genera un excel para un rango de fechas y tipo.
 * @param {object} db
 * @param {'Entradas'|'Salidas'|'Ambos'} tipoReporte
 * @param {string} desde yyyy-mm-dd
 * @param {string} hasta yyyy-mm-dd
 * @returns {Promise<string>} path
 */
async function generarExcelRango(db, tipoReporte='Ambos', desde, hasta){
    if(!desde||!hasta) throw new Error('Debe especificar rango de fechas');
    const params=[];
    let where="WHERE date(mov.fecha_hora_movimiento,'localtime') BETWEEN ? AND ?";
    params.push(desde, hasta);
    if(tipoReporte!=='Ambos'){
        where+=" AND mov.tipo_movimiento = ?";
        params.push(tipoReporte.slice(0,-1)); // Entradas->Entrada Salidas->Salida
    }
    const sql=`SELECT mov.fecha_hora_movimiento, mov.tipo_movimiento, med.descripcion, l.numero_lote, mov.cantidad,
                      l.precio_unitario_compra,
                      (l.precio_unitario_compra*1.5) AS precio_venta,
                      (mov.cantidad*l.precio_unitario_compra) AS importe,
                      (mov.cantidad*l.precio_unitario_compra*1.5) AS importe_venta
               FROM Movimientos mov
               JOIN Lotes l ON l.id_lote=mov.id_lote
               JOIN Medicamentos med ON med.id_medicamento=l.id_medicamento
               ${where}
               ORDER BY mov.fecha_hora_movimiento`;
    const datos=await new Promise((resolve,reject)=>{
        db.all(sql, params,(err,rows)=>{ if(err) reject(err); else resolve(rows); });
    });
    const ExcelJS=require('exceljs');
    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('Reporte');
    ws.columns=[
        {header:'Fecha/Hora',key:'fecha',width:20},
        {header:'Tipo',key:'tipo',width:10},
        {header:'Medicamento',key:'med',width:30},
        {header:'Lote',key:'lote',width:15},
        {header:'Cantidad',key:'cantidad',width:10},
        {header:'Precio Unit. (costo)',key:'precio',width:18},
        {header:'Precio Venta',key:'precio_venta',width:15},
        {header:'Importe (costo)',key:'imp',width:18},
        {header:'Importe Venta',key:'impVenta',width:18}
    ];
    let total=0; let totalVenta=0;
    datos.forEach(r=>{ total+=r.importe; totalVenta+=r.importe_venta; ws.addRow({fecha:r.fecha_hora_movimiento,tipo:r.tipo_movimiento,med:r.descripcion,lote:r.numero_lote,cantidad:r.cantidad,precio:r.precio_unitario_compra,precio_venta:r.precio_venta,imp:r.importe,impVenta:r.importe_venta}); });
    ws.addRow([]);
    ws.addRow(['','','','','','TOTAL',total,'',totalVenta]).font={bold:true};
    const path=require('path');const {app}=require('electron');
    const filename=`reporte_${tipoReporte.toLowerCase()}_${desde}_a_${hasta}.xlsx`;
    const filePath=path.join(app.getPath('temp'),filename);
    await wb.xlsx.writeFile(filePath);
    return filePath;
}

/**
 * Genera un archivo Excel con los recibos en un rango de fechas, filtrando por estado (activos o anulados).
 * @param {object} db - instancia sqlite
 * @param {string} desde - fecha inicial formato yyyy-mm-dd
 * @param {string} hasta - fecha final formato yyyy-mm-dd
 * @param {boolean} mostrarAnulados - true para mostrar recibos anulados, false para mostrar activos
 * @returns {Promise<string>} ruta del archivo generado en la carpeta temporal
 */
async function generarExcelRecibos(db, desde, hasta, mostrarAnulados = false) {
    if (!desde || !hasta) throw new Error('Debe especificar rango de fechas');
    
    // Consulta para obtener los recibos según el filtro de anulados
    // Aseguramos que la comparación de fechas sea consistente y funcione con diferentes formatos
    const sql = `
        SELECT id_recibo, codigo, fecha, dpi_solicitante, total_exacto, total_redondeado, 
               detalles, anulado, fecha_creacion
        FROM Recibos
        WHERE (
            -- Si la fecha está en formato ISO (YYYY-MM-DD)
            (fecha LIKE '____-__-__' AND fecha >= ? AND fecha <= ?)
            OR 
            -- Si la fecha tiene otro formato, intentar convertirla
            (date(fecha) >= date(?) AND date(fecha) <= date(?))
        )
        AND anulado = ?
        ORDER BY fecha_creacion
    `;
    
    // Ajustamos los parámetros para que coincidan con nuestra consulta SQL modificada
    // Necesitamos duplicar los parámetros de fecha para las dos condiciones
    const params = [desde, hasta, desde, hasta, mostrarAnulados ? 1 : 0];
    
    // Agregamos un console.log para depuración
    console.log(`Generando reporte de recibos desde ${desde} hasta ${hasta}, mostrarAnulados=${mostrarAnulados}`);
    console.log(`SQL: ${sql}, Params: ${params}`);
    
    const recibos = await new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error al consultar recibos:', err);
                reject(err);
            } else {
                console.log(`Recibos encontrados: ${rows.length}`);
                // Asegurar que los detalles en formato JSON se parseen correctamente
                rows.forEach(row => {
                    try {
                        if (typeof row.detalles === 'string') {
                            row.detalles = JSON.parse(row.detalles);
                        }
                    } catch (e) {
                        console.error(`Error parseando detalles del recibo ${row.codigo}:`, e);
                        row.detalles = []; // Usar un array vacío como fallback
                    }
                });
                resolve(rows);
            }
        });
    });
    
    // Crear el libro Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Recibos ${mostrarAnulados ? 'Anulados' : 'Activos'}`);
    
    // Título del reporte
    ws.addRow([`Reporte de Recibos ${mostrarAnulados ? 'Anulados' : 'Activos'}`]).font = { bold: true, size: 14 };
    ws.addRow([`Período: ${desde} al ${hasta}`]).font = { bold: true };
    ws.addRow([]);
    
    // Definir columnas
    ws.columns = [
        { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'DPI Solicitante', key: 'dpi', width: 20 },
        { header: 'Medicamento', key: 'medicamento', width: 30 },
        { header: 'Lote', key: 'lote', width: 12 },
        { header: 'Cantidad', key: 'cantidad', width: 10 },
        { header: 'Precio Unitario', key: 'precio', width: 15 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Total Exacto', key: 'total_exacto', width: 15 },
        { header: 'Total Redondeado', key: 'total_redondeado', width: 15 }
    ];
    
    // Formatear las celdas de cabecera
    ws.getRow(4).font = { bold: true };
    ws.getRow(4).alignment = { vertical: 'middle', horizontal: 'center' };
    
    let totalExacto = 0;
    let totalRedondeado = 0;
    
    // Agregar filas con datos de recibos
    console.log('Procesando recibos para Excel:', recibos.length);
    recibos.forEach((recibo, index) => {
        console.log(`Procesando recibo ${index+1}/${recibos.length}: ${recibo.codigo}`);
        totalExacto += Number(recibo.total_exacto) || 0;
        totalRedondeado += Number(recibo.total_redondeado) || 0;
        
        // Los detalles ya vienen parseados del paso anterior
        const detalles = Array.isArray(recibo.detalles) ? recibo.detalles : [];
        console.log(`Recibo ${recibo.codigo} tiene ${detalles.length} detalles`);
        
        // Primera fila con información del recibo y primer medicamento
        if (detalles.length > 0) {
            const primerDetalle = detalles[0];
            // Verificamos que los campos necesarios existan
            const descripcion = primerDetalle.descripcion || 'Sin descripción';
            const lote = primerDetalle.lote || 'S/L';
            const cantidad = Number(primerDetalle.cantidad) || 0;
            const precioVenta = Number(primerDetalle.precio_venta) || 0;
            const subtotal = cantidad * precioVenta;
            
            ws.addRow({
                codigo: recibo.codigo,
                fecha: recibo.fecha,
                dpi: recibo.dpi_solicitante || 'Sin DPI',
                medicamento: descripcion,
                lote: lote,
                cantidad: cantidad,
                precio: precioVenta,
                subtotal: subtotal,
                total_exacto: recibo.total_exacto,
                total_redondeado: recibo.total_redondeado
            });
            
            // Si hay más detalles, agregar filas adicionales sin repetir la info del recibo
            for (let i = 1; i < detalles.length; i++) {
                const detalle = detalles[i];
                // Verificamos que los campos necesarios existan
                const desc = detalle.descripcion || 'Sin descripción';
                const lt = detalle.lote || 'S/L';
                const cant = Number(detalle.cantidad) || 0;
                const precio = Number(detalle.precio_venta) || 0;
                const subt = cant * precio;
                
                ws.addRow({
                    codigo: '',
                    fecha: '',
                    dpi: '',
                    medicamento: desc,
                    lote: lt,
                    cantidad: cant,
                    precio: precio,
                    subtotal: subt,
                    total_exacto: '',
                    total_redondeado: ''
                });
            }
        } else {
            // Si no hay detalles, mostrar solo la información del recibo
            ws.addRow({
                codigo: recibo.codigo,
                fecha: recibo.fecha,
                dpi: recibo.dpi_solicitante || 'Sin DPI',
                medicamento: 'Sin detalles',
                lote: '',
                cantidad: '',
                precio: '',
                subtotal: '',
                total_exacto: recibo.total_exacto,
                total_redondeado: recibo.total_redondeado
            });
        }
        
        // Agregar una fila vacía entre recibos para mejor legibilidad
        ws.addRow([]);
    });
    
    // Agregar totales
    ws.addRow(['', '', '', '', '', '', 'TOTAL GENERAL', '', totalExacto, totalRedondeado]).font = { bold: true };
    
    // Dar formato a celdas numéricas
    ws.eachRow((row, rowNumber) => {
        if (rowNumber > 4) { // Omitir las filas de título y encabezados
            ['H', 'I', 'J'].forEach(col => {
                const cell = row.getCell(col);
                if (cell.value !== '' && !isNaN(cell.value)) {
                    cell.numFmt = '#,##0.00';
                }
            });
        }
    });
    
    // Guardar el archivo
    const filename = `reporte_recibos_${mostrarAnulados ? 'anulados' : 'activos'}_${desde}_a_${hasta}.xlsx`;
    const filePath = path.join(app.getPath('temp'), filename);
    await wb.xlsx.writeFile(filePath);
    return filePath;
}

module.exports = { generarExcelDia, generarExcelRango, generarExcelRecibos };
