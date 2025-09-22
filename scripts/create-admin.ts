import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/lib/server/db.js';
import { hashPassword } from '../src/lib/server/auth/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });


async function main() {
  const email = 'admin@sidepp.com';
  const password = '123456';
  const name = 'Administrador';

  try {
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log(`Admin user with email ${email} already exists.`);
      return;
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the admin user
    await prisma.user.create({
      data: {
        email,
        name,
        hash: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log('Admin user created successfully:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password} (please change this after first login)`);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
