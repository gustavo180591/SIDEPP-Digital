import { prisma } from '$lib/server/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

export const SALT_ROUNDS = 10;
const JWT_SECRET = env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string, email: string, role: string, institutionIds: string[] = []): string {
  return jwt.sign(
    {
      userId,
      email,
      role,
      institutionIds
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function verifyToken(token: string): Promise<{
  userId: string;
  email: string;
  role: string;
  institutionIds: string[];
} | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      institutionIds?: string[];
    };
    return {
      ...decoded,
      institutionIds: decoded.institutionIds || []
    };
  } catch {
    return null;
  }
}

export async function validateUser(userId: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR';
  institutions: { id: string; name: string | null }[];
  // Compatibilidad temporal
  institutionId: string | null;
  institutionName: string | null;
} | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        userInstitutions: {
          select: {
            institution: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Mapear instituciones del usuario
    const institutions = user.userInstitutions.map(ui => ({
      id: ui.institution.id,
      name: ui.institution.name
    }));

    // Primera institución para compatibilidad
    const firstInstitution = institutions[0] || null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institutions,
      institutionId: firstInstitution?.id || null,
      institutionName: firstInstitution?.name || null
    };
  } catch (error) {
    console.error('Error validating user:', error);
    return null;
  }
}
