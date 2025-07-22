const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

// Determina la ruta para el archivo de la base de datos. Usa app.getPath('userData') 
// para asegurar que los datos persistan entre instalaciones de la app.
const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '..', '..', 'data_dev');
const dbPath = path.join(userDataPath, 'inventario.sqlite');

// Si estamos en desarrollo y la carpeta no existe, la creamos.
if (!app) {
    const fs = require('fs');
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }
}

// Crea una nueva instancia de la base de datos.
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos SQLite', err.message);
    } else {
        console.log(`Conectado a la base de datos SQLite en: ${dbPath}`);
        // Habilita la coerción de claves foráneas, crucial para la integridad de los datos.
        db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
            if (pragmaErr) {
                console.error("Error al habilitar las claves foráneas:", pragmaErr.message);
            } else {
                console.log("La coerción de claves foráneas está activada.");
                initializeDb();
            }
        });
    }
});

// Función para crear las tablas si no existen.
function initializeDb() {
    db.serialize(() => {
        console.log('Inicializando la estructura de la base de datos...');

        // Tabla de Medicamentos
        db.run(`
            CREATE TABLE IF NOT EXISTS Medicamentos (
                id_medicamento INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo_medicamento TEXT NOT NULL UNIQUE,
                descripcion TEXT NOT NULL,
                principio_activo TEXT,
                forma_farmaceutica TEXT,
                concentracion TEXT,
                unidad_medida TEXT,
                stock_minimo INTEGER NOT NULL DEFAULT 0,
                activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
            );
        `);

        // Asegurar columnas adicionales existen en bases antiguas
        const addCol = (name, type, def='NULL') => {
            db.run(`ALTER TABLE Medicamentos ADD COLUMN ${name} ${type} DEFAULT ${def};`, () => {});
        };
        addCol('principio_activo','TEXT','\'N/A\'');
        addCol('forma_farmaceutica','TEXT');
        addCol('concentracion','TEXT');
        addCol('unidad_medida','TEXT');
        addCol('activo','INTEGER','1');

        // Tabla de Lotes
        db.run(`
            CREATE TABLE IF NOT EXISTS Lotes (
                id_lote INTEGER PRIMARY KEY AUTOINCREMENT,
                id_medicamento INTEGER NOT NULL,
                numero_lote TEXT NOT NULL,
                fecha_vencimiento TEXT NOT NULL,
                cantidad_actual INTEGER NOT NULL,
                precio_unitario_compra REAL,
                importe_total REAL,
                fecha_ingreso_lote TEXT NOT NULL,
                FOREIGN KEY (id_medicamento) REFERENCES Medicamentos (id_medicamento) ON DELETE CASCADE
            );
        `);

        // Asegurar columna importe_total existe en bases ya creadas
        db.run(`ALTER TABLE Lotes ADD COLUMN importe_total REAL;`, ()=>{});

        // Asegurar columna dpi_solicitante existe
        db.run(`ALTER TABLE Movimientos ADD COLUMN dpi_solicitante TEXT;`, ()=>{});

        // Tabla de Movimientos
        db.run(`
            CREATE TABLE IF NOT EXISTS Movimientos (
                id_movimiento INTEGER PRIMARY KEY AUTOINCREMENT,
                id_lote INTEGER NOT NULL,
                tipo_movimiento TEXT NOT NULL CHECK(tipo_movimiento IN ('Entrada', 'Salida')),
                cantidad INTEGER NOT NULL,
                fecha_hora_movimiento TEXT NOT NULL,
                usuario_responsable TEXT,
                motivo TEXT,
                dpi_solicitante TEXT,
                referencia_externa TEXT,
                FOREIGN KEY (id_lote) REFERENCES Lotes (id_lote) ON DELETE RESTRICT
            );
        `);

        // Tabla de Recibos
        db.run(`
            CREATE TABLE IF NOT EXISTS Recibos (
                id_recibo INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT NOT NULL UNIQUE,
                fecha TEXT NOT NULL,
                dpi_solicitante TEXT,
                total_exacto REAL NOT NULL,
                total_redondeado REAL NOT NULL,
                detalles TEXT NOT NULL, -- JSON con array de medicamentos
                pdf_path TEXT,
                anulado INTEGER NOT NULL DEFAULT 0 CHECK(anulado IN (0,1)),
                fecha_creacion TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
        `);

        // Tabla de Usuarios
        db.run(`
            CREATE TABLE IF NOT EXISTS Usuarios (
                id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre_usuario TEXT NOT NULL UNIQUE,
                contrasena_hash TEXT NOT NULL,
                rol TEXT NOT NULL CHECK(rol IN ('Administrador', 'Almacenista', 'Enfermera')),
                nombre_completo TEXT,
                activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1))
            );
        `, (err) => {
            if (err) {
                console.error("Error al crear las tablas:", err.message);
            } else {
                console.log("Las tablas de la base de datos han sido verificadas/creadas correctamente.");
            }
        });
    });
}

// Exporta la instancia de la base de datos para ser usada en otros módulos.
module.exports = db;
