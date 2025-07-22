// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Exponer funcionalidades seguras al proceso de renderizado
contextBridge.exposeInMainWorld(
  'electronAPI', // Este será el objeto global en window (window.electronAPI)
  {
    // Exponer ipcRenderer.invoke de forma segura
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    
    // Exponer ipcRenderer.on de forma segura
    // Es importante manejar la eliminación de listeners para evitar fugas de memoria
    on: (channel, listener) => {
      const subscription = (event, ...args) => listener(...args);
      ipcRenderer.on(channel, subscription);
      
      // Devolver una función para remover el listener
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },

    // Si necesitas exponer ipcRenderer.send (para comunicación unidireccional al main)
    // send: (channel, ...args) => ipcRenderer.send(channel, ...args),

    // Podrías agregar más funciones aquí si necesitas exponer otras APIs de Electron
    // de forma controlada.
  }
);

console.log('Preload script cargado y electronAPI expuesta.');
