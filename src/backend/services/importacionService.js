// src/backend/services/importacionService.js
const ExcelJS = require('exceljs');

// Utilidad: convertir valores Excel a fecha ISO (YYYY-MM-DD), igual que scripts/migracion.js
function excelSerialToDate(serial) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30
  const millis = serial * 24 * 60 * 60 * 1000;
  return new Date(excelEpoch.getTime() + millis);
}

function toISODate(value) {
  if (!value) return null;
  try {
    if (value instanceof Date) return value.toLocaleDateString('sv-SE');
    if (typeof value === 'number') {
      return excelSerialToDate(value).toLocaleDateString('sv-SE');
    }
    if (typeof value === 'object' && value.text) {
      return toISODate(value.text);
    }
    if (typeof value === 'string') {
      const m = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) {
          const yr = parseInt(y, 10);
          y = yr < 50 ? `20${y}` : `19${y}`;
        }
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    const parsed = new Date(value);
    if (!isNaN(parsed)) return parsed.toLocaleDateString('sv-SE');
  } catch (_) { /* ignore */ }
  return null; // inválido
}

// Validar una fila del Excel y normalizar campos
function validarYNormalizarFila(rowIndex, cells) {
  const codigo = String(cells[1] ?? '').trim();
  const descripcion = String(cells[2] ?? '').trim();
  const cantidad = parseInt(cells[3] ?? 0, 10);
  const precioUnit = cells[4] !== undefined && cells[4] !== null && cells[4] !== '' ? parseFloat(cells[4]) : null;
  const importe = cells[5] !== undefined && cells[5] !== null && cells[5] !== '' ? parseFloat(cells[5]) : null;
  const lote = String(cells[6] ?? '').trim() || 'SINLOTE';
  const fechaVenc = toISODate(cells[7]);

  const errors = [];
  if (!codigo) errors.push('Código requerido');
  if (!descripcion) errors.push('Descripción requerida');
  if (isNaN(cantidad) || cantidad < 0) errors.push('Cantidad inválida');
  if (precioUnit !== null && isNaN(precioUnit)) errors.push('Precio unitario inválido');
  if (importe !== null && isNaN(importe)) errors.push('Importe inválido');

  return {
    rowIndex,
    codigo,
    descripcion,
    cantidad: isNaN(cantidad) ? 0 : cantidad,
    precioUnit: precioUnit === null || isNaN(precioUnit) ? null : precioUnit,
    importe: importe === null || isNaN(importe) ? null : importe,
    lote,
    fechaVenc, // puede ser null en preview; en import se aplicará fallback
    errors,
  };
}

async function leerExcelDesdeBuffer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.activeWorksheet || wb.worksheets[0];
  if (!sheet) throw new Error('No se encontró hoja en el Excel');
  return sheet;
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function obtenerMedicamentoPorCodigo(db, codigo) {
  return dbGet(db, 'SELECT * FROM Medicamentos WHERE codigo_medicamento = ?', [codigo]);
}
async function insertarMedicamento(db, { codigo, descripcion }) {
  const res = await dbRun(db, 'INSERT INTO Medicamentos (codigo_medicamento, descripcion, activo) VALUES (?, ?, 1)', [codigo, descripcion]);
  return res.lastID;
}
async function reactivarMedicamento(db, id) {
  await dbRun(db, 'UPDATE Medicamentos SET activo = 1 WHERE id_medicamento = ?', [id]);
}
async function obtenerLote(db, idMedicamento, numeroLote, fechaVenc) {
  return dbGet(db, `SELECT * FROM Lotes WHERE id_medicamento = ? AND numero_lote = ? AND fecha_vencimiento = ? LIMIT 1`, [idMedicamento, numeroLote, fechaVenc]);
}

