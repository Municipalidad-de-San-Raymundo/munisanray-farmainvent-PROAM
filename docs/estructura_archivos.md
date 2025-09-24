# Referencia de Archivos

Esta guía lista los archivos clave del proyecto y cómo se relacionan entre sí.

## Renderer

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| `renderer.js` | `src/frontend/renderer.js` | Script principal del proceso *renderer*. Carga dinámicamente las vistas HTML, maneja eventos de la UI y se comunica con el proceso *main* mediante IPC.
| `preload.js` | `src/preload.js` | Expone APIs seguras (canal IPC) al renderer. Aísla Node.js del DOM para mayor seguridad.

## Servicios Backend (Main Process)

Cada servicio encapsula la lógica de negocio de un dominio y es invocado por los *IPC Handlers*.

| Servicio | Archivo | Funcionalidad principal |
|----------|---------|-------------------------|
| MedicamentoService | `src/backend/services/medicamentoService.js` | CRUD de medicamentos. |
| LoteService | `src/backend/services/loteService.js` | Gestión de lotes y stock. |
| VencimientoService | `src/backend/services/vencimientoService.js` | Cálculo de productos próximos a vencer. |
| DashboardService | `src/backend/services/dashboardService.js` | Estadísticas generales para el panel principal. |
| SalidaService | `src/backend/services/salidaService.js` | Registro y validación de salidas de inventario. |
| HistorialService | `src/backend/services/historialService.js` | Historial de movimientos (entradas/salidas). |
| ReporteService | `src/backend/services/reporteService.js` | Genera reportes (ExcelJS). |
| RecibosService | `src/backend/services/recibosService.js` | Gestión de recibos y comprobantes. |
| StockService | `src/backend/services/stockService.js` | Obtiene medicamentos por debajo del stock mínimo y genera Excel de "Sin Stock". |
| ImportacionService | `src/backend/services/importacionService.js` | Parseo de Excel, validación, previsualización e importación (estrategias: permitir/omitir/sobrescribir) y registro de movimientos. |

## IPC Handlers (Main Process)

| Handler | Archivo | Descripción |
|---------|---------|-------------|
| Importación | `src/backend/ipcHandlers/importacionHandlers.js` | Expone `importacion:previsualizar` e `importacion:importar`. Emite progreso por `importacion:progress`. |

## Vistas HTML

| Vista | Archivo | Propósito |
|-------|---------|-----------|
| Panel Principal | `src/frontend/views/dashboard.html` | Estadísticas globales del inventario. |
| Gestión | `src/frontend/views/gestion.html` | CRUD de medicamentos y filtros de búsqueda. |
| Nuevo Medicamento | `src/frontend/views/nuevo_medicamento.html` | Formulario para registrar un nuevo medicamento. |
| Editar Medicamento | `src/frontend/views/editar_medicamento.html` | Edición de datos de un medicamento existente. |
| Detalle Medicamento | `src/frontend/views/medicamento_detalle.html` | Información detallada de un medicamento y su stock. |
| Entradas | `src/frontend/views/entradas.html` | Registro de nuevas entradas (lotes) al inventario. |
| Salidas | `src/frontend/views/salidas.html` | Registro de salidas de inventario. |
| Salidas Modificar | `src/frontend/views/salidas_mod.html` | Ajuste de salidas existentes. |
| Editar Lote | `src/frontend/views/editar_lote.html` | Modificar información de un lote. |
| Vencimientos | `src/frontend/views/vencimientos.html` | Listado de medicamentos próximos a vencer. |
| Sin Stock | `src/frontend/views/sin_stock.html` | Listado de medicamentos con stock por debajo del mínimo y exportación a Excel. |
| Historial | `src/frontend/views/historial.html` | Consulta del historial de movimientos. |
| Reportes | `src/frontend/views/reportes.html` | Generación y descarga de reportes en Excel. |
| Recibos | `src/frontend/views/recibos.html` | Gestión y consulta de recibos. |
| Importación | `src/frontend/views/importacion.html` | Carga de un archivo Excel, previsualización y ejecución de importación a la BD. |

---

**Sugerencia:** mantén este documento actualizado al crear o renombrar archivos para asegurar que la referencia sea precisa.

