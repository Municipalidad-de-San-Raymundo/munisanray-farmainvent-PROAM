document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar-container');
    const burger = document.querySelector('.sidebar-burger');
    const overlay = document.querySelector('.content-overlay');

    const toggleSidebar = () => {
        sidebar.classList.toggle('is-active');
        burger.classList.toggle('is-active');
        overlay.classList.toggle('is-active');
    };

    if (burger) {
        burger.addEventListener('click', toggleSidebar);
    }
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }

    // Cargar el menú
    fetch('menu.html')
        .then(response => response.text())
        .then(data => {
            const sidebarContainer = document.getElementById('sidebar-container');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = data; // Cargar menú en el contenedor
            } else {
                console.error('Contenedor del sidebar #sidebar-container no encontrado.');
            }
            initializeMenuNavigation(); // Inicializar la navegación después de cargar el menú
        })
        .catch(error => console.error('Error al cargar el menú:', error));

    updateCurrentDate();
    // Cargar el dashboard por defecto inicialmente (se llamará desde initializeMenuNavigation)
});

// Utilidad para mostrar notificaciones al estilo Bulma
function showNotification(message, type = 'is-success', duration = 4000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.warn('Contenedor de notificaciones no encontrado.');
        return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<button class="delete"></button>${message}`;

    // Cerrar manualmente
    notification.querySelector('.delete').addEventListener('click', () => {
        container.removeChild(notification);
    });

    container.appendChild(notification);

    // Cerrar automáticamente después de X ms
    setTimeout(() => {
        if (container.contains(notification)) {
            container.removeChild(notification);
        }
    }, duration);
}

// ------------------- Modal de confirmación -------------------
function ensureConfirmModal() {
    if (document.getElementById('confirmModal')) return;
    const div = document.createElement('div');
    div.id = 'confirmModal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-background"></div>
        <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title">Confirmar</p>
                <button class="delete" aria-label="close"></button>
            </header>
            <section class="modal-card-body" id="confirmModalBody"></section>
            <footer class="modal-card-foot">
                <button class="button is-danger" id="confirmModalOk">Sí</button>
                <button class="button" id="confirmModalCancel">Cancelar</button>
            </footer>
        </div>`;
    document.body.appendChild(div);
}

function showConfirmModal(message = '') {
    return new Promise(resolve => {
        ensureConfirmModal();
        const modal = document.getElementById('confirmModal');
        const body = document.getElementById('confirmModalBody');
        const okBtn = document.getElementById('confirmModalOk');
        const cancelBtn = document.getElementById('confirmModalCancel');
        const closeBtn = modal.querySelector('.delete');

        body.textContent = message;
        modal.classList.add('is-active');

        const cleanup = (result) => {
            modal.classList.remove('is-active');
            okBtn.removeEventListener('click', okHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
            closeBtn.removeEventListener('click', cancelHandler);
            resolve(result);
        };

        const okHandler = () => cleanup(true);
        const cancelHandler = () => cleanup(false);

        okBtn.addEventListener('click', okHandler);
        cancelBtn.addEventListener('click', cancelHandler);
        closeBtn.addEventListener('click', cancelHandler);
    });
}

/**
 * Inicializa el formulario para registrar una nueva entrada de stock (lote).
 * Carga los medicamentos en un selector y maneja el envío del formulario.
 */
async function initializeRegistrarEntradaForm() {
    const form = document.getElementById('form-registrar-entrada');
    const medInput = document.getElementById('medicamento-buscar');
    const medDatalist = document.getElementById('medicamentos-dl');
    let medicamentosCache = [];

    if (!form || !medInput || !medDatalist) {
        console.log('Formulario de registro de entrada no encontrado en esta vista.');
        return;
    }

    // 1. Cargar medicamentos y poblar datalist
    try {
        const resultado = await window.electronAPI.invoke('medicamentos:obtenerTodos');
        if (resultado.success) {
            medicamentosCache = resultado.data;
            medDatalist.innerHTML = '';
            medicamentosCache.forEach(med => {
                const option = document.createElement('option');
                option.value = `${med.descripcion}`; // mostrar descripción
                option.setAttribute('data-id', med.id_medicamento);
                medDatalist.appendChild(option);
            });
        } else {
            console.error('Error al obtener medicamentos:', resultado.message);
        }
    } catch (error) {
        console.error('Error IPC al cargar medicamentos:', error);
    }

    // 2. Manejar el envío del formulario
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const precioUnitario = parseFloat(document.getElementById('precio-unitario').value);
        const datos = {
            id_medicamento: (() => {
                const val = medInput.value.trim();
                const med = medicamentosCache.find(m => m.descripcion === val);
                return med ? med.id_medicamento : null;
            })(),
            numero_lote: document.getElementById('numero-lote').value.trim(),
            cantidad_entrada: parseInt(document.getElementById('cantidad-entrada').value, 10),
            fecha_vencimiento: document.getElementById('fecha-vencimiento').value,
            proveedor: document.getElementById('proveedor').value.trim() || null,
            precio_unitario: isNaN(precioUnitario) ? null : precioUnitario
        };

        if (!datos.id_medicamento || !datos.numero_lote || isNaN(datos.cantidad_entrada) || !datos.fecha_vencimiento) {
            showNotification('Complete todos los campos obligatorios: medicamento, número de lote, cantidad y fecha de vencimiento.', 'is-danger');
            return;
        }
        if (datos.cantidad_entrada <= 0) {
            showNotification('La cantidad debe ser un número positivo.', 'is-danger');
            return;
        }

        try {
            const resultado = await window.electronAPI.invoke('lotes:registrarEntrada', datos);
            if (resultado.success) {
                showNotification(resultado.message, 'is-success');
                form.reset();
            } else {
                showNotification(`Error al registrar la entrada: ${resultado.message}`, 'is-danger');
            }
        } catch (error) {
            console.error('Error en IPC al registrar entrada:', error);
            showNotification('Error de comunicación al registrar la entrada.', 'is-danger');
        }
    });

    // Calcular importe total al cambiar cantidad o precio
    const cantidadInput = document.getElementById('cantidad-entrada');
    const precioInput = document.getElementById('precio-unitario');
    const importeInput = document.getElementById('importe-total');

    function actualizarImporte() {
        const cant = parseInt(cantidadInput.value, 10);
        const precio = parseFloat(precioInput.value);
        if (!isNaN(cant) && !isNaN(precio)) {
            importeInput.value = (cant * precio).toFixed(2);
        } else {
            importeInput.value = '';
        }
    }

    cantidadInput.addEventListener('input', actualizarImporte);
    precioInput.addEventListener('input', actualizarImporte);
}

