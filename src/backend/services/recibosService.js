const db = require('../database.js'); // Usar la instancia SQLite existente

function generarCodigo() {
  const now = Date.now().toString(36); // base36 timestamp
  const rand = Math.random().toString(36).substr(2, 3);
  return `R${now}${rand}`.toUpperCase();
}

async function crearRecibo({ codigo, fecha, dpi, totalExacto, totalRedondeado, detalles, pdfPath }) {
  const cod = codigo || generarCodigo();
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO Recibos (codigo, fecha, dpi_solicitante, total_exacto, total_redondeado, detalles, pdf_path) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(stmt, [cod, fecha, dpi, totalExacto, totalRedondeado, JSON.stringify(detalles), pdfPath], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id_recibo: this.lastID, codigo: cod, fecha, dpi_solicitante: dpi, total_exacto: totalExacto, total_redondeado: totalRedondeado, detalles, pdf_path: pdfPath, anulado: 0 });
      }
    });
  });
}

async function buscarPorCodigo(codigo) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Recibos WHERE codigo = ?', [codigo], (err, row) => {
      if (err) {
        reject(err);
      } else {
        if (row) {
          row.detalles = JSON.parse(row.detalles);
        }
        resolve(row);
      }
    });
  });
}

async function listarRecibos() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Recibos ORDER BY fecha_creacion DESC', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const recibos = rows.map(row => {
          row.detalles = JSON.parse(row.detalles);
          return row;
        });
        resolve(recibos);
      }
    });
  });
}

async function anularRecibo(codigo) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Recibos SET anulado = 1 WHERE codigo = ?', [codigo], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

module.exports = { generarCodigo, crearRecibo, buscarPorCodigo, listarRecibos, anularRecibo };
