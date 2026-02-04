import pino from 'pino';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// Directorio para logs (configurable via env)
const LOGS_DIR = process.env.LOGS_DIR || '/data/logs';

// Crear directorio de logs si no existe
if (!existsSync(LOGS_DIR)) {
  try {
    mkdirSync(LOGS_DIR, { recursive: true, mode: 0o755 });
  } catch (e) {
    console.error('No se pudo crear directorio de logs:', e);
  }
}

// Archivo de errores
const ERROR_LOG_FILE = join(LOGS_DIR, 'errors.log');

// Función para escribir errores a archivo
function writeErrorToFile(message: string, context: Record<string, unknown> = {}) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({
      timestamp,
      level: 'error',
      message,
      ...context
    }) + '\n';
    appendFileSync(ERROR_LOG_FILE, logEntry);
  } catch (e) {
    // Silenciar errores de escritura para no romper la app
  }
}

// Configuración del logger para consola
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
});

// Tipos de log
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Interfaz para el contexto de los logs
interface LogContext {
  [key: string]: unknown;
}

// Función para formatear el mensaje de error
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack || ''}`;
  }
  return String(error);
}

// Logger con métodos tipados
export const pdfLogger = {
  log: (level: LogLevel, message: string, context: LogContext = {}) => {
    logger[level]({ ...context }, message);
  },

  info: (message: string, context: LogContext = {}) => {
    logger.info(context, message);
  },

  error: (message: string, error?: unknown, context: LogContext = {}) => {
    if (error) {
      context.error = formatError(error);
    }
    logger.error(context, message);
    // Guardar en archivo
    writeErrorToFile(message, context);
  },

  warn: (message: string, context: LogContext = {}) => {
    logger.warn(context, message);
  },

  debug: (message: string, context: LogContext = {}) => {
    logger.debug(context, message);
  },

  trace: (message: string, context: LogContext = {}) => {
    logger.trace(context, message);
  },

  fatal: (message: string, error?: unknown, context: LogContext = {}) => {
    if (error) {
      context.error = formatError(error);
    }
    logger.fatal(context, message);
    // Guardar en archivo
    writeErrorToFile(message, { ...context, level: 'fatal' });
    process.exit(1);
  },
};

// Logger predeterminado para compatibilidad con código existente
export const appLogger = {
  info: (message: string, ...args: unknown[]) => {
    const context = args.reduce((acc: Record<string, unknown>, arg) => ({
      ...acc,
      ...(typeof arg === 'object' && arg !== null ? arg : { data: arg })
    }), {});
    pdfLogger.info(message, context);
  },

  error: (message: string, ...args: unknown[]) => {
    const error = args.find(arg => arg instanceof Error);
    const context = args
      .filter(arg => !(arg instanceof Error) && typeof arg === 'object' && arg !== null)
      .reduce((acc: Record<string, unknown>, arg) => ({ ...acc, ...(arg as Record<string, unknown>) }), {});

    pdfLogger.error(message, error, context);
  },

  warn: (message: string, ...args: unknown[]) => {
    const context = args.reduce((acc: Record<string, unknown>, arg) => ({
      ...acc,
      ...(typeof arg === 'object' && arg !== null ? arg : { data: arg })
    }), {});
    pdfLogger.warn(message, context);
  },

  debug: (message: string, ...args: unknown[]) => {
    const context = args.reduce((acc: Record<string, unknown>, arg) => ({
      ...acc,
      ...(typeof arg === 'object' && arg !== null ? arg : { data: arg })
    }), {});
    pdfLogger.debug(message, context);
  }
};

// Exportar como default para compatibilidad
export { appLogger as logger };
export default appLogger;