// ---------------- Detalle Medicamento ----------------
async function initializeDetalleMedicamento(id){
    const volverBtn=document.getElementById('btn-volver-gestion');
    volverBtn?.addEventListener('click',()=>{
        loadPageContent('gestion').then(()=>cargarYMostrarMedicamentos(currentMedPage));
    });

    try{
        const medRes=await window.electronAPI.invoke('medicamentos:obtener', id);
        if(!medRes.success) throw new Error(medRes.message);
        const med=medRes.data;
        const lotesRes=await window.electronAPI.invoke('lotes:porMedicamento', id);
        if(!lotesRes.success) throw new Error(lotesRes.message);
        const lotes=lotesRes.data;

        // Info medicamento
        const infoDiv=document.getElementById('info-content');
        infoDiv.innerHTML=`
            <p><strong>Código:</strong> ${med.codigo_medicamento}</p>
            <p><strong>Descripción:</strong> ${med.descripcion}</p>
            <p><strong>Principio Activo:</strong> ${med.principio_activo||'-'}</p>
            <p><strong>Forma Farmacéutica:</strong> ${med.forma_farmaceutica||'-'}</p>
            <p><strong>Concentración:</strong> ${med.concentracion||'-'}</p>
            <p><strong>Unidad:</strong> ${med.unidad_medida||'-'}</p>
            <p><strong>Stock Total:</strong> ${med.stock_total}</p>
            <p><strong>Stock Mínimo:</strong> ${med.stock_minimo}</p>`;

        // Lotes
        const lotesContainer=document.getElementById('lotes-container');
        if(lotes.length===0){
            lotesContainer.innerHTML='<p class="has-text-centered is-italic">No hay lotes registrados.</p>';
        }else{
            lotesContainer.innerHTML='';
            lotes.forEach(l=>{
                const col=document.createElement('div');
                col.className='column is-one-quarter';
                const card=document.createElement('div');
                card.className='card';
                card.innerHTML=`
                   <div class="card-content">
                      <p><strong>Lote:</strong> ${l.numero_lote}</p>
                      <p><strong>Vence:</strong> ${l.fecha_vencimiento}</p>
                      <p><strong>Cantidad:</strong> ${l.cantidad_actual}</p>
                   </div>
                   <footer class="card-footer">
                     <a class="card-footer-item has-text-info btn-edit-lote" data-id="${l.id_lote}"><span class="icon is-small"><i class="fas fa-edit"></i></span></a>
                     <a class="card-footer-item has-text-danger btn-del-lote" data-id="${l.id_lote}"><span class="icon is-small"><i class="fas fa-trash"></i></span></a>
                   </footer>`;
                col.appendChild(card);
                lotesContainer.appendChild(col);

                // handlers
                const editBtn=card.querySelector('.btn-edit-lote');
                const delBtn=card.querySelector('.btn-del-lote');

                editBtn.addEventListener('click',async ()=>{
                    loadPageContent('editar_lote').then(()=>initializeEditarLoteForm(l.id_lote, id)); return;
                    if(nuevaCant===null) return;
                    const cant=parseInt(nuevaCant,10);
                    if(isNaN(cant)||cant<0){showNotification('Cantidad inválida','is-danger');return;}
                    const ok=await showConfirmModal('¿Guardar cambios?');
                    if(!ok) return;
                    const res=await window.electronAPI.invoke('lotes:actualizar',{id:l.id_lote,datos:{cantidad_actual:cant}});
                    showNotification(res.message,res.success?'is-success':'is-danger');
                    if(res.success) initializeDetalleMedicamento(id);
                });

                delBtn.addEventListener('click',async ()=>{
                    const ok=await showConfirmModal('¿Eliminar este lote?');
                    if(!ok) return;
                    const res=await window.electronAPI.invoke('lotes:eliminar', l.id_lote);
                    showNotification(res.message,res.success?'is-success':'is-danger');
                    if(res.success) initializeDetalleMedicamento(id);
                });
            });
        }
    }catch(err){
        showNotification(err.message,'is-danger');
    }
}

async function initializeEditarLoteForm(idLote,idMedicamento){
    const numeroInput=document.getElementById('edit-numero-lote');
    const fechaInput=document.getElementById('edit-fecha-venc');
    const cantInput=document.getElementById('edit-cantidad');
    const precioInput=document.getElementById('edit-precio');
    const form=document.getElementById('form-editar-lote');
    document.getElementById('btn-cancelar-edit-lote').addEventListener('click',()=>{
        loadPageContent('medicamento_detalle').then(()=>initializeDetalleMedicamento(idMedicamento));
    });
    const res=await window.electronAPI.invoke('lotes:obtener', idLote);
    if(!res.success){showNotification(res.message,'is-danger');return;}
    const l=res.data;
    numeroInput.value=l.numero_lote;
    fechaInput.value=l.fecha_vencimiento;
    cantInput.value=l.cantidad_actual;
    precioInput.value=l.precio_unitario_compra||'';

    numeroInput.placeholder='Número de lote';
    fechaInput.placeholder='Fecha venc.';
    cantInput.placeholder='Cantidad';
    precioInput.placeholder='Precio';

    form.onsubmit=async (e)=>{
        e.preventDefault();
        const datos={
            numero_lote: numeroInput.value.trim(),
            fecha_vencimiento: fechaInput.value,
            cantidad_actual: parseInt(cantInput.value,10)||0,
            precio_unitario_compra: precioInput.value?parseFloat(precioInput.value):null,
            importe_total:null
        };
        datos.importe_total=datos.precio_unitario_compra?datos.precio_unitario_compra*datos.cantidad_actual:null;
        const ok=await showConfirmModal('¿Guardar cambios del lote?');
        if(!ok) return;
        const upd=await window.electronAPI.invoke('lotes:actualizar',{id:idLote,datos});
        showNotification(upd.message, upd.success?'is-success':'is-danger');
        if(upd.success){
            loadPageContent('medicamento_detalle').then(()=>initializeDetalleMedicamento(idMedicamento));
        }
    };
}

function updateCurrentDate() {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString('es-ES', options);
    }
}

function initializeMenuNavigation() {
    const navItems = document.querySelectorAll('.nav-item'); // Guardamos la selección
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();

            // Cerrar el menú si está abierto en modo móvil
            const sidebar = document.getElementById('sidebar-container');
            if (sidebar.classList.contains('is-active')) {
                const burger = document.querySelector('.sidebar-burger');
                const overlay = document.querySelector('.content-overlay');
                sidebar.classList.remove('is-active');
                burger.classList.remove('is-active');
                overlay.classList.remove('is-active');
            }

            // Lógica de navegación existente
            navItems.forEach(i => {
                i.classList.remove('is-active');
            });
            this.classList.add('is-active');
            
            const pageTitleText = this.textContent.trim();
            const pageTitleElement = document.getElementById('pageTitle');
            if (pageTitleElement) {
                pageTitleElement.textContent = pageTitleText;
            }
           
            const page = this.getAttribute('data-page');
            loadPageContent(page);
        });
    });

    // Cargar el dashboard por defecto al inicializar
    // Buscamos el item con .nav-item y .is-active
    const initialActiveItem = document.querySelector('.nav-item.is-active');
    let initialPage = 'dashboard'; // Default
    let initialPageTitle = 'Dashboard'; // Default

    if (initialActiveItem) {
        initialPage = initialActiveItem.getAttribute('data-page') || 'dashboard';
        initialPageTitle = initialActiveItem.textContent.trim() || 'Dashboard';
    } else {
        // Si por alguna razón no hay .is-active, activamos el primero (dashboard)
        const dashboardItem = document.querySelector('.nav-item[data-page="dashboard"]');
        if (dashboardItem) {
            dashboardItem.classList.add('is-active');
        }
    }
    
    loadPageContent(initialPage);
    const pageTitleElement = document.getElementById('pageTitle');
    if (pageTitleElement) {
        pageTitleElement.textContent = initialPageTitle;
    }
}

