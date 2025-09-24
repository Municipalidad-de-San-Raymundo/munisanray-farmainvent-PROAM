const { BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs');
const { crearRecibo, generarCodigo, listarRecibos, buscarPorCodigo, anularRecibo } = require('../services/recibosService.js');
const path = require('path');
const db = require('../database.js'); // Para operaciones de reversión

/**
 * Registra canal IPC para generar recibo PDF.
 * @param {Electron.IpcMain} ipcMain
 */
function registerHandlers(ipcMain) {
  ipcMain.handle('recibo:generar', async (_event, { detalles, dpi }) => {
    try {
      if (!Array.isArray(detalles) || detalles.length === 0) {
        return { success: false, message: 'No hay detalles para el recibo' };
      }

      // Construir HTML del recibo
      const codigo = generarCodigo();
      const total = detalles.reduce((a, d) => a + d.total, 0);
      
      // Función de redondeo personalizado
      const redondearQuetzales = (valor) => {
        const entero = Math.floor(valor);
        const decimal = +(valor - entero).toFixed(2);

        // Si el valor ya es exacto, no aplicar redondeo
        if (decimal === 0) {
          return valor;
        }
        
        if (decimal <= 0.25) {
          return entero + 0.25;
        } else if (decimal <= 0.50) {
          return entero + 0.50;
        } else if (decimal <= 0.75) {
          return entero + 0.75;
        } else {
          return entero + 1.00;
        }
      };
      
      const totalRedondeado = redondearQuetzales(total);
      // Embebemos el logo en base64
      const logoPath = path.resolve(__dirname, '../../frontend/assets/munilogo.png');
      let logoBase64 = '';
      try {
        const imgBuffer = fs.readFileSync(logoPath);
        logoBase64 = 'data:image/png;base64,' + imgBuffer.toString('base64');
      } catch(_) { logoBase64 = ''; }
      // Formato para mostrar en el PDF
      const fechaVisual = new Date().toLocaleString('es-GT');
      // Formato YYYY-MM-DD para guardar en base de datos y que funcione bien con consultas SQL
      const fecha = new Date().toISOString().split('T')[0];
      const rows = detalles.map(d => `<tr><td>${d.descripcion}</td><td style="text-align:right">Q${d.total.toFixed(2)}</td></tr>`).join('');

      let htmlReceipt = `<!DOCTYPE html><html><head><meta charset=\"utf-8\">
        <style>
          body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;margin:0;padding:0;width:80mm}
          h1{font-size:12pt;text-align:center;margin:4px 0}
          h2{font-size:10pt;text-align:center;margin:2px 0}
          table{width:100%;border-collapse:collapse}
          td{padding:2px 0}
          .tot{border-top:1px solid #000;font-weight:bold}
        </style></head><body>
        <img src=\"${logoBase64}\" style=\"width:40mm;display:block;margin:0 auto 4px auto\">
        <h2>${fechaVisual}</h2>
        <h2>Hospital Municipal: Aldea Pamoca</h2>
        <p><strong>DPI solicitante:</strong> ${dpi}</p>
        <p><strong>Código recibo:</strong> ${codigo}</p>
        <table>${rows}<tr class="tot"><td>Total</td><td style="text-align:right">Q${total.toFixed(2)}</td></tr><tr class="tot"><td>Total Redondeado</td><td style="text-align:right">Q${totalRedondeado.toFixed(2)}</td></tr></table>
        <p>Persona que da Salida: Receptor por defecto #01</p>
      </body></html>`;

      // Ventana oculta para renderizar HTML y generar PDF
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true }
      });
      await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlReceipt));

      // Calcular alto real en píxeles del documento
      const contentHeightPx = await printWin.webContents.executeJavaScript('document.body.scrollHeight');
      // tamaño fijo Epson 80mm x 297mm (rollo)
      const WIDTH_MICRONS = 80000;  // 80 mm
      const HEIGHT_MICRONS = 297000; // 297 mm

      // -- cálculo de alto dinámico opcional -> no usado por ahora --
      const INCHES_PER_PX = 1/96;
      const widthInches = 80 / 25.4; // 80 mm en pulgadas ~3.15
      let heightInches = contentHeightPx * INCHES_PER_PX;
      const minHeightInches = 297 / 25.4; // 297 mm en pulgadas ~11.69
      if (heightInches < minHeightInches) heightInches = minHeightInches;

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground:true,
        marginsType:1,
        pageSize:{width: WIDTH_MICRONS, height: HEIGHT_MICRONS}
      });
      printWin.close();

      // Diálogo para que usuario elija ruta
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS
      const defaultFileName = `recibo_${codigo}_${timestamp}.pdf`;
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar recibo de salida',
        defaultPath: path.join(require('os').homedir(), defaultFileName),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (canceled || !filePath) {
        return { success: false, message: 'Guardado cancelado por el usuario' };
      }

      fs.writeFileSync(filePath, pdfBuffer);
      // Guardar metadatos en base de datos
      await crearRecibo({ codigo, fecha, dpi, totalExacto: total, totalRedondeado, detalles, pdfPath: filePath });
      // Abrir archivo con visor predeterminado
      shell.openPath(filePath);
      return { success: true, message: 'Recibo guardado', path: filePath };
    } catch (err) {
      console.error('Error generando recibo:', err);
      return { success: false, message: err.message };
    }
  });

  // Listar recibos con paginación y filtros
  ipcMain.handle('recibo:listar', async (_event, { page = 1, limit = 10, codigo = '', estado = '' }) => {
    try {
      const recibos = await listarRecibos();
      let filtrados = recibos;
      
      // Filtrar por código si se proporciona
      if (codigo.trim()) {
        filtrados = filtrados.filter(r => r.codigo.toLowerCase().includes(codigo.toLowerCase()));
      }
      
      // Filtrar por estado si se proporciona
      if (estado !== '') {
        filtrados = filtrados.filter(r => r.anulado.toString() === estado);
      }
      
      // Paginación
      const total = filtrados.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginados = filtrados.slice(offset, offset + limit);
      
      return {
        success: true,
        data: paginados,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (err) {
      console.error('Error listando recibos:', err);
      return { success: false, message: err.message };
    }
  });

  // Buscar recibo por código
  ipcMain.handle('recibo:buscar', async (_event, codigo) => {
    try {
      const recibo = await buscarPorCodigo(codigo);
      return { success: true, data: recibo };
    } catch (err) {
      console.error('Error buscando recibo:', err);
      return { success: false, message: err.message };
    }
  });

  // Anular recibo
  ipcMain.handle('recibo:anular', async (_event, codigo) => {
    try {
      const recibo = await buscarPorCodigo(codigo);
      if (!recibo) {
        return { success: false, message: 'Recibo no encontrado' };
      }
      
      if (recibo.anulado) {
        return { success: false, message: 'El recibo ya está anulado' };
      }
      
      // Implementar lógica de reversión de inventario
      const resultadoReversion = await revertirInventario(recibo);
      if (!resultadoReversion.success) {
        return { success: false, message: `Error revirtiendo inventario: ${resultadoReversion.message}` };
      }
      
      // Marcar recibo como anulado
      await anularRecibo(codigo);
      
      return { success: true, message: `Recibo anulado correctamente. ${resultadoReversion.message}` };
    } catch (err) {
      console.error('Error anulando recibo:', err);
      return { success: false, message: err.message };
    }
  });

  // Función para revertir inventario
  async function revertirInventario(recibo) {
    return new Promise((resolve) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let erroresReversion = [];
        let lotesRevertidos = 0;
        
        try {
          // Procesar cada detalle del recibo
          for (const detalle of recibo.detalles) {
            const { id_lote, cantidad, descripcion } = detalle;
            
            if (!id_lote || !cantidad) {
              erroresReversion.push(`Detalle inválido para ${descripcion}`);
              continue;
            }
            
            // Actualizar cantidad en el lote (devolver stock)
            const stmtLote = db.prepare('UPDATE Lotes SET cantidad_actual = cantidad_actual + ? WHERE id_lote = ?');
            const resultLote = stmtLote.run(cantidad, id_lote);
            stmtLote.finalize();
            
            if (resultLote.changes === 0) {
              erroresReversion.push(`Lote no encontrado para ${descripcion}`);
              continue;
            }
            
            // Registrar movimiento de entrada por anulación
            const stmtMovimiento = db.prepare(`
              INSERT INTO Movimientos (id_lote, tipo_movimiento, cantidad, fecha_hora_movimiento, usuario_responsable, motivo, dpi_solicitante)
              VALUES (?, 'Entrada', ?, datetime('now','localtime'), 'Sistema', ?, ?)
            `);
            
            const motivoAnulacion = `Anulación de recibo ${recibo.codigo}`;
            stmtMovimiento.run(id_lote, cantidad, motivoAnulacion, recibo.dpi_solicitante);
            stmtMovimiento.finalize();
            
            lotesRevertidos++;
          }
          
          if (erroresReversion.length > 0) {
            db.run('ROLLBACK');
            resolve({
              success: false,
              message: `Errores en reversión: ${erroresReversion.join(', ')}`
            });
          } else {
            db.run('COMMIT');
            resolve({
              success: true,
              message: `${lotesRevertidos} lote(s) revertido(s) al inventario.`
            });
          }
        } catch (error) {
          db.run('ROLLBACK');
          resolve({
            success: false,
            message: `Error en transacción: ${error.message}`
          });
        }
      });
    });
  }
}

module.exports = { registerHandlers };