// Previsualización: no altera la BD, solo clasifica filas
async function previsualizarExcel(db, buffer, { duplicateStrategy = 'omitir' } = {}) {
  const sheet = await leerExcelDesdeBuffer(buffer);
  const totalRows = sheet.rowCount - 1; // sin encabezado
  const rows = [];

  let validRows = 0;
  let invalidRows = 0;
  let duplicates = 0;
  let newMedicamentos = 0;
  let existingMedicamentos = 0;

  for (let rowIdx = 2; rowIdx <= sheet.rowCount; rowIdx++) {
    const row = sheet.getRow(rowIdx);
    const cells = {
      1: row.getCell(1).value,
      2: row.getCell(2).value,
      3: row.getCell(3).value,
      4: row.getCell(4).value,
      5: row.getCell(5).value,
      6: row.getCell(6).value,
      7: row.getCell(7).value,
    };
    const norm = validarYNormalizarFila(rowIdx, cells);

    let status = 'nuevo';

    if (norm.errors.length > 0) {
      status = 'invalido';
      invalidRows++;
    } else {
      // Verificar existencia de medicamento
      const med = await obtenerMedicamentoPorCodigo(db, norm.codigo);
      if (med) {
        existingMedicamentos++;
        // Chequear duplicado de lote
        const fechaCheck = norm.fechaVenc; // puede ser null; si null, no habrá duplicado por clave completa
        if (fechaCheck) {
          const lote = await obtenerLote(db, med.id_medicamento, norm.lote, fechaCheck);
          if (lote) {
            status = 'duplicado';
            duplicates++;
          } else {
            status = 'existente';
          }
        } else {
          status = 'existente';
        }
        validRows++;
      } else {
        newMedicamentos++;
        validRows++;
      }
    }

    rows.push({
      rowIndex: norm.rowIndex,
      codigo: norm.codigo,
      descripcion: norm.descripcion,
      cantidad: norm.cantidad,
      precioUnit: norm.precioUnit,
      importe: norm.importe,
      lote: norm.lote,
      fechaVenc: norm.fechaVenc,
      status,
      errors: norm.errors,
    });
  }

  return {
    success: true,
    summary: { totalRows, validRows, invalidRows, duplicates, newMedicamentos, existingMedicamentos },
    rows,
  };
}

