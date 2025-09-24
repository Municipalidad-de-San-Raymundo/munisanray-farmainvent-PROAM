# Importación de Datos desde Excel

Esta guía describe la nueva funcionalidad de importación de datos desde archivos Excel a la base de datos existente de la aplicación. La importación se realiza desde la interfaz de usuario y permite previsualización, validación y manejo de duplicados.

## Vista de Importación

- **Ubicación**: `src/frontend/views/importacion.html`
- **Inicialización**: `initializeImportacionView()` en `src/frontend/renderer.js`
- **Acceso**: Menú lateral → Administración → Importación

## Formato del Archivo Excel

La estructura del Excel es la misma que espera `scripts/migracion.js`:

- Columna A: Código del medicamento (`codigo_medicamento`)
- Columna B: Descripción
- Columna C: Cantidad (entero no negativo)
- Columna D: Precio unitario (opcional)
- Columna E: Importe (opcional; si no se indica, se calcula Cantidad × Precio Unitario)
- Columna F: Número de lote (si está vacío, se usa `SINLOTE`)
- Columna G: Fecha de vencimiento (se normaliza a `YYYY-MM-DD`)

## Validaciones Mínimas

- Código y descripción son obligatorios.
- Cantidad debe ser un entero no negativo.
- Precio unitario e importe, si se proporcionan, deben ser numéricos.
- La fecha de vencimiento se normaliza con la misma lógica que `scripts/migracion.js` (utilidad `toISODate`).

## Previsualización

Antes de importar, la vista permite "Previsualizar" para:

- Ver un resumen de filas válidas/ inválidas, duplicados y medicamentos nuevos/existentes.
- Ver cada fila con su estado: `nuevo`, `existente`, `duplicado`, `invalido`.
- Revisar errores por fila (si aplica).

Canal IPC utilizado: `importacion:previsualizar`.

## Estrategia de Duplicados

Clave de duplicado: `codigo_medicamento` + `numero_lote` + `fecha_vencimiento`.

Opciones disponibles:

- `Omitir duplicados`: no hace cambios cuando ya existe el lote.
- `Permitir duplicados`: inserta un nuevo lote (aunque exista el mismo) y registra un Movimiento de `Entrada`.
- `Sobrescribir duplicados`: actualiza el lote existente (cantidad, precio, importe, fecha). Registra Movimiento por el delta: `Entrada` si aumenta, `Salida` si disminuye.

Estas opciones se controlan desde el selector en la vista `importacion.html` y viajan como `options.duplicateStrategy` en el IPC.

## Importación y Trazabilidad

- La importación reutiliza la **misma instancia de base de datos** (`src/backend/database.js`).
- Medicamento existente se detecta por `codigo_medicamento`.
  - Si existe, no se crea un nuevo medicamento.
  - Si está inactivo (`activo = 0`), se **reactiva** para permitir la importación de lotes.
- Para lotes:
  - Si no existe, se inserta y se registra un Movimiento de `Entrada`.
  - Si existe, depende de la estrategia de duplicados.
- Todos los cambios de lotes se realizan dentro de una **transacción por fila** para garantizar atomicidad.
- Los movimientos se registran en la tabla `Movimientos` para mantener historial de entradas y ajustes.

Canales IPC utilizados:

- `importacion:importar` — ejecuta la importación.
- `importacion:progress` — emite progreso en tiempo real `{ processed, total, percent }`.

## Componentes Técnicos

- Servicio: `src/backend/services/importacionService.js`
  - `previsualizarExcel(db, buffer, options)`
  - `importarExcel(db, buffer, options, onProgress)`
  - Utilidades de fecha: `toISODate`, `excelSerialToDate`
- Handlers IPC: `src/backend/ipcHandlers/importacionHandlers.js`
  - Registra `importacion:previsualizar` e `importacion:importar`
- UI/Renderer: `src/frontend/renderer.js`
  - `initializeImportacionView()`
  - Suscripción a `importacion:progress`

## Recomendaciones de Uso

- Realiza una **previsualización** antes de importar para verificar el impacto.
- Comienza con la estrategia `Omitir duplicados` para evitar duplicaciones accidentales.
- Usa `Sobrescribir duplicados` solo si el Excel es la fuente de verdad y deseas ajustar las cantidades de los lotes existentes.

## Consideraciones de Rendimiento

- Para archivos .xlsx muy grandes, la conversión a base64 en el renderer puede tardar. Como mejora, se puede:
  - Enviar `ArrayBuffer` directamente por IPC.
  - Usar ExcelJS en modo streaming.

## Seguridad y Errores

- Solo se aceptan archivos `.xlsx` desde la UI.
- Los errores por fila se reportan en el resumen final y no detienen el proceso completo.
- La importación usa transacciones por fila y se realiza un `ROLLBACK` en caso de error en esa fila.

---

## Preguntas Frecuentes (FAQ)

- **¿Se puede cambiar la descripción del medicamento si difiere?**
  - Actualmente no se actualiza automáticamente. Se puede añadir una opción futura para actualizar la descripción bajo confirmación.
- **¿Cómo se evita duplicar stock por reimportación del mismo archivo?**
  - Usar la estrategia `Omitir duplicados`.
- **¿Se registran movimientos siempre?**
  - Sí, se registran `Entrada` al crear nuevos lotes y `Entrada/Salida` en sobrescrituras según el delta.
