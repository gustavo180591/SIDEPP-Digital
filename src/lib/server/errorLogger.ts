/**
 * Logger centralizado de errores
 * Guarda errores en archivo /data/logs/errors-YYYY-MM-DD.log (por día)
 * Solo guarda errores, no logs informativos
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// Directorio para logs (configurable via env)
const LOGS_DIR = process.env.LOGS_DIR || '/data/logs';

// Crear directorio de logs si no existe
function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    try {
      mkdirSync(LOGS_DIR, { recursive: true, mode: 0o755 });
    } catch {
      // Silenciar - puede no tener permisos en desarrollo
    }
  }
}

// Inicializar al cargar el módulo
ensureLogsDir();

/**
 * Obtiene el nombre del archivo de log del día actual
 */
function getDailyLogFile(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(LOGS_DIR, `errors-${today}.log`);
}

/**
 * Escribe un error al archivo de logs diario
 */
export function logError(
  source: string,
  message: string,
  error?: unknown,
  extra?: Record<string, unknown>
): void {
  // Intentar guardar en archivo
  try {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error !== undefined
        ? { value: String(error) }
        : {};

    const logEntry = JSON.stringify({
      timestamp,
      source,
      message,
      error: errorDetails,
      ...extra
    }) + '\n';

    appendFileSync(getDailyLogFile(), logEntry);
  } catch {
    // Silenciar errores de escritura
  }
}

/**
 * Reemplazo de console.error que también guarda en archivo
 */
export function logErrorToFile(source: string, message: string, ...args: unknown[]): void {
  const error = args.find(arg => arg instanceof Error);
  const extra = args
    .filter(arg => !(arg instanceof Error) && typeof arg === 'object' && arg !== null)
    .reduce((acc: Record<string, unknown>, arg) => ({ ...acc, ...(arg as Record<string, unknown>) }), {});

  logError(source, message, error, extra);
}

export default { logError, logErrorToFile };
