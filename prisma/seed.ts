// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SIDEPP...');

  const defaultPassword = '123456';
  const hashed = await hash(defaultPassword, 10);

  // Crear institución EFA San Bonifacio
  console.log('🏢 Creando institución...');

  const institution = await prisma.institution.upsert({
    where: { id: 'inst-efa-san-bonifacio' },
    update: {
      name: 'EFA San Bonifacio',
      cuit: '30-64012797-6',
      address: 'Ruta Nac. 14 Km 1200'
    },
    create: {
      id: 'inst-efa-san-bonifacio',
      name: 'EFA San Bonifacio',
      cuit: '30-64012797-6',
      address: 'Ruta Nac. 14 Km 1200'
    }
  });

  console.log('✅ Institución creada:', institution.name);

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

  // Crear relaciones Usuario-Institución para Liquidadores
  console.log('🔗 Asignando instituciones a liquidadores...');

  // Todos los liquidadores asignados a EFA San Bonifacio
  await prisma.userInstitution.upsert({
    where: {
      userId_institutionId: {
        userId: liquidador1.id,
        institutionId: institution.id
      }
    },
    update: {},
    create: {
      userId: liquidador1.id,
      institutionId: institution.id
    }
  });
  console.log('  ✓ Liquidador 1 → EFA San Bonifacio');

  await prisma.userInstitution.upsert({
    where: {
      userId_institutionId: {
        userId: liquidador2.id,
        institutionId: institution.id
      }
    },
    update: {},
    create: {
      userId: liquidador2.id,
      institutionId: institution.id
    }
  });
  console.log('  ✓ Liquidador 2 → EFA San Bonifacio');

  await prisma.userInstitution.upsert({
    where: {
      userId_institutionId: {
        userId: liquidador3.id,
        institutionId: institution.id
      }
    },
    update: {},
    create: {
      userId: liquidador3.id,
      institutionId: institution.id
    }
  });
  console.log('  ✓ Liquidador 3 → EFA San Bonifacio');

  console.log('\n✅ Seed completado exitosamente!\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('USUARIOS CREADOS (contraseña: 123456)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ADMIN:');
  console.log('  • admin@sidepp.com        → Acceso total');
  console.log('');
  console.log('FINANZAS:');
  console.log('  • finanzas@sidepp.com     → Ve instituciones y afiliados');
  console.log('');
  console.log('LIQUIDADOR:');
  console.log('  • liquidador1@sidepp.com  → EFA San Bonifacio');
  console.log('  • liquidador2@sidepp.com  → EFA San Bonifacio');
  console.log('  • liquidador3@sidepp.com  → EFA San Bonifacio');
  console.log('═══════════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
