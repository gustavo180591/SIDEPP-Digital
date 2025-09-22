import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

// Obtener el directorio raíz del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(dirname(dirname(dirname(__filename))));

// Definir rutas
const ROOT_DIR = __dirname;

// Configuración de la aplicación
export const CONFIG = {
  // Forzar la ruta del directorio de subidas a una ubicación dentro del proyecto
  UPLOAD_DIR: join(ROOT_DIR, 'uploads'),
  
  // Tamaño máximo de archivo (10MB por defecto)
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE 
    ? parseInt(process.env.MAX_FILE_SIZE, 10) 
    : 10 * 1024 * 1024, // 10MB
};

// Asegurarse de que el directorio de subidas exista
if (!existsSync(CONFIG.UPLOAD_DIR)) {
  mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true, mode: 0o755 });
  console.log(`✅ Directorio de subidas creado en: ${CONFIG.UPLOAD_DIR}`);
} else {
  console.log(`ℹ️ Usando directorio de subidas existente: ${CONFIG.UPLOAD_DIR}`);
}

// Mostrar configuración cargada
console.log('📂 Configuración de la aplicación:', {
  rootDir: ROOT_DIR,
  uploadDir: CONFIG.UPLOAD_DIR,
  maxFileSize: CONFIG.MAX_FILE_SIZE / (1024 * 1024) + 'MB'
});
