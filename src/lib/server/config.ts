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
  // Usar variable de entorno UPLOAD_DIR si existe (para Docker), sino fallback a directorio local
  UPLOAD_DIR: process.env.UPLOAD_DIR || join(ROOT_DIR, 'uploads'),

  // Tamaño máximo de archivo (10MB por defecto)
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE
    ? parseInt(process.env.MAX_FILE_SIZE, 10)
    : 10 * 1024 * 1024, // 10MB
};

// Asegurarse de que el directorio de subidas exista
if (!existsSync(CONFIG.UPLOAD_DIR)) {
  mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true, mode: 0o755 });
}
