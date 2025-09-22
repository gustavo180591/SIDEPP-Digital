import { prisma } from '$lib/server/db';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

export const SALT_ROUNDS = 10;
const JWT_SECRET = env.JWT_SECRET || 'your-secret-key-change-in-production';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 días

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, userAgent?: string, ipAddress?: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
  });

  return {
    token,
    expiresAt,
    sessionId: session.id,
  };
}

export async function validateSession(token: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
} | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || new Date() > session.expiresAt) {
    return null;
  }

  // Actualizar la última actividad
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  });

  // Asegurarse de que el tipo de retorno coincida exactamente
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as 'ADMIN' | 'OPERATOR' | 'VIEWER',
  };
}

export async function invalidateSession(token: string) {
  await prisma.session.deleteMany({
    where: { token },
  });
}

export async function invalidateAllSessions(userId: string) {
  await prisma.session.deleteMany({
    where: { userId },
  });
}
