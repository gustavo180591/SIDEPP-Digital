/**
 * Intenta ejecutar una operación con reintentos y retroceso exponencial
 * @param operation - Función asíncrona a ejecutar
 * @param options - Opciones de reintento
 * @returns El resultado de la operación exitosa
 * @throws El último error después de agotar los reintentos
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    factor = 2,
    shouldRetry = () => true
  } = options;

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Verificar si debemos reintentar
      if (attempt === maxRetries || !shouldRetry(error)) {
        break;
      }

      // Calcular el siguiente retraso con retroceso exponencial
      const delayMs = Math.min(
        initialDelayMs * Math.pow(factor, attempt),
        maxDelayMs
      );

      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      attempt++;
      console.log(`Reintentando operación (intento ${attempt}/${maxRetries})...`);
    }
  }

  // Si llegamos aquí, todos los reintentos fallaron
  throw lastError instanceof Error 
    ? lastError 
    : new Error(`Operación fallida después de ${maxRetries} reintentos: ${String(lastError)}`);
}

/**
 * Verifica si un error es recuperable (se puede reintentar)
 */
export function isRetryableError(error: unknown): boolean {
  // Errores de red, timeouts y códigos de estado 5xx son recuperables
  const errorMessage = String(error).toLowerCase();
  const retryableMessages = [
    'timeout',
    'network',
    'econnreset',
    'econnrefused',
    'eaddrinuse',
    'eaddrinuse',
    'econnaborted',
    'eai_again',
    'eagain',
    'eintr',
    'ehostunreach',
    'enotfound',
    'etimedout',
    'eio',
    'esockettimedout',
    'econnreset',
    'econnrefused',
    'econnaborted',
    'ehostunreach',
    'enotfound',
    'etimedout',
    'eio',
    'esockettimedout',
    'econnreset',
    'econnrefused',
    'econnaborted',
    'ehostunreach',
    'enotfound',
    'etimedout',
    'eio',
    'esockettimedout'
  ];

  return retryableMessages.some(msg => errorMessage.includes(msg));
}
