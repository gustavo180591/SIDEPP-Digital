// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SIDEPP...');

  const defaultPassword = '123456';
  const hashed = await hash(defaultPassword, 10);

  // Crear instituciones de ejemplo
  console.log('🏢 Creando instituciones...');

  const institution1 = await prisma.institution.upsert({
    where: { id: 'inst-municipalidad-clorinda' },
    update: { name: 'Municipalidad de Clorinda', cuit: '30-99999999-1' },
    create: {
      id: 'inst-municipalidad-clorinda',
      name: 'Municipalidad de Clorinda',
      cuit: '30-99999999-1'
    }
  });

  const institution2 = await prisma.institution.upsert({
    where: { id: 'inst-hospital-central' },
    update: { name: 'Hospital Central Formosa', cuit: '30-88888888-2' },
    create: {
      id: 'inst-hospital-central',
      name: 'Hospital Central Formosa',
      cuit: '30-88888888-2'
    }
  });

  const institution3 = await prisma.institution.upsert({
    where: { id: 'inst-escuela-tecnica' },
    update: { name: 'Escuela Técnica N°1', cuit: '30-77777777-3' },
    create: {
      id: 'inst-escuela-tecnica',
      name: 'Escuela Técnica N°1',
      cuit: '30-77777777-3'
    }
  });

  console.log('✅ Instituciones creadas:', institution1.name, institution2.name, institution3.name);

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

  // Liquidador 1: solo Municipalidad de Clorinda
  await prisma.userInstitution.upsert({
    where: {
      userId_institutionId: {
        userId: liquidador1.id,
        institutionId: institution1.id
      }
    },
    update: {},
    create: {
      userId: liquidador1.id,
      institutionId: institution1.id
    }
  });
  console.log('  ✓ Liquidador 1 → Municipalidad de Clorinda');

  // Liquidador 2: solo Hospital Central
  await prisma.userInstitution.upsert({
    where: {
      userId_institutionId: {
        userId: liquidador2.id,
        institutionId: institution2.id
      }
    },
    update: {},
    create: {
      userId: liquidador2.id,
      institutionId: institution2.id
    }
  });
  console.log('  ✓ Liquidador 2 → Hospital Central');

  // Liquidador 3: múltiples instituciones (Municipalidad + Escuela Técnica)
  await prisma.userInstitution.upsert({
    where: {
      userId_institutionId: {
        userId: liquidador3.id,
        institutionId: institution1.id
      }
    },
    update: {},
    create: {
      userId: liquidador3.id,
      institutionId: institution1.id
    }
  });
  await prisma.userInstitution.upsert({
    where: {
      userId_institutionId: {
        userId: liquidador3.id,
        institutionId: institution3.id
      }
    },
    update: {},
    create: {
      userId: liquidador3.id,
      institutionId: institution3.id
    }
  });
  console.log('  ✓ Liquidador 3 → Municipalidad de Clorinda + Escuela Técnica N°1');

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
  console.log('  • liquidador1@sidepp.com  → Solo sube (1 institución)');
  console.log('  • liquidador2@sidepp.com  → Solo sube (1 institución)');
  console.log('  • liquidador3@sidepp.com  → Solo sube (2 instituciones)');
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
