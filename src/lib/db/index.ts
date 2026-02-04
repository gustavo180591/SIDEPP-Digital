import { PrismaClient } from '@prisma/client';

// Crear una instancia de Prisma sin logging
const prismaClient = new PrismaClient();

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
    return true;
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    return false;
  }
}

// Verificar la conexión al inicio
if (process.env.NODE_ENV !== 'test') {
  checkDatabaseConnection().catch(console.error);
}
