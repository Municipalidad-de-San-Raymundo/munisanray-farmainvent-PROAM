// src/backend/ipcHandlers/medicamentoHandlers.js
const medicamentoService = require('../services/medicamentoService');

/**
 * Registra los manejadores IPC para las operaciones de medicamentos.
 * @param {object} ipcMain - Instancia de ipcMain de Electron.
 * @param {object} db - Instancia de la base de datos SQLite.
 */
function registerHandlers(ipcMain, db) {
    // Manejador para agregar un nuevo medicamento
    ipcMain.handle('medicamentos:agregar', async (event, datosMedicamento) => {
        console.log('IPC: Solicitud para agregar medicamento recibida:', datosMedicamento);
        
        if (!datosMedicamento || typeof datosMedicamento !== 'object') {
            return { success: false, message: 'Datos de medicamento inválidos o no proporcionados.' };
        }
        
        // Validaciones básicas de campos requeridos (ejemplo)
        if (!datosMedicamento.codigo_medicamento || datosMedicamento.codigo_medicamento.trim() === '') {
            return { success: false, message: 'El código del medicamento es requerido.' };
        }
        if (!datosMedicamento.descripcion || datosMedicamento.descripcion.trim() === '') {
            return { success: false, message: 'La descripción del medicamento es requerida.' };
        }
        if (datosMedicamento.stock_minimo === undefined || datosMedicamento.stock_minimo === null || String(datosMedicamento.stock_minimo).trim() === '') {
            return { success: false, message: 'El stock mínimo es requerido.' };
        }
        const stockMinimoNum = Number(datosMedicamento.stock_minimo);
        if (isNaN(stockMinimoNum) || stockMinimoNum < 0) {
            return { success: false, message: 'El stock mínimo debe ser un número no negativo.' };
        }

        try {
            // Asegurar que stock_minimo se pasa como número al servicio
            const datosParaServicio = { ...datosMedicamento, stock_minimo: stockMinimoNum };
            const nuevoMedicamento = await medicamentoService.agregarMedicamento(db, datosParaServicio);
            return { success: true, data: nuevoMedicamento, message: 'Medicamento agregado exitosamente.' };
        } catch (error) {
            console.error('Error en IPC manejador medicamentos:agregar:', error);
            return { success: false, message: error.message || 'Ocurrió un error al agregar el medicamento.' };
        }
    });

    // Aquí se podrían registrar más manejadores para medicamentos:
    // ipcMain.handle('medicamentos:obtenerTodos', async () => { /* ... */ });
    // ipcMain.handle('medicamentos:obtenerPorId', async (event, id) => { /* ... */ });
    // ipcMain.handle('medicamentos:actualizar', async (event, id, datos) => { /* ... */ });
    // ipcMain.handle('medicamentos:eliminar', async (event, id) => { /* ... */ });

    // Manejador para obtener todos los medicamentos
    ipcMain.handle('medicamentos:obtenerTodos', async () => {
        console.log('IPC: Solicitud para obtener todos los medicamentos recibida.');
        try {
            const medicamentos = await medicamentoService.obtenerTodosMedicamentos(db);
            return { success: true, data: medicamentos };
        } catch (error) {
            console.error('Error en IPC manejador medicamentos:obtenerTodos:', error);
            return { success: false, message: error.message || 'Ocurrió un error al obtener los medicamentos.' };
        }
    });

    // Manejador para obtener medicamentos paginados
    ipcMain.handle('medicamentos:listarPaginado', async (event, {limit = 20, page = 1} = {}) => {
        try {
            const offset = (page - 1) * limit;
            const res = await medicamentoService.obtenerMedicamentosPaginados(db, limit, offset);
            return { success: true, ...res };
        } catch (err) {
            console.error(err);
            return { success: false, message: err.message };
        }
    });

    // Buscar con paginación
    ipcMain.handle('medicamentos:buscarPaginado', async (event, {termino='', limit=20, page=1} = {}) => {
        try{
            const offset=(page-1)*limit;
            const res = await medicamentoService.buscarMedicamentosPaginados(db, termino, limit, offset);
            return { success:true, ...res };
        }catch(err){
            console.error(err);
            return { success:false, message: err.message };
        }
    });

    // Obtener medicamento por id
    ipcMain.handle('medicamentos:obtener', async (event, id) => {
        try{
            const med = await medicamentoService.obtenerMedicamentoPorId(db,id);
            return {success:true, data: med};
        }catch(err){
            return {success:false, message: err.message};
        }
    });

    // Actualizar medicamento
    ipcMain.handle('medicamentos:actualizar', async (event, {id, datos})=>{
        try{
            await medicamentoService.actualizarMedicamento(db, id, datos);
            return {success:true};
        }catch(err){
            return {success:false, message: err.message};
        }
    });

    // Soft delete
    ipcMain.handle('medicamentos:eliminar', async (event, id) => {
        if(!id) return {success:false, message:'ID inválido'};
        try{
            await medicamentoService.eliminarMedicamento(db, id);
            return {success:true, message:'Medicamento eliminado'};
        }catch(err){
            return {success:false, message: err.message};
        }
    });

    console.log('Manejadores IPC para Medicamentos registrados.');
}

module.exports = {
    registerHandlers
};
