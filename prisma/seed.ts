// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SIDEPP...');

  const defaultPassword = '123456';
  const hashed = await hash(defaultPassword, 10);

  // Crear usuario ADMIN
  console.log('👤 Creando usuarios...');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sidepp.com' },
    update: {
      name: 'Administrador',
      password: hashed,
      isActive: true,
      role: 'ADMIN'
    },
    create: {
      email: 'admin@sidepp.com',
      name: 'Administrador',
      password: hashed,
      isActive: true,
      role: 'ADMIN'
    }
  });
  console.log('  ✓ Admin:', adminUser.email);

  // Crear usuario FINANZAS
  const finanzasUser = await prisma.user.upsert({
    where: { email: 'finanzas@sidepp.com' },
    update: {
      name: 'Usuario Finanzas',
      password: hashed,
      isActive: true,
      role: 'FINANZAS'
    },
    create: {
      email: 'finanzas@sidepp.com',
      name: 'Usuario Finanzas',
      password: hashed,
      isActive: true,
      role: 'FINANZAS'
    }
  });
  console.log('  ✓ Finanzas:', finanzasUser.email);

  // Crear usuarios LIQUIDADOR
  const liquidador1 = await prisma.user.upsert({
    where: { email: 'liquidador1@sidepp.com' },
    update: {
      name: 'Liquidador Clorinda',
      password: hashed,
      isActive: true,
      role: 'LIQUIDADOR'
    },
    create: {
      email: 'liquidador1@sidepp.com',
      name: 'Liquidador Clorinda',
      password: hashed,
      isActive: true,
      role: 'LIQUIDADOR'
    }
  });
  console.log('  ✓ Liquidador 1:', liquidador1.email);

  const liquidador2 = await prisma.user.upsert({
    where: { email: 'liquidador2@sidepp.com' },
    update: {
      name: 'Liquidador Hospital',
      password: hashed,
      isActive: true,
      role: 'LIQUIDADOR'
    },
    create: {
      email: 'liquidador2@sidepp.com',
      name: 'Liquidador Hospital',
      password: hashed,
      isActive: true,
      role: 'LIQUIDADOR'
    }
  });
  console.log('  ✓ Liquidador 2:', liquidador2.email);

  const liquidador3 = await prisma.user.upsert({
    where: { email: 'liquidador3@sidepp.com' },
    update: {
      name: 'Liquidador Multi-Institución',
      password: hashed,
      isActive: true,
      role: 'LIQUIDADOR'
    },
    create: {
      email: 'liquidador3@sidepp.com',
      name: 'Liquidador Multi-Institución',
      password: hashed,
      isActive: true,
      role: 'LIQUIDADOR'
    }
  });
  console.log('  ✓ Liquidador 3:', liquidador3.email);


  console.log('\n✅ Seed completado exitosamente!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
