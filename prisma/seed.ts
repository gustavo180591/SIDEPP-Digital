// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SIDEPP...');
  
  const adminEmail = 'admin@sidepp.com';
  const adminPassword = '123456';
  const hashed = await hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { 
      name: 'Administrador',
      password: hashed,
      isActive: true,
      role: 'ADMIN'
    },
    create: { 
      email: adminEmail, 
      name: 'Administrador', 
      password: hashed,
      isActive: true,
      role: 'ADMIN'
    }
  });

  console.log('👤 Admin user created or updated:', adminUser.email);

  console.log('✅ Seed OK. Admin:', adminEmail, adminPassword);
}

main()
  .catch((e) => { 
    console.error('❌ Error during seeding:', e); 
    throw e;
  })
  .finally(async () => { 
    await prisma.$disconnect(); 
  });
