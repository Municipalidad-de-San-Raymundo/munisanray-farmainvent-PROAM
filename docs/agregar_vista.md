# Guía para Agregar una Nueva Vista y Lógica

Esta guía explica, de forma breve y práctica, cómo añadir una nueva vista (HTML) al frontend, su lógica en el renderer, los handlers IPC en el proceso principal y el servicio de backend asociado.

## 1) Crear la Vista HTML

- Ubicación: `src/frontend/views/`
- Crea, por ejemplo, `mi_feature.html` con estructura Bulma:

```html
<section class="section">
  <div class="container">
    <h1 class="title is-4">Mi Feature</h1>
    <div class="box">
      <div class="field">
        <label class="label">Campo</label>
        <div class="control"><input id="mi_campo" class="input" type="text"></div>
      </div>
      <button id="btn_accion" class="button is-primary">Acción</button>
    </div>
    <div id="mi_resultado" class="content"></div>
  </div>
</section>
```

## 2) Añadir la opción en el Menú

- Archivo: `src/frontend/menu.html`
- Agrega un item con `data-page` que apunte a tu vista:

```html
<li><a href="#" class="nav-item" data-page="mi_feature"><span class="icon is-small mr-2"><i class="fas fa-star"></i></span> Mi Feature</a></li>
```

## 3) Cargar la vista desde `renderer.js`

- Archivo: `src/frontend/renderer.js`
- En la función `loadPageContent(page)`, añade un branch para tu página y una función de inicialización:

```js
else if (page === 'mi_feature') {
  initializeMiFeatureView();
}
```

- Implementa `initializeMiFeatureView()` (en el mismo `renderer.js` o en un archivo separado si escalas la UI):

```js
function initializeMiFeatureView(){
  const btn = document.getElementById('btn_accion');
  const campo = document.getElementById('mi_campo');
  const salida = document.getElementById('mi_resultado');
  if(!btn) return; // vista no cargada aún

  btn.addEventListener('click', async ()=>{
    const valor = campo.value.trim();
    const res = await window.electronAPI.invoke('miFeature:procesar', { valor });
    salida.textContent = res.success ? 'OK' : (res.message || 'Error');
  });
}
```

## 4) Crear los Handlers IPC

- Ubicación: `src/backend/ipcHandlers/miFeatureHandlers.js`

```js
const miFeatureService = require('../services/miFeatureService');

function registerHandlers(ipcMain, db){
  ipcMain.handle('miFeature:procesar', async (event, payload) => {
    try{
      const r = await miFeatureService.procesar(db, payload);
      return { success: true, data: r };
    }catch(err){
      return { success: false, message: err.message };
    }
  });
}

module.exports = { registerHandlers };
```

- Importa y registra en `main.js`:

```js
const { registerHandlers: registerMiFeatureHandlers } = require('./src/backend/ipcHandlers/miFeatureHandlers');
// dentro de app.whenReady()
registerMiFeatureHandlers(ipcMain, db);
```

## 5) Crear el Servicio de Backend

- Ubicación: `src/backend/services/miFeatureService.js`

```js
async function procesar(db, { valor }){
  if(!valor) throw new Error('Valor requerido');
  // Acceso a BD de ejemplo:
  // await run(db, 'INSERT INTO Tabla(...) VALUES (...)', [valor]);
  return { echo: valor };
}

module.exports = { procesar };
```

## 6) (Opcional) Extender la Base de Datos

- Si necesitas nuevas tablas o columnas, edítalas en `src/backend/database.js` con `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE ... ADD COLUMN`.

## 7) Buenas Prácticas

- **Nomenclatura de canales IPC**: `modulo:accion` (ej.: `recibo:generar`).
- **Transacciones** para operaciones que afecten varias tablas.
- **Validaciones** tanto en renderer (básicas) como en backend (críticas).
- **Progreso/feedback** en UI para tareas largas.
- **Documentación**: actualiza `docs/estructura_archivos.md` y este documento.
