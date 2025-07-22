const loteService = require('../services/loteService');

/**
 * Registra los manejadores de IPC para las operaciones de Lotes.
 * @param {object} ipcMain - Instancia de ipcMain de Electron.
 * @param {object} db - Instancia de la base de datos SQLite.
 */
function registerHandlers(ipcMain, db) {
    // Manejador para registrar una nueva entrada de lote
    ipcMain.handle('lotes:registrarEntrada', async (event, datos) => {
        console.log('IPC: Solicitud para registrar entrada de lote recibida:', datos);
        try {
            // Validaciones básicas de los datos recibidos
            if (!datos || !datos.id_medicamento || !datos.numero_lote || !datos.cantidad_entrada || !datos.fecha_vencimiento) {
                throw new Error('Faltan datos obligatorios para registrar la entrada.');
            }
            if (parseInt(datos.cantidad_entrada, 10) <= 0) {
                throw new Error('La cantidad debe ser un número positivo.');
            }

            const resultado = await loteService.registrarEntradaLote(db, datos);
            return resultado; // { success: true, message: '...' }
        } catch (error) {
            console.error('Error en IPC manejador lotes:registrarEntrada:', error);
            return { success: false, message: error.message || 'Ocurrió un error al registrar la entrada del lote.' };
        }
    });

        // Obtener un lote por ID
    ipcMain.handle('lotes:obtener', async (e,id)=>{
        try{const lote=await loteService.obtenerLotePorId(db,id);return {success:true,data:lote};}
        catch(err){return {success:false,message:err.message};}
    });

    // Manejador para obtener lotes de un medicamento
    ipcMain.handle('lotes:porMedicamento', async (event, idMedicamento) => {
        try {
            const lotes = await loteService.obtenerLotesPorMedicamento(db, idMedicamento);
            return { success: true, data: lotes };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });

        // Actualizar lote
    ipcMain.handle('lotes:actualizar', async (e,{id, datos})=>{
        try{
            const res=await loteService.actualizarLote(db,id,datos);
            return {success:true, message:'Lote actualizado'};
        }catch(err){return {success:false,message:err.message};}
    });

    // Soft delete lote
    ipcMain.handle('lotes:eliminar', async (e,id)=>{
        try{
            await loteService.softDeleteLote(db,id);
            return {success:true,message:'Lote eliminado'};
        }catch(err){return {success:false,message:err.message};}
    });

    console.log('Manejadores IPC para Lotes registrados.');
}

module.exports = {
    registerHandlers
};
