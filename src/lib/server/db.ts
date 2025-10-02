import { PrismaClient } from '@prisma/client';

// Tipos para los logs de Prisma
type LogLevel = 'info' | 'query' | 'warn' | 'error';
type LogDefinition = {
  level: LogLevel;
  emit: 'stdout' | 'event';
};

// Habilitar logs de consultas solo si se especifica explícitamente
const ENABLE_QUERY_LOG = false;

// Configuración de logs detallada
const logOptions: LogDefinition[] = process.env.NODE_ENV === 'development' 
  ? [
      ...(ENABLE_QUERY_LOG ? [{ level: 'query', emit: 'event' } as LogDefinition] : []),
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
      { level: 'info', emit: 'stdout' }
    ]
  : [{ level: 'error', emit: 'stdout' }];

// Crear una instancia de Prisma con logging mejorado
const prismaClient = new PrismaClient({
  // log: logOptions
});

// Tipos para los eventos de Prisma
interface QueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface LogEvent {
  timestamp: Date;
  message: string;
  target: string;
}

// Agregar listeners de eventos para mejor depuración
// if (process.env.NODE_ENV === 'development') {
//   if (ENABLE_QUERY_LOG) {
//     prismaClient.$on('query' as never, (e: QueryEvent) => {
//       console.log('Query: ' + e.query);
//       console.log('Params: ' + e.params);
//       console.log('Duration: ' + e.duration + 'ms');
//     });
//   }

//   prismaClient.$on('error' as never, (e: LogEvent) => {
//     console.error('Prisma Error:', e.message);
//   });

//   prismaClient.$on('warn' as never, (e: LogEvent) => {
//     console.warn('Prisma Warning:', e.message);
//   });
// }

// Patrón singleton para Prisma Client
const globalForPrisma = globalThis as unknown as { prisma?: typeof prismaClient };

export const prisma = globalForPrisma.prisma || prismaClient;

// En desarrollo, guarda la instancia en global para recarga en caliente
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Función para verificar la conexión a la base de datos
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexión a la base de datos exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error);
    return false;
  }
}

// Verificar la conexión al inicio
if (process.env.NODE_ENV !== 'test') {
  checkDatabaseConnection().catch(console.error);
}
