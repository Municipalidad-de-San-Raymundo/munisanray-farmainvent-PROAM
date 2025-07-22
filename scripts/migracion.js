#!/usr/bin/env node
/*
 * Script: migracion.js
 * Uso:   node scripts/migracion.js <archivo.xlsx> [ruta_db]
 *
 * Lee un archivo Excel con el formato especificado por el usuario y migra su contenido
 * a la base de datos SQLite de la aplicación.  Si la base de datos no existe aún,
 * se crea automáticamente con las tablas mínimas (Medicamentos y Lotes).
 *
 * Requisitos:
 *   npm install sqlite3 exceljs
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const sqlite3 = require('sqlite3').verbose();

// ----------------------- Utilidades -----------------------
/** Devuelve yyyy-mm-dd (sin zona horaria) */
function excelSerialToDate(serial) {
  // Excel serial date to JS Date (serial 1 = 1900-01-01, but Excel has 1900 leap bug)
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30
  const millis = serial * 24 * 60 * 60 * 1000;
  return new Date(excelEpoch.getTime() + millis);
}

function toISODate(value) {
  if (!value) return null;
  try {
    // Si es Date, devolver YYYY-MM-DD según hora local (zona donde se ejecuta)
    if (value instanceof Date) return value.toLocaleDateString('sv-SE');
    if (typeof value === 'number') {
      return excelSerialToDate(value).toLocaleDateString('sv-SE');
    }
    // ExcelJS puede devolver objetos {text: '...', richText: ...}
    if (typeof value === 'object' && value.text) {
      return toISODate(value.text);
    }
    // admitir formatos dd/mm/aa o dd/mm/aaaa
    if (typeof value === 'string') {
      const m = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        let [ , d, mo, y] = m;
        if (y.length === 2) {
          // asume 2000-2049 para 00-49, 1900-1999 para 50-99
          const yr = parseInt(y, 10);
          y = yr < 50 ? `20${y}` : `19${y}`;
        }
        return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
      }
    }
    const parsed = new Date(value);
    if (!isNaN(parsed)) return parsed.toLocaleDateString('sv-SE');
  } catch (_) { /* ignore */ }
  return null; // inválido
}

// ------------------ Validar argumentos --------------------
if (process.argv.length < 3) {
  console.error('Uso: node scripts/migracion.js <archivo.xlsx> [ruta_db]');
  process.exit(1);
}

const excelPath = path.resolve(process.argv[2]);
if (!fs.existsSync(excelPath)) {
  console.error(`El archivo Excel no existe: ${excelPath}`);
  process.exit(1);
}

// Ubicación por defecto de la base según lógica app (carpeta data_dev)
const defaultDbPath = path.join(__dirname, '..', 'data_dev', 'inventario.sqlite');
const dbPath = path.resolve(process.argv[3] || defaultDbPath);

// Asegurar carpeta destino
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

console.log(`Usando base de datos: ${dbPath}`);

// --------------------- Abrir BD ---------------------------
const db = new sqlite3.Database(dbPath);

// Crear tablas si no existen (subset necesario)
function ensureSchema() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS Medicamentos (
                id_medicamento INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo_medicamento TEXT NOT NULL UNIQUE,
                descripcion TEXT NOT NULL,
                principio_activo TEXT DEFAULT 'N/A',
                forma_farmaceutica TEXT,
                concentracion TEXT,
                unidad_medida TEXT,
                stock_minimo INTEGER NOT NULL DEFAULT 0
              );`);
      db.run(`CREATE TABLE IF NOT EXISTS Lotes (
                id_lote INTEGER PRIMARY KEY AUTOINCREMENT,
                id_medicamento INTEGER NOT NULL,
                numero_lote TEXT NOT NULL,
                fecha_vencimiento TEXT NOT NULL,
                cantidad_actual INTEGER NOT NULL,
                precio_unitario_compra REAL,
                importe_total REAL,
                fecha_ingreso_lote TEXT NOT NULL,
                FOREIGN KEY (id_medicamento) REFERENCES Medicamentos(id_medicamento) ON DELETE CASCADE
              );`, (err) => (err ? reject(err) : resolve()));
    });
  });
}

// ------------------ Operaciones BD ------------------------
function upsertMedicamento(codigo, descripcion) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id_medicamento FROM Medicamentos WHERE codigo_medicamento = ?', [codigo], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row.id_medicamento);
      db.run('INSERT INTO Medicamentos (codigo_medicamento, descripcion) VALUES (?, ?)', [codigo, descripcion], function (insertErr) {
        if (insertErr) return reject(insertErr);
        resolve(this.lastID);
      });
    });
  });
}

function insertarLote({ id_medicamento, numero_lote, fecha_vencimiento, cantidad, precio_unitario, importe_total }) {
  return new Promise((resolve, reject) => {
    const hoy = new Date().toLocaleDateString('sv-SE');
    db.run(
      `INSERT INTO Lotes (id_medicamento, numero_lote, fecha_vencimiento, cantidad_actual, precio_unitario_compra, importe_total, fecha_ingreso_lote)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_medicamento, numero_lote, fecha_vencimiento, cantidad, precio_unitario, importe_total, hoy],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// --------------- Procesamiento de Excel -------------------
async function procesarExcel() {
  await ensureSchema();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const sheet = wb.activeWorksheet || wb.worksheets[0];
  if (!sheet) throw new Error('No se encontró hoja en el Excel');

  let procesadas = 0;
  console.log(`Filas totales (incluyendo encabezado): ${sheet.rowCount}`);

  for (let rowIdx = 2; rowIdx <= sheet.rowCount; rowIdx++) {
    const row = sheet.getRow(rowIdx);
    const codigo = String(row.getCell(1).value || '').trim();
    if (!codigo) continue; // fila vacía
    const descripcion = String(row.getCell(2).value || '').trim();
    const cantidad = parseInt(row.getCell(3).value || 0, 10);
    const precioUnit = parseFloat(row.getCell(4).value || 0);
    const importe = parseFloat(row.getCell(5).value || cantidad * precioUnit);
    const lote = String(row.getCell(6).value || '').trim();
    const vencimientoExcelVal = row.getCell(7).value;
    const fechaVencimiento = toISODate(vencimientoExcelVal);
    if(!fechaVencimiento){
      console.warn(`Fila ${rowIdx}: fecha de vencimiento inválida ->`, vencimientoExcelVal);
    }

    try {
      const idMed = await upsertMedicamento(codigo, descripcion);
      await insertarLote({
        id_medicamento: idMed,
        numero_lote: lote || 'SINLOTE',
        fecha_vencimiento: fechaVencimiento || toISODate(new Date()),
        cantidad: isNaN(cantidad) ? 0 : cantidad,
        precio_unitario: isNaN(precioUnit) ? 0 : precioUnit,
        importe_total: isNaN(importe) ? null : importe,
      });
      procesadas++;
      if (procesadas % 50 === 0) console.log(`${procesadas} filas procesadas...`);
    } catch (err) {
      console.error(`Error en fila ${rowIdx}:`, err.message);
    }
  }

  console.log(`Migración completada. Filas procesadas: ${procesadas}`);
  db.close();
}

procesarExcel().catch((e) => {
  console.error('Error inesperado:', e);
  db.close();
  process.exit(1);
});
