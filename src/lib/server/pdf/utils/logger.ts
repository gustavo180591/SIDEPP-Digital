import pino from 'pino';

// Configuración del logger
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
  [key: string]: any;
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
    process.exit(1);
  },
};

// Logger predeterminado para compatibilidad con código existente
export const logger = {
  info: (message: string, ...args: any[]) => {
    const context = args.reduce((acc, arg) => ({
      ...acc,
      ...(typeof arg === 'object' ? arg : { data: arg })
    }), {});
    pdfLogger.info(message, context);
  },
  
  error: (message: string, ...args: any[]) => {
    const error = args.find(arg => arg instanceof Error);
    const context = args
      .filter(arg => !(arg instanceof Error) && typeof arg === 'object')
      .reduce((acc, arg) => ({ ...acc, ...arg }), {});
    
    pdfLogger.error(message, error, context);
  },
  
  warn: (message: string, ...args: any[]) => {
    const context = args.reduce((acc, arg) => ({
      ...acc,
      ...(typeof arg === 'object' ? arg : { data: arg })
    }), {});
    pdfLogger.warn(message, context);
  },
  
  debug: (message: string, ...args: any[]) => {
    const context = args.reduce((acc, arg) => ({
      ...acc,
      ...(typeof arg === 'object' ? arg : { data: arg })
    }), {});
    pdfLogger.debug(message, context);
  }
};

export default logger;