async function importarExcel(db, buffer, { duplicateStrategy = 'omitir', recordMovements = true } = {}, onProgress = () => {}) {
  const sheet = await leerExcelDesdeBuffer(buffer);

  const total = sheet.rowCount - 1;
  let processed = 0;

  const resumen = {
    insertedLotes: 0,
    updatedLotes: 0,
    skippedDuplicates: 0,
    newMedicamentos: 0,
    existingMedicamentos: 0,
    errors: [],
  };

  for (let rowIdx = 2; rowIdx <= sheet.rowCount; rowIdx++) {
    const row = sheet.getRow(rowIdx);
    const cells = {
      1: row.getCell(1).value,
      2: row.getCell(2).value,
      3: row.getCell(3).value,
      4: row.getCell(4).value,
      5: row.getCell(5).value,
      6: row.getCell(6).value,
      7: row.getCell(7).value,
    };

    const norm = validarYNormalizarFila(rowIdx, cells);
    if (norm.errors.length > 0) {
      resumen.errors.push({ rowIndex: rowIdx, message: `Fila inválida: ${norm.errors.join(', ')}` });
      processed++;
      const percent = total > 0 ? Math.round((processed / total) * 100) : 100;
      onProgress({ processed, total, percent });
      continue;
    }

    try {
      let med = await obtenerMedicamentoPorCodigo(db, norm.codigo);
      if (!med) {
        const id = await insertarMedicamento(db, { codigo: norm.codigo, descripcion: norm.descripcion });
        med = { id_medicamento: id };
        resumen.newMedicamentos++;
      } else {
        if (med.activo === 0) {
          await reactivarMedicamento(db, med.id_medicamento);
        }
        resumen.existingMedicamentos++;
      }

      const fechaFinal = norm.fechaVenc || new Date().toLocaleDateString('sv-SE');
      const precio = norm.precioUnit === null ? null : norm.precioUnit;
      const importe = norm.importe === null && precio !== null ? (norm.cantidad * precio) : (norm.importe === null ? null : norm.importe);

      // Transacción por fila
      await dbRun(db, 'BEGIN TRANSACTION');
      try {
        const loteExistente = await obtenerLote(db, med.id_medicamento, norm.lote, fechaFinal);

        if (loteExistente) {
          if (duplicateStrategy === 'omitir') {
            resumen.skippedDuplicates++;
          } else if (duplicateStrategy === 'permitir') {
            // Insertar lote nuevo (misma clave) como duplicado adicional
            const resIns = await dbRun(db, `INSERT INTO Lotes (id_medicamento, numero_lote, fecha_vencimiento, cantidad_actual, precio_unitario_compra, importe_total, fecha_ingreso_lote)
                                            VALUES (?, ?, ?, ?, ?, ?, ?)`, [
              med.id_medicamento,
              norm.lote,
              fechaFinal,
              norm.cantidad,
              precio,
              importe,
              new Date().toLocaleDateString('sv-SE')
            ]);
            const idLote = resIns.lastID;
            if (recordMovements) {
              await dbRun(db, `INSERT INTO Movimientos (id_lote, tipo_movimiento, cantidad, fecha_hora_movimiento, motivo)
                                VALUES (?, 'Entrada', ?, datetime('now','localtime'), ?)`, [
                idLote,
                norm.cantidad,
                'Entrada por importación (duplicado permitido)'
              ]);
            }
            resumen.insertedLotes++;
          } else if (duplicateStrategy === 'sobrescribir') {
            // Actualizar lote existente y registrar movimiento por delta
            const anterior = loteExistente.cantidad_actual;
            const nuevo = norm.cantidad;
            const delta = nuevo - anterior;

            await dbRun(db, `UPDATE Lotes SET cantidad_actual = ?, precio_unitario_compra = ?, importe_total = ?, fecha_vencimiento = ? WHERE id_lote = ?`, [
              nuevo,
              precio,
              importe,
              fechaFinal,
              loteExistente.id_lote
            ]);

            if (recordMovements && delta !== 0) {
              const tipo = delta > 0 ? 'Entrada' : 'Salida';
              await dbRun(db, `INSERT INTO Movimientos (id_lote, tipo_movimiento, cantidad, fecha_hora_movimiento, motivo)
                                VALUES (?, ?, ?, datetime('now','localtime'), ?)`, [
                loteExistente.id_lote,
                tipo,
                Math.abs(delta),
                'Ajuste por importación (sobrescritura)'
              ]);
            }
            resumen.updatedLotes++;
          }
        } else {
          // No existe lote con esa clave => insertar y registrar Entrada
          const resIns = await dbRun(db, `INSERT INTO Lotes (id_medicamento, numero_lote, fecha_vencimiento, cantidad_actual, precio_unitario_compra, importe_total, fecha_ingreso_lote)
                                          VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            med.id_medicamento,
            norm.lote,
            fechaFinal,
            norm.cantidad,
            precio,
            importe,
            new Date().toLocaleDateString('sv-SE')
          ]);
          const idLote = resIns.lastID;

          if (recordMovements) {
            await dbRun(db, `INSERT INTO Movimientos (id_lote, tipo_movimiento, cantidad, fecha_hora_movimiento, motivo)
                              VALUES (?, 'Entrada', ?, datetime('now','localtime'), ?)`, [
              idLote,
              norm.cantidad,
              'Entrada por importación'
            ]);
          }
          resumen.insertedLotes++;
        }

        await dbRun(db, 'COMMIT');
      } catch (txErr) {
        await dbRun(db, 'ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      resumen.errors.push({ rowIndex: rowIdx, message: err.message });
    } finally {
      processed++;
      const percent = total > 0 ? Math.round((processed / total) * 100) : 100;
      onProgress({ processed, total, percent });
    }
  }

  return { success: true, resumen };
}

module.exports = {
  toISODate,
  previsualizarExcel,
  importarExcel,
};
