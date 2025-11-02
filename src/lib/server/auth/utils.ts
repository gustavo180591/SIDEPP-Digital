import { prisma } from '$lib/server/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

export const SALT_ROUNDS = 10;
const JWT_SECRET = env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string, email: string, role: string, institutionId?: string | null): string {
  return jwt.sign(
    {
      userId,
      email,
      role,
      institutionId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function verifyToken(token: string): Promise<{
  userId: string;
  email: string;
  role: string;
  institutionId?: string | null;
} | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      institutionId?: string | null;
    };
    return decoded;
  } catch {
    return null;
  }
}

export async function validateUser(userId: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'OPERATOR' | 'INTITUTION';
  institutionId: string | null;
} | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        institutionId: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionId: user.institutionId
    };
  } catch (error) {
    console.error('Error validating user:', error);
    return null;
  }
}