async function loadPageContent(page) {
    return new Promise((resolve, reject) => {
    const contentDiv = document.getElementById('mainContent');
    if (!contentDiv) {
        console.error('Elemento #mainContent no encontrado.');
        return;
    }

    fetch(`views/${page}.html`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar la vista: ${response.statusText}`);
            }
            return response.text();
        })
        .then(htmlContent => {
            contentDiv.innerHTML = htmlContent;

            // Ejecutar lógica específica después de cargar el contenido
            if (page === 'dashboard') {
                cargarDashboardStats();
            } else if (page === 'gestion') {
                currentMedSearch = '';
                const input = document.getElementById('med-search-input');
                const btn = document.getElementById('btn-med-search');
                const clearAndLoad = () => { currentMedPage = 1; cargarYMostrarMedicamentos(1); };
                btn?.addEventListener('click', () => {
                    currentMedSearch = input.value.trim();
                    clearAndLoad();
                });
                input?.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); currentMedSearch = input.value.trim(); clearAndLoad(); }});
                
                // Navegar al formulario de nuevo medicamento
                document.getElementById('btn-ir-a-registrar-medicamento')?.addEventListener('click', ()=>{
                    loadPageContent('nuevo_medicamento');
                });
                
                cargarYMostrarMedicamentos();
            } else if (page === 'entradas') {
                initializeRegistrarEntradaForm();
            } else if (page === 'salidas') {
                initializeRegistrarSalidaForm();
            } else if (page === 'vencimientos') {
                cargarYMostrarVencimientos();
            } else if (page === 'sin_stock') {
                cargarYMostrarSinStock();
                document.getElementById('btn-exportar-sin-stock')?.addEventListener('click', async ()=>{
                    const res = await window.electronAPI.invoke('stock:excel');
                    showNotification(res.message, res.success ? 'is-success' : 'is-danger');
                });
            } else if (page === 'nuevo_medicamento') {
                initializeNuevoMedicamentoForm();
            } else if (page === 'editar_lote') {
                // inicializado luego
            } else if (page === 'medicamento_detalle') {
                // el inicializador se llama después de loadPageContent desde botón detalle
            } else if (page === 'historial') {
                cargarHistorial();
            } else if (page === 'reportes') {
                // Evento para generar reporte de movimientos (existente)
                document.getElementById('btnGenerarRango')?.addEventListener('click',()=>{
                    const tipo=document.getElementById('tipo_reporte').value;
                    const desde=document.getElementById('fecha_inicio_reporte').value;
                    const hasta=document.getElementById('fecha_fin_reporte').value;
                    if(!desde||!hasta){showNotification('Seleccione rango de fechas','is-danger');return;}
                    window.electronAPI.invoke('reporte:excelRango',{tipoReporte:tipo,desde,hasta}).then(r=>{
                        showNotification(r.message,r.success?'is-success':'is-danger');
                    });
                });
                
                // Evento para generar reporte de recibos (nuevo)
                document.getElementById('btnGenerarReciboExcel')?.addEventListener('click', () => {
                    const tipoRecibo = document.getElementById('tipo_recibo').value;
                    const desde = document.getElementById('fecha_inicio_recibo').value;
                    const hasta = document.getElementById('fecha_fin_recibo').value;
                    
                    if (!desde || !hasta) {
                        showNotification('Seleccione rango de fechas para el reporte de recibos', 'is-danger');
                        return;
                    }
                    
                    const mostrarAnulados = tipoRecibo === 'anulados';
                    
                    window.electronAPI.invoke('reporte:excelRecibos', {
                        desde,
                        hasta,
                        mostrarAnulados
                    }).then(resultado => {
                        showNotification(resultado.message, resultado.success ? 'is-success' : 'is-danger');
                    });
                });
                
                // Inicializar las fechas con el día actual
                const hoy = new Date().toISOString().split('T')[0];
                document.getElementById('fecha_inicio_recibo').value = hoy;
                document.getElementById('fecha_fin_recibo').value = hoy;
            } else if (page === 'importacion') {
                initializeImportacionView();
            } else if (page === 'recibos') {
                initializeRecibosView();
            }
                resolve();
            })
        .catch(error => {
            console.error(`Error al cargar la página ${page}:`, error);
            contentDiv.innerHTML = `<div class="notification is-danger">Error al cargar la página '${page}'.</div>`;
            reject(error);
        });
    });
}

let currentMedPage = 1;
let currentMedSearch = '';
const MEDS_PER_PAGE = 20;

async function cargarYMostrarMedicamentos(page = 1) {
    currentMedPage = page;
    const tablaBody = document.getElementById('tabla-medicamentos-body');
    const pagination = document.getElementById('medicamentos-pagination');
    if (!tablaBody || !pagination) return;
    tablaBody.innerHTML = '<tr><td colspan="9" class="has-text-centered">Cargando medicamentos...</td></tr>';
    try {
        const channel = currentMedSearch ? 'medicamentos:buscarPaginado' : 'medicamentos:listarPaginado';
        const payload = currentMedSearch ? { termino: currentMedSearch, limit: MEDS_PER_PAGE, page } : { limit: MEDS_PER_PAGE, page };
        const res = await window.electronAPI.invoke(channel, payload);
        if (!res.success) throw new Error(res.message);

        renderMedicamentosRows(res.items, tablaBody);
        setupPagination(res.total, page, pagination);
    } catch (e) {
        tablaBody.innerHTML = `<tr><td colspan="9" class="has-text-centered">${e.message}</td></tr>`;
        pagination.style.display = 'none';
    }
}

function renderMedicamentosRows(medicamentos, tbody) {
    if (medicamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="has-text-centered">No hay medicamentos registrados.</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    medicamentos.forEach(med => {
        const tr = document.createElement('tr');
        const stockClass = med.stock_total <= med.stock_minimo ? 'has-text-danger' : '';
        tr.innerHTML = `
            <td>${med.codigo_medicamento}</td>
            <td>${med.descripcion}</td>
            <td>${med.principio_activo || '-'}</td>
            <td>${med.forma_farmaceutica || '-'}</td>
            <td>${med.concentracion || '-'}</td>
            <td>${med.unidad_medida || '-'}</td>
            <td class="${stockClass}">${med.stock_total}</td>
            <td>${med.stock_minimo}</td>
            <td>
                <button class="button is-small is-primary btn-detalle-med mr-1" title="Detalle" data-id="${med.id_medicamento}">
                   <span class="icon is-small"><i class="fas fa-circle-info"></i></span>
                </button>
                <button class="button is-small is-info btn-editar-med mr-1" data-id="${med.id_medicamento}">Editar</button>
               <button class="button is-small is-danger ml-1 btn-eliminar-med" data-id="${med.id_medicamento}">Eliminar</button>
            </td>`;
        tbody.appendChild(tr);

        // Listener detalle
        const detalleBtn = tr.querySelector('.btn-detalle-med');
        detalleBtn.addEventListener('click', () => {
            const id = parseInt(detalleBtn.getAttribute('data-id'),10);
            loadPageContent('medicamento_detalle').then(()=>{
                initializeDetalleMedicamento(id);
            });
        });

        // Listener editar
        const editBtn = tr.querySelector('.btn-editar-med');
        editBtn.addEventListener('click', () => {
            const id = parseInt(editBtn.getAttribute('data-id'),10);
            loadPageContent('editar_medicamento').then(()=>{
                initializeEditarMedicamentoForm(id);
            });
        });

        // Listener eliminar
        const delBtn = tr.querySelector('.btn-eliminar-med');
        delBtn.addEventListener('click', async () => {
            const confirmar = await showConfirmModal('¿Está seguro de eliminar este medicamento?');
            if(!confirmar) return;
            const id = parseInt(delBtn.getAttribute('data-id'), 10);
            const res = await window.electronAPI.invoke('medicamentos:eliminar', id);
            if(res.success){
                showNotification('Medicamento eliminado','is-success');
                cargarYMostrarMedicamentos(currentMedPage);
                cargarDashboardStats();
            }else{
                showNotification(res.message,'is-danger');
            }
        });
    });
}

// ---------------- Formulario editar medicamento ----------------
async function initializeEditarMedicamentoForm(id){
    const codigoInput=document.getElementById('edit-codigo-medicamento');
    const descInput=document.getElementById('edit-descripcion');
    const principioInput=document.getElementById('edit-principio');
    const formaInput=document.getElementById('edit-forma');
    const concInput=document.getElementById('edit-concentracion');
    const unidadInput=document.getElementById('edit-unidad');
    const stockMinInput=document.getElementById('edit-stock-min');

    // cargar datos
    const res=await window.electronAPI.invoke('medicamentos:obtener', id);
    if(!res.success){
        showNotification(res.message,'is-danger');
        loadPageContent('gestion');
        return;
    }
    const med=res.data;
    codigoInput.value=med.codigo_medicamento;
    descInput.value=med.descripcion;
    principioInput.value=med.principio_activo||'';
    formaInput.value=med.forma_farmaceutica||'';
    concInput.value=med.concentracion||'';
    unidadInput.value=med.unidad_medida||'';
    stockMinInput.value=med.stock_minimo;

    const form=document.getElementById('form-editar-medicamento');
    form.onsubmit=async (e)=>{
        e.preventDefault();
        const datos={
            codigo_medicamento: codigoInput.value.trim(),
            descripcion: descInput.value.trim(),
            principio_activo: principioInput.value.trim()||null,
            forma_farmaceutica: formaInput.value.trim()||null,
            concentracion: concInput.value.trim()||null,
            unidad_medida: unidadInput.value.trim()||null,
            stock_minimo: parseInt(stockMinInput.value,10) || 0
        };
        const updateRes=await window.electronAPI.invoke('medicamentos:actualizar',{id, datos});
        if(updateRes.success){
            showNotification('Medicamento actualizado','is-success');
            loadPageContent('gestion').then(()=>cargarYMostrarMedicamentos(currentMedPage));
            cargarDashboardStats();
        }else{
            showNotification(updateRes.message,'is-danger');
        }
    };

    document.getElementById('btn-cancelar-edit').onclick=()=>{
        loadPageContent('gestion').then(()=>cargarYMostrarMedicamentos(currentMedPage));
    };
}

function setupPagination(total, page, nav) {
    const totalPages = Math.ceil(total / MEDS_PER_PAGE);
    if (totalPages <= 1) {
        nav.style.display = 'none';
        return;
    }
    nav.style.display = '';
    const prev = nav.querySelector('.pagination-previous');
    const next = nav.querySelector('.pagination-next');
    const list = nav.querySelector('.pagination-list');

    prev.disabled = page === 1;
    next.disabled = page === totalPages;

    prev.onclick = () => cargarYMostrarMedicamentos(page - 1);
    next.onclick = () => cargarYMostrarMedicamentos(page + 1);

    list.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
            const li = document.createElement('li');
            li.innerHTML = `<a class="pagination-link ${i === page ? 'is-current' : ''}">${i}</a>`;
            li.querySelector('a').onclick = () => cargarYMostrarMedicamentos(i);
            list.appendChild(li);
        } else if (i === page - 3 || i === page + 3) {
            const li = document.createElement('li');
            li.innerHTML = '<span class="pagination-ellipsis">&hellip;</span>';
            list.appendChild(li);
        }
    }
}

async function cargarYMostrarVencimientos() {
    const body = document.getElementById('tabla-vencimientos-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="has-text-centered">Cargando lotes...</td></tr>';
    try {
        const res = await window.electronAPI.invoke('vencimientos:obtener', 40);
        if (res.success) {
            const lotes = res.data;
            if (lotes.length === 0) {
                body.innerHTML = '<tr><td colspan="6" class="has-text-centered">Sin lotes próximos a vencer.</td></tr>';
            } else {
                body.innerHTML = '';
                lotes.forEach(l => {
                    const tr = document.createElement('tr');
                    const dias = Math.floor(l.dias_restantes);
                    let cls = '';
                    if (dias <= 30) cls = 'has-text-danger has-text-weight-bold';
                    else if (dias <= 90) cls = 'has-text-warning';
                    tr.innerHTML = `
                        <td>${l.codigo_medicamento}</td>
                        <td>${l.descripcion}</td>
                        <td>${l.numero_lote}</td>
                        <td>${l.fecha_vencimiento}</td>
                        <td class="${cls}">${dias}</td>
                        <td>${l.cantidad_actual}</td>`;
                    body.appendChild(tr);
                });
            }
        } else {
            body.innerHTML = `<tr><td colspan="6" class="has-text-centered">${res.message}</td></tr>`;
        }
    } catch (e) {
        body.innerHTML = '<tr><td colspan="6" class="has-text-centered">Error al cargar datos.</td></tr>';
    }
}

async function cargarYMostrarSinStock() {
    const body = document.getElementById('tabla-sin-stock-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="4" class="has-text-centered">Cargando datos...</td></tr>';
    try {
        const res = await window.electronAPI.invoke('stock:obtenerBajo');
        if (res.success) {
            const meds = res.data;
            if (meds.length === 0) {
                body.innerHTML = '<tr><td colspan="4" class="has-text-centered">Todos los medicamentos están por encima del stock mínimo.</td></tr>';
            } else {
                body.innerHTML = '';
                meds.forEach(m => {
                    const tr = document.createElement('tr');
                    const cls = m.stock_total === 0 ? 'has-text-danger has-text-weight-bold' : 'has-text-warning';
                    tr.innerHTML = `
                        <td>${m.codigo_medicamento}</td>
                        <td>${m.descripcion}</td>
                        <td class="${cls}">${m.stock_total}</td>
                        <td>${m.stock_minimo}</td>`;
                    body.appendChild(tr);
                });
            }
        } else {
            body.innerHTML = `<tr><td colspan="4" class="has-text-centered">${res.message}</td></tr>`;
        }
    } catch (e) {
        body.innerHTML = '<tr><td colspan="4" class="has-text-centered">Error al cargar datos.</td></tr>';
    }
}

function initializeNuevoMedicamentoForm() {
    const form = document.getElementById('form-nuevo-medicamento');
    const btnCancel = document.getElementById('btn-cancelar-nuevo-med');
    if (!form) return;

    btnCancel?.addEventListener('click', () => {
        loadPageContent('gestion');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = {
            codigo_medicamento: document.getElementById('codigo-medicamento').value.trim(),
            descripcion: document.getElementById('descripcion').value.trim(),
            principio_activo: document.getElementById('principio-activo').value.trim(),
            forma_farmaceutica: document.getElementById('forma-farmaceutica').value.trim(),
            concentracion: document.getElementById('concentracion').value.trim(),
            unidad_medida: document.getElementById('unidad-medida').value.trim(),
            stock_minimo: parseInt(document.getElementById('stock-minimo').value, 10) || 0
        };

        if (!datos.codigo_medicamento || !datos.descripcion) {
            showNotification('Código y descripción son obligatorios', 'is-danger');
            return;
        }

        try {
            const res = await window.electronAPI.invoke('medicamentos:agregar', datos);
            if (res.success) {
                showNotification('Medicamento agregado', 'is-success');
                loadPageContent('gestion');
            } else {
                showNotification(res.message, 'is-danger');
            }
        } catch (err) {
            showNotification('Error de comunicación', 'is-danger');
        }
    });
}

async function cargarDashboardStats() {
    try {
        const res = await window.electronAPI.invoke('dashboard:stats');
        if (!res.success) throw new Error(res.message);
        const s = res.stats;
        document.getElementById('dash-total').innerText = s.total_medicamentos;
        document.getElementById('dash-proximos').innerText = s.proximos_vencer;
        document.getElementById('dash-agotados').innerText = s.agotados;
        document.getElementById('dash-valor').innerText = `Q${s.valor_inventario.toFixed(2)}`;
        document.getElementById('dash-bajo').innerText = s.por_debajo_minimo;
        document.getElementById('dash-vencidos').innerText = s.vencidos;
    } catch (err) {
        console.error(err);
    }
}

function initializeRegistrarSalidaForm() {
    // --- Referencias de elementos -----------------------------
    const form = document.querySelector('form');
    const medSelect = document.getElementById('medicamento_salida');
    const loteSelect = document.getElementById('lote_salida');
    const cantidadInput = document.getElementById('cantidad_salida');
    const dpiInput = document.getElementById('dpi_solicitante');
    const precioInput = document.getElementById('precio_venta_salida');
    const btnAgregar = document.getElementById('btn_agregar_salida');
    const btnRegistrar = document.getElementById('btn_registrar_salidas');
    const tablaBody = document.querySelector('#tabla_detalle_salidas tbody');

    if (!medSelect) return; // la vista aún no está lista

    // --- Estado interno ---------------------------------------
    const detallesSalida = []; // [{id_lote, id_med, descripcion, lote, cantidad, precioUnit, total}]

    // --- Función de redondeo personalizado -------------------
    const redondearQuetzales = (valor) => {
        const entero = Math.floor(valor);
        const decimal = +(valor - entero).toFixed(2); // Mantener dos decimales para precisión

        // Si el valor ya es exacto (sin parte decimal), no aplicar redondeo
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

    // --- Utilidades -------------------------------------------
    const calcTotalCampo = () => {
        const opt = loteSelect.selectedOptions[0];
        if (!opt) { precioInput.value=''; return; }
        const unit = parseFloat(opt.dataset.precio || 0);
        const qty  = parseInt(cantidadInput.value,10) || 0;
        precioInput.value = unit && qty ? (unit*qty).toFixed(2) : '';
    };

    const renderTabla = () => {
        const totalExactoEl = document.getElementById('total_exacto');
        const totalRedondeadoEl = document.getElementById('total_redondeado');
        
        if(detallesSalida.length===0){
            tablaBody.innerHTML='<tr><td colspan="5" class="has-text-centered">Sin medicamentos agregados</td></tr>';
            btnRegistrar.setAttribute('disabled','disabled');
            if(totalExactoEl) totalExactoEl.textContent = 'Q0.00';
            if(totalRedondeadoEl) totalRedondeadoEl.textContent = 'Q0.00';
            return;
        }
        
        // Calcular totales
        const totalExacto = detallesSalida.reduce((sum, d) => sum + d.total, 0);
        const totalRedondeado = redondearQuetzales(totalExacto);
        
        // Actualizar tabla
        tablaBody.innerHTML = detallesSalida.map((d,idx)=>`<tr>
            <td>${d.descripcion}</td>
            <td>${d.lote}</td>
            <td>${d.cantidad}</td>
            <td>Q${d.total.toFixed(2)}</td>
            <td><button class="button is-small is-light" data-idx="${idx}"><i class="fas fa-trash"></i></button></td>
        `).join('');
        
        // Actualizar totales
        if(totalExactoEl) totalExactoEl.textContent = `Q${totalExacto.toFixed(2)}`;
        if(totalRedondeadoEl) totalRedondeadoEl.textContent = `Q${totalRedondeado.toFixed(2)}`;
        
        btnRegistrar.removeAttribute('disabled');
    };

    const resetFormCampos = () => {
    // reiniciar selects de medicamento y lote (mantener DPI)
    if(choicesMed){ 
        choicesMed.removeActiveItems(); 
        choicesMed.setChoiceByValue(''); 
        choicesMed.destroy();
        choicesMed = new Choices(medSelect,{searchEnabled:true,itemSelectText:''});
    }
    medSelect.selectedIndex = 0; // vuelve al placeholder
    if(choicesLote){ choicesLote.clearStore(); }
    loteSelect.innerHTML='';
        cantidadInput.value='';
        precioInput.value='';
        loteSelect.selectedIndex=-1;
        // No se requiere actualización de campos para Bulma
    };

    // --- Variables para Choices ---------------------------------
    let choicesMed = null;
    let choicesLote = null;

    // --- Inicializar selects con Choices y datos ----------------
    window.electronAPI.invoke('salidas:medicamentosConStock').then(res=>{
        if(!res.success) return;
        medSelect.innerHTML = '<option value="">Seleccione medicamento</option>' + res.items.map(m=>`<option value="${m.id_medicamento}">${m.descripcion} (stock: ${m.stock_total})</option>`).join('');
        choicesMed = new Choices(medSelect,{searchEnabled:true,itemSelectText:''});
    });

    medSelect.addEventListener('change', async ()=>{
        const idMed = medSelect.value;
        if(!idMed) return;
        const res = await window.electronAPI.invoke('salidas:lotesPorMedicamento', parseInt(idMed,10));
        if(!res.success) return;
        loteSelect.innerHTML = res.items.map(l=>{
            const precioVenta = l.precio_unitario_compra ? (l.precio_unitario_compra*1.5).toFixed(2) : '';
            return `<option value="${l.id_lote}" data-stock="${l.cantidad_actual}" data-precio="${precioVenta}">${l.numero_lote} - vence ${l.fecha_vencimiento} (stock: ${l.cantidad_actual})</option>`;
        }).join('');
        if(choicesLote) { choicesLote.destroy(); }
        choicesLote = new Choices(loteSelect,{searchEnabled:true,itemSelectText:''});
        precioInput.value='';
    });

    cantidadInput.addEventListener('input', calcTotalCampo);
    loteSelect.addEventListener('change', calcTotalCampo);

    // --- Agregar a lista ---------------------------------------
    btnAgregar.addEventListener('click', ()=>{
        const selectedMed = medSelect.selectedOptions[0];
        const selectedLote = loteSelect.selectedOptions[0];
        const cant = parseInt(cantidadInput.value,10);

        if(!selectedMed || !selectedMed.value){ showNotification('Seleccione un medicamento','is-danger'); return; }
        if(!selectedLote){ showNotification('Seleccione un lote','is-danger'); return; }
        if(!cant || cant<=0){ showNotification('Cantidad inválida','is-danger'); return; }
        const stockDisp = parseInt(selectedLote.dataset.stock,10);
        if(cant>stockDisp){ showNotification('Cantidad supera stock del lote','is-danger'); return; }

        const precioUnit = parseFloat(selectedLote.dataset.precio||0);
        const detalle = {
            id_lote: parseInt(selectedLote.value,10),
            id_med: parseInt(selectedMed.value,10),
            descripcion: selectedMed.textContent,
            lote: selectedLote.textContent.split(' - ')[0],
            cantidad: cant,
            precioUnit,
            total: precioUnit*cant
        };

        detallesSalida.push(detalle);
        renderTabla();
        resetFormCampos();
    });

    // --- Quitar elemento de la tabla ---------------------------
    tablaBody.addEventListener('click', (e)=>{
        const btn = e.target.closest('button[data-idx]');
        if(!btn) return;
        const idx = parseInt(btn.dataset.idx,10);
        detallesSalida.splice(idx,1);
        renderTabla();
    });

    // --- Registrar lote de salidas -----------------------------
    btnRegistrar.addEventListener('click', async ()=>{
        if(detallesSalida.length===0) return;
        const confirmar = await showConfirmModal('¿Registrar todas las salidas listadas?');
        if(!confirmar) return;

        // Copia para el recibo antes de procesar (incluir IDs para trazabilidad)
        const detallesParaRecibo = detallesSalida.map(d=>({
            id_lote: d.id_lote,
            id_medicamento: d.id_med,
            descripcion: d.descripcion,
            lote: d.lote,
            cantidad: d.cantidad,
            precio_unitario: d.precioUnit,
            total: d.total
        }));

        // PRIMERO: Generar y guardar el PDF
        const resRecibo = await window.electronAPI.invoke('recibo:generar', { detalles: detallesParaRecibo, dpi: (dpiInput.value.trim() || 'no-ingresado') });
        
        // Si el usuario canceló el guardado del PDF, no continuar
        if(!resRecibo.success){
            if(resRecibo.message.includes('cancelado')){
                showNotification('Operación cancelada. Los medicamentos permanecen en la lista.','is-warning');
                return; // Mantener la tabla intacta
            } else {
                showNotification(resRecibo.message,'is-danger');
                return;
            }
        }

        // SEGUNDO: Si el PDF se guardó exitosamente, proceder con el registro de salidas
        let exitoGlobal = true;
        for(const d of detallesSalida){
            const datos = {
                id_lote: d.id_lote,
                cantidad_salida: d.cantidad,
                destino: null,
                observaciones: null,
                usuario: null,
                dpi_solicitante: (dpiInput.value.trim() || 'no-ingresado')
            };
            const res = await window.electronAPI.invoke('salidas:registrar', datos);
            if(!res.success){
                exitoGlobal = false;
                showNotification(res.message,'is-danger');
            }
        }
        
        if(exitoGlobal){
            showNotification('Salidas registradas y recibo generado correctamente','is-success');
            detallesSalida.length = 0;
            renderTabla();
            form.reset();
        } else {
            showNotification('Error al registrar algunas salidas. Revise los datos.','is-danger');
        }
    });

    // Render inicial
    renderTabla();
}

// ============================================================================
// VISTA DE RECIBOS
// ============================================================================
function initializeRecibosView() {
    const buscarInput = document.getElementById('buscar-codigo');
    const filtroEstado = document.getElementById('filtro-estado');
    const btnBuscar = document.getElementById('btn-buscar');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const recibosBody = document.getElementById('recibos-body');
    const paginationContainer = document.getElementById('recibos-pagination');
    
    if (!buscarInput) return; // Vista no cargada aún
    
    let currentPage = 1;
    const limit = 10;
    
    // Cargar recibos
    const cargarRecibos = async (page = 1, codigo = '', estado = '') => {
        try {
            const res = await window.electronAPI.invoke('recibo:listar', { page, limit, codigo, estado });
            if (res.success) {
                renderRecibos(res.data);
                renderPagination(res.pagination);
            } else {
                showNotification(res.message, 'is-danger');
            }
        } catch (err) {
            showNotification('Error cargando recibos', 'is-danger');
        }
    };
    
    // Renderizar tabla de recibos
    const renderRecibos = (recibos) => {
        if (recibos.length === 0) {
            recibosBody.innerHTML = '<tr><td colspan="7" class="has-text-centered">No se encontraron recibos</td></tr>';
            return;
        }
        
        recibosBody.innerHTML = recibos.map(r => {
            // Formatear fecha de manera segura
            let fechaFormateada = 'N/A';
            try {
                if (r.fecha) {
                    // Si la fecha viene en formato ISO o similar, convertir
                    const fecha = new Date(r.fecha);
                    if (!isNaN(fecha.getTime())) {
                        fechaFormateada = fecha.toLocaleString('es-GT', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } else {
                        // Si no es una fecha válida, mostrar el string original
                        fechaFormateada = r.fecha;
                    }
                }
            } catch (e) {
                fechaFormateada = r.fecha || 'N/A';
            }
            
            return `
            <tr>
                <td><strong>${r.codigo}</strong></td>
                <td>${fechaFormateada}</td>
                <td>${r.dpi_solicitante || 'N/A'}</td>
                <td>Q${r.total_exacto.toFixed(2)}</td>
                <td>Q${r.total_redondeado.toFixed(2)}</td>
                <td>
                    <span class="tag ${r.anulado ? 'is-danger' : 'is-success'}">
                        ${r.anulado ? 'Anulado' : 'Activo'}
                    </span>
                </td>
                <td>
                    <button class="button is-small is-info" onclick="verDetalleRecibo('${r.codigo}')">
                        <span class="icon"><i class="fas fa-eye"></i></span>
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    };
    
    // Renderizar paginación
    const renderPagination = (pagination) => {
        const { page, totalPages } = pagination;
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const numbersList = document.getElementById('pagination-numbers');
        
        // Botones anterior/siguiente
        prevBtn.disabled = page === 1;
        nextBtn.disabled = page === totalPages;
        
        // Números de página
        let numbersHtml = '';
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
            numbersHtml += `<li><a class="pagination-link ${i === page ? 'is-current' : ''}" onclick="cambiarPagina(${i})">${i}</a></li>`;
        }
        numbersList.innerHTML = numbersHtml;
        
        currentPage = page;
    };
    
    // Eventos
    btnBuscar.addEventListener('click', () => {
        const codigo = buscarInput.value.trim();
        const estado = filtroEstado.value;
        currentPage = 1;
        cargarRecibos(currentPage, codigo, estado);
    });
    
    btnLimpiar.addEventListener('click', () => {
        buscarInput.value = '';
        filtroEstado.value = '';
        currentPage = 1;
        cargarRecibos(currentPage);
    });
    
    // Buscar al presionar Enter
    buscarInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnBuscar.click();
        }
    });
    
    // Funciones globales para paginación
    window.cambiarPagina = (page) => {
        const codigo = buscarInput.value.trim();
        const estado = filtroEstado.value;
        cargarRecibos(page, codigo, estado);
    };
    
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            cambiarPagina(currentPage - 1);
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        cambiarPagina(currentPage + 1);
    });
    
    // Función global para ver detalle
    window.verDetalleRecibo = async (codigo) => {
        try {
            const res = await window.electronAPI.invoke('recibo:buscar', codigo);
            if (res.success && res.data) {
                mostrarModalDetalle(res.data);
            } else {
                showNotification('Recibo no encontrado', 'is-danger');
            }
        } catch (err) {
            showNotification('Error cargando detalle del recibo', 'is-danger');
        }
    };
    
    // Mostrar modal de detalle
    const mostrarModalDetalle = (recibo) => {
        document.getElementById('detalle-codigo').textContent = recibo.codigo;
        
        // Formatear fecha de manera segura
        let fechaFormateada = 'N/A';
        try {
            if (recibo.fecha) {
                const fecha = new Date(recibo.fecha);
                if (!isNaN(fecha.getTime())) {
                    fechaFormateada = fecha.toLocaleString('es-GT', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else {
                    fechaFormateada = recibo.fecha;
                }
            }
        } catch (e) {
            fechaFormateada = recibo.fecha || 'N/A';
        }
        
        document.getElementById('detalle-fecha').textContent = fechaFormateada;
        document.getElementById('detalle-dpi').textContent = recibo.dpi_solicitante || 'N/A';
        document.getElementById('detalle-total-exacto').textContent = `Q${recibo.total_exacto.toFixed(2)}`;
        document.getElementById('detalle-total-redondeado').textContent = `Q${recibo.total_redondeado.toFixed(2)}`;
        document.getElementById('detalle-estado').innerHTML = `<span class="tag ${recibo.anulado ? 'is-danger' : 'is-success'}">${recibo.anulado ? 'Anulado' : 'Activo'}</span>`;
        
        // Llenar tabla de medicamentos
        const medicamentosBody = document.getElementById('detalle-medicamentos');
        medicamentosBody.innerHTML = recibo.detalles.map(d => `
            <tr>
                <td>${d.descripcion}</td>
                <td>${d.lote}</td>
                <td>${d.cantidad}</td>
                <td>Q${d.precio_unitario.toFixed(2)}</td>
                <td>Q${d.total.toFixed(2)}</td>
            </tr>
        `).join('');
        
        // Mostrar/ocultar botón anular
        const btnAnular = document.getElementById('btn-anular-recibo');
        if (recibo.anulado) {
            btnAnular.style.display = 'none';
        } else {
            btnAnular.style.display = 'inline-flex';
            btnAnular.onclick = () => confirmarAnulacion(recibo.codigo);
        }
        
        // Botón ver PDF
        document.getElementById('btn-ver-pdf').onclick = () => {
            if (recibo.pdf_path) {
                require('electron').shell.openPath(recibo.pdf_path);
            } else {
                showNotification('Archivo PDF no encontrado', 'is-warning');
            }
        };
        
        document.getElementById('modal-detalle-recibo').classList.add('is-active');
    };
    
    // Confirmar anulación
    const confirmarAnulacion = (codigo) => {
        document.getElementById('codigo-anular').textContent = codigo;
        document.getElementById('modal-confirmar-anulacion').classList.add('is-active');
        
        document.getElementById('confirmar-anulacion').onclick = async () => {
            try {
                const res = await window.electronAPI.invoke('recibo:anular', codigo);
                if (res.success) {
                    showNotification(res.message, 'is-success');
                    document.getElementById('modal-confirmar-anulacion').classList.remove('is-active');
                    document.getElementById('modal-detalle-recibo').classList.remove('is-active');
                    cargarRecibos(currentPage, buscarInput.value.trim(), filtroEstado.value);
                } else {
                    showNotification(res.message, 'is-danger');
                }
            } catch (err) {
                showNotification('Error anulando recibo', 'is-danger');
            }
        };
    };
    
    // Cerrar modales
    document.getElementById('cerrar-modal-detalle').addEventListener('click', () => {
        document.getElementById('modal-detalle-recibo').classList.remove('is-active');
    });
    
    document.getElementById('cerrar-modal-detalle-2').addEventListener('click', () => {
        document.getElementById('modal-detalle-recibo').classList.remove('is-active');
    });
    
    document.getElementById('cerrar-modal-anulacion').addEventListener('click', () => {
        document.getElementById('modal-confirmar-anulacion').classList.remove('is-active');
    });
    
    document.getElementById('cancelar-anulacion').addEventListener('click', () => {
        document.getElementById('modal-confirmar-anulacion').classList.remove('is-active');
    });
    
    // Cargar recibos iniciales
    cargarRecibos();
}




async function cargarHistorial(page=1){
    const tipo = document.getElementById('filtro-tipo')?.value || '';
    try{
        const res = await window.electronAPI.invoke('historial:obtener',{page,limit:20,tipo:tipo||null});
        if(!res.success) throw new Error(res.message);
        const body=document.getElementById('historial-body');
        if(res.items.length===0){body.innerHTML='<tr><td colspan="8" class="has-text-centered">Sin datos</td></tr>';return;}
        body.innerHTML=res.items.map(m=>`<tr>
            <td>${m.fecha_hora_movimiento}</td>
            <td><span class="tag ${m.tipo_movimiento==='Entrada'?'is-success':'is-danger'} is-light">${m.tipo_movimiento}</span></td>
            <td>${m.medicamento}</td>
            <td>${m.numero_lote}</td>
            <td class="${m.tipo_movimiento==='Entrada'?'has-text-success':'has-text-danger'}">${m.tipo_movimiento==='Entrada'?'+' : '-'}${m.cantidad}</td>
            <td>${m.usuario_responsable||'-'}</td>
            <td>${m.dpi_solicitante && m.dpi_solicitante!=='no-ingresado' ? m.dpi_solicitante : 'No ingresado'}</td>
            <td>${m.motivo||'-'}</td>
        </tr>`).join('');

        // paginación
        const totalPages=Math.ceil(res.total/20);
        const pag=document.getElementById('historial-pagination');
        let html='';
        if(totalPages>1){
            html+=`<a class="pagination-previous" ${page===1?'disabled':''}>Anterior</a>`;
            html+=`<a class="pagination-next" ${page===totalPages?'disabled':''}>Siguiente</a>`;
            html+='<ul class="pagination-list">';
            for(let i=1;i<=totalPages;i++){
               if(i===page){html+=`<li><a class="pagination-link is-current">${i}</a></li>`;}
               else{html+=`<li><a class="pagination-link">${i}</a></li>`;}
            }
            html+='</ul>';
        }
        pag.innerHTML=html;

        pag.querySelector('.pagination-previous')?.addEventListener('click',()=>{if(page>1) cargarHistorial(page-1);});
        pag.querySelector('.pagination-next')?.addEventListener('click',()=>{if(page<totalPages) cargarHistorial(page+1);});
        pag.querySelectorAll('.pagination-link').forEach(link=>{
           const num=parseInt(link.textContent,10);
           if(num && num!==page) link.addEventListener('click',()=>cargarHistorial(num));
        });

    }catch(err){console.error(err);}
}

document.addEventListener('change', (e)=>{
    if(e.target && e.target.id==='filtro-tipo') cargarHistorial();
});

// ============================================================================
// VISTA DE IMPORTACIÓN
// ============================================================================
function initializeImportacionView(){
    const fileInput = document.getElementById('excel-file');
    const strategySelect = document.getElementById('duplicate-strategy');
    const btnPreview = document.getElementById('btn-preview');
    const btnImport = document.getElementById('btn-import');
    const progress = document.getElementById('import-progress');
    const previewBody = document.getElementById('preview-body');
    const previewSummary = document.getElementById('preview-summary');
    const logEl = document.getElementById('import-log');

    if(!fileInput) return; // vista aún no cargada

    let currentFile = null; // { name, dataBase64 }
    let unsubscribeProgress = null;

    const readFileAsBase64 = (file) => new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = () => {
            const arr = new Uint8Array(reader.result);
            let binary = '';
            for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
            const b64 = btoa(binary);
            resolve(b64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });

    const renderPreview = (rows)=>{
        if(!rows || rows.length===0){
            previewBody.innerHTML = '<tr><td colspan="10" class="has-text-centered">Sin datos</td></tr>';
            return;
        }
        previewBody.innerHTML = rows.map(r=>{
            const statusTagClass = r.status==='nuevo' ? 'is-success'
                : r.status==='existente' ? 'is-info'
                : r.status==='duplicado' ? 'is-warning'
                : 'is-danger';
            const err = r.errors && r.errors.length ? r.errors.join(', ') : '';
            const precio = (r.precioUnit===null || isNaN(r.precioUnit)) ? '' : r.precioUnit;
            const importe = (r.importe===null || isNaN(r.importe)) ? '' : r.importe;
            return `<tr>
                <td>${r.rowIndex}</td>
                <td>${r.codigo}</td>
                <td>${r.descripcion}</td>
                <td>${r.cantidad}</td>
                <td>${precio}</td>
                <td>${importe}</td>
                <td>${r.lote}</td>
                <td>${r.fechaVenc||''}</td>
                <td><span class="tag ${statusTagClass}">${r.status}</span></td>
                <td class="has-text-danger">${err}</td>
            </tr>`;
        }).join('');
    };

    const renderSummary = (summary)=>{
        if(!summary){ previewSummary.innerHTML=''; return; }
        const { totalRows, validRows, invalidRows, duplicates, newMedicamentos, existingMedicamentos, totalImporte } = summary;
        const totalImporteTxt = typeof totalImporte==='number' && !isNaN(totalImporte) ? `Q${totalImporte.toFixed(2)}` : 'N/D';
        previewSummary.innerHTML = `
            <ul>
              <li><strong>Total filas:</strong> ${totalRows}</li>
              <li><strong>Válidas:</strong> ${validRows}</li>
              <li><strong>Inválidas:</strong> ${invalidRows}</li>
              <li><strong>Duplicados detectados:</strong> ${duplicates}</li>
              <li><strong>Medicamentos nuevos:</strong> ${newMedicamentos}</li>
              <li><strong>Medicamentos existentes:</strong> ${existingMedicamentos}</li>
              <li><strong>Total importe estimado:</strong> ${totalImporteTxt}</li>
            </ul>`;
    };

    fileInput.addEventListener('change', ()=>{
        btnImport.setAttribute('disabled','disabled');
        previewBody.innerHTML = '<tr><td colspan="10" class="has-text-centered">Sin datos</td></tr>';
        previewSummary.innerHTML = '';
        logEl.textContent = '';
        progress.value = 0; progress.textContent = '0%';
        currentFile = null;
    });

    btnPreview.addEventListener('click', async ()=>{
        const f = fileInput.files && fileInput.files[0];
        if(!f){ showNotification('Seleccione un archivo .xlsx','is-warning'); return; }
        try{
            btnPreview.classList.add('is-loading');
            const b64 = await readFileAsBase64(f);
            currentFile = { name: f.name, dataBase64: b64 };
            const duplicateStrategy = strategySelect.value;
            const res = await window.electronAPI.invoke('importacion:previsualizar', { file: currentFile, options: { duplicateStrategy } });
            if(!res.success) throw new Error(res.message || 'Error en previsualización');
            renderSummary(res.summary);
            renderPreview(res.rows);
            btnImport.removeAttribute('disabled');
            showNotification('Previsualización completa','is-success');
        }catch(err){
            showNotification(err.message||'Error al previsualizar','is-danger');
        }finally{
            btnPreview.classList.remove('is-loading');
        }
    });

    btnImport.addEventListener('click', async ()=>{
        if(!currentFile){ showNotification('Realice la previsualización primero','is-warning'); return; }
        btnImport.classList.add('is-loading');
        btnPreview.setAttribute('disabled','disabled');
        fileInput.setAttribute('disabled','disabled');
        strategySelect.setAttribute('disabled','disabled');
        logEl.textContent = '';
        progress.value = 0; progress.textContent = '0%';

        // Suscribir a progreso
        unsubscribeProgress = window.electronAPI.on('importacion:progress', (prog)=>{
            if(!prog) return;
            progress.value = prog.percent||0;
            progress.textContent = `${prog.percent||0}%`;
        });

        try{
            const duplicateStrategy = strategySelect.value;
            const res = await window.electronAPI.invoke('importacion:importar', { file: currentFile, options: { duplicateStrategy, recordMovements: true } });
            if(!res.success) throw new Error(res.message||'Error al importar');
            const r = res.resumen || {};
            const erroresTxt = (r.errors||[]).map(e=>`Fila ${e.rowIndex}: ${e.message}`).join('\n');
            logEl.textContent = `
Importación completada\n
Insertados (lotes): ${r.insertedLotes||0}\n
Actualizados (lotes): ${r.updatedLotes||0}\n
Omitidos (duplicados): ${r.skippedDuplicates||0}\n
Medicamentos nuevos: ${r.newMedicamentos||0}\n
Medicamentos existentes: ${r.existingMedicamentos||0}\n
Errores: ${r.errors ? r.errors.length : 0}\n${erroresTxt}`.trim();
            progress.value = 100; progress.textContent = '100%';
            showNotification('Importación exitosa','is-success');
        }catch(err){
            showNotification(err.message||'Error durante importación','is-danger');
        }finally{
            btnImport.classList.remove('is-loading');
            btnPreview.removeAttribute('disabled');
            fileInput.removeAttribute('disabled');
            strategySelect.removeAttribute('disabled');
            if(typeof unsubscribeProgress==='function'){ unsubscribeProgress(); unsubscribeProgress = null; }
        }
    });
}
