const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const db = require('./src/backend/database.js'); // Importar la instancia de la BD
const { registerHandlers: registerMedicamentoHandlers } = require('./src/backend/ipcHandlers/medicamentoHandlers.js');
const { registerHandlers: registerLoteHandlers } = require('./src/backend/ipcHandlers/loteHandlers.js');
const { registerHandlers: registerVencimientoHandlers } = require('./src/backend/ipcHandlers/vencimientoHandlers.js');
const { registerHandlers: registerDashboardHandlers } = require('./src/backend/ipcHandlers/dashboardHandlers.js');
const { registerHandlers: registerSalidaHandlers } = require('./src/backend/ipcHandlers/salidaHandlers.js');
const { registerHandlers: registerHistorialHandlers } = require('./src/backend/ipcHandlers/historialHandlers.js');
const { registerHandlers: registerReporteHandlers } = require('./src/backend/ipcHandlers/reporteHandlers.js');
const { registerHandlers: registerReciboHandlers } = require('./src/backend/ipcHandlers/reciboHandlers.js');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Deshabilitar nodeIntegration por seguridad
      contextIsolation: true, // Habilitar contextIsolation (recomendado)
      preload: path.join(__dirname, 'src', 'preload.js') // Cargar el script de preload
    }
  })

  win.loadFile(path.join(__dirname, 'src', 'frontend', 'index.html'))
  // Descomenta la siguiente línea para abrir las herramientas de desarrollo
  // win.webContents.openDevTools()
}

app.whenReady().then(() => {
  // Inicializa la base de datos SQLite.
  try {
    require('./src/backend/database.js');
  } catch (error) {
    console.error('Error crítico: No se pudo cargar o inicializar la base de datos SQLite.', error);
    // Aquí podrías mostrar un diálogo de error al usuario y cerrar la app.
  }

  createWindow()

  // Registrar los manejadores IPC para Medicamentos
  registerMedicamentoHandlers(ipcMain, db);

  // Registrar los manejadores IPC para Lotes
  registerLoteHandlers(ipcMain, db);

  // Registrar los manejadores IPC para Vencimientos
  registerVencimientoHandlers(ipcMain, db);

  // Registrar los manejadores IPC para Dashboard
  registerDashboardHandlers(ipcMain, db);

  // Registrar los manejadores IPC para Salida
  registerSalidaHandlers(ipcMain, db);

  // Registrar los manejadores IPC para Historial
  registerHistorialHandlers(ipcMain, db);

  // Registrar los manejadores IPC para Reporte
  registerReporteHandlers(ipcMain, db);

  // Registrar manejador de Recibo
  registerReciboHandlers(ipcMain);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers related to NeDB were here, but have been removed.
