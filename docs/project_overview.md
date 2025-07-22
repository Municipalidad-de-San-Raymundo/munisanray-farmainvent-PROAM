# Sistema de Inventario de Medicamentos – Resumen General

> Última actualización: 2025-07-18

## Propósito del Proyecto
Aplicación de escritorio para el Hospital de Pamoca (Municipalidad de San Raymundo) que permite gestionar inventario de medicamentos: entradas, salidas (incluyendo salidas por lote en batch), reportes y estadísticas.

## Stack Tecnológico
* **ElectronJS 27** – shell de escritorio.
* **Frontend HTML + Bulma CSS** (`src/frontend/`)
  * Componentes extra: Font Awesome, Material Icons, Choices.js (selects mejorados).
  * Personalización de Bulma mediante variables CSS en `custom-styles.css` (paleta cian ≈ #36D9D9 y azul #035AA6).
* **Base de Datos**
  * Inicialmente NeDB; se migró a **SQLite** (`db` exportado desde `src/backend/database.js`).
* **Backend (Proceso principal)**
  * IPC handlers modulares en `src/backend/ipcHandlers/*Handlers.js` (medicamentos, lotes, salidas, historial, etc.).
* **Plataforma futura**: Se comenzó transición a **SvelteKit** (estructura creada pero aún sin funcionalidades completas).

## Estructura de Carpetas
```
├─ main.js                    # Arranque Electron, registro de handlers IPC
├─ src/
│  ├─ backend/
│  │  ├─ database.js          # Conexión SQLite + init tablas
│  │  └─ ipcHandlers/         # 1 archivo handler por dominio
│  ├─ frontend/
│  │  ├─ index.html           # Shell principal + sidebar
│  │  ├─ menu.html            # Menú lateral cargado dinámicamente
│  │  ├─ views/               # HTML modulares (dashboard, gestion, salidas…)
│  │  ├─ css/                 # bulma.min.css + custom-styles.css
│  │  ├─ assets/
│  │  └─ renderer.js          # Lógica de UI, fetch, tablas, modals, etc.
│  └─ preload.js              # Context bridge para APIs seguras
└─ docs/                      # (nuevo) documentación de referencia
```

## Funcionalidades Implementadas
1. **Medicamentos**
   * CRUD completo.
   * Paginación y búsqueda.
2. **Lotes**
   * Registrar entradas, editar datos y control de vencimientos.
3. **Salidas**
   * Flujo batch: se agrega múltiple detalle (`detallesSalida`) a tabla temporal, luego se registra de forma masiva.
   * Validaciones de stock y confirmaciones.
4. **Historial & Reportes**
   * Consulta paginada de movimientos.
   * Exportación Excel por rango de fechas.
5. **Dashboard**
   * Métricas clave (stock total, por vencer, agotados, valor inventario, etc.).
6. **UX/UI**
   * Sidebar responsive, modo móvil, menú Hamburguesa.
   * Notificaciones Bulma + modal de confirmación reutilizable.
   * Fuentes personalizadas (Inter) y paleta corporativa.

## Detalles Clave del Código
* **renderer.js**
  * `loadPageContent()` dinamiza vistas y llama inicializadores específicos.
  * `initializeRegistrarSalidaForm()` maneja el flujo batch de salidas.
  * Utilidades comunes: notificaciones, modal de confirmación, paginación.
* **IPC Handlers** siguen patrón `(ipcMain, db)` y exponen canales `dominio:accion`.
* **Seguridad**
  * `nodeIntegration` deshabilitado y `contextIsolation` activo.
  * CSP definido en `index.html`.

## Cambios Recientes Importantes
* **Batch Salidas** (jul 2025): refactor de lógica para permitir agregar varios ítems antes de registrar.
* **Reset parcial del formulario**: tras agregar, se limpian campos salvo DPI.
* **Plan para Recibo PDF**: se evaluó generar un PDF post-salida mediante `webContents.printToPDF` y previsualizar en nueva ventana.

## Pendiente / Roadmap Próximo
1. Implementar generación de recibo PDF y previsualización.
2. Terminar migración a SvelteKit: vistas `inventario`, `movimientos`, `reportes`.
3. Revisar coexistencia NeDB / SQLite (confirmar migración completa).
4. Pruebas unitarias e2e.
5. Empaquetado con Electron Forge / Electron Builder.

---
_Este archivo sirve como referencia rápida para futuros desarrolladores. Actualizar conforme avance el proyecto._
