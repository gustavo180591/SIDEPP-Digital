import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting admin user creation...');

  // Admin user credentials
  const adminEmail = 'admin@sidepp.com';
  const adminPassword = '123456';

  try {
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      console.log(`🔄 Updating existing admin user...`);
      // Update the existing user to ensure they have admin role and current password
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: 'Administrador',
          hash: await hash(adminPassword, 10),
          role: UserRole.ADMIN,
        },
      });
    } else {
      // Create admin user
      console.log('👤 Creating admin user...');
      const hashedPassword = await hash(adminPassword, 10);
      // Create admin user with proper typing
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: 'Administrador',
          hash: hashedPassword,
          role: UserRole.ADMIN,
        },
      });
    }
    
    console.log('✅ Admin user created/updated successfully!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword} (please change this after first login)`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error during admin user creation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
