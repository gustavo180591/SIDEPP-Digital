import { type RequestEvent } from '@sveltejs/kit';
import { verifyToken, validateUser } from './utils';

export interface AuthResult {
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR';
    institutions: { id: string; name: string | null }[];
    // Compatibilidad temporal - primera institución
    institutionId: string | null;
    institutionName: string | null;
  };
  error?: string;
  status?: number;
}

/**
 * Middleware para requerir autenticación en endpoints de API
 * Retorna el usuario autenticado o un objeto de error
 */
export async function requireAuth(event: RequestEvent): Promise<AuthResult> {
  const token = event.cookies.get('auth_token');

  if (!token) {
    return {
      error: 'No autorizado. Se requiere autenticación.',
      status: 401
    };
  }

  // Validar token JWT
  const decoded = await verifyToken(token);

  if (!decoded) {
    return {
      error: 'Token inválido o expirado.',
      status: 401
    };
  }

  // Verificar que el usuario existe y está activo
  const user = await validateUser(decoded.userId);

  if (!user) {
    return {
      error: 'Usuario no válido o inactivo.',
      status: 401
    };
  }

  return { user };
}

/**
 * Middleware para requerir un rol específico
 * Retorna el usuario autenticado si tiene el rol requerido, o un error
 */
export async function requireRole(
  event: RequestEvent,
  allowedRoles: Array<'ADMIN' | 'FINANZAS' | 'LIQUIDADOR'>
): Promise<AuthResult> {
  const authResult = await requireAuth(event);

  if (authResult.error) {
    return authResult;
  }

  const user = authResult.user!;

  if (!allowedRoles.includes(user.role)) {
    return {
      error: 'No tienes permisos para acceder a este recurso.',
      status: 403
    };
  }

  return { user };
}

/**
 * Middleware que solo permite ADMIN
 */
export async function requireAdmin(event: RequestEvent): Promise<AuthResult> {
  return requireRole(event, ['ADMIN']);
}
