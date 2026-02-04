/**
 * Logger centralizado de errores
 * Guarda errores en archivo /data/logs/errors.log
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// Directorio para logs (configurable via env)
const LOGS_DIR = process.env.LOGS_DIR || '/data/logs';
const ERROR_LOG_FILE = join(LOGS_DIR, 'errors.log');

// Crear directorio de logs si no existe
function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    try {
      mkdirSync(LOGS_DIR, { recursive: true, mode: 0o755 });
      console.log(`📁 Directorio de logs creado: ${LOGS_DIR}`);
    } catch (e) {
      // Silenciar - puede no tener permisos en desarrollo
    }
  }
}

// Inicializar al cargar el módulo
ensureLogsDir();

/**
 * Escribe un error al archivo de logs
 */
export function logError(
  source: string,
  message: string,
  error?: unknown,
  extra?: Record<string, unknown>
): void {
  // Siempre mostrar en consola
  console.error(`[${source}] ${message}`, error || '');

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

    appendFileSync(ERROR_LOG_FILE, logEntry);
  } catch {
    // Silenciar errores de escritura
  }
}

/**
 * Wrapper para capturar errores de async functions
 */
export function withErrorLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  source: string,
  fn: T
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(source, 'Error no manejado', error);
      throw error;
    }
  }) as T;
}

export default { logError, withErrorLogging };
