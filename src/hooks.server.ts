import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { verifyToken, validateUser } from '$lib/server/auth/utils';

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/unauthorized', '/logout'];

const auth: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('auth_token');

  // Verificar si la ruta es pública
  const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));

  // Si no hay token de autenticación, solo permitir rutas públicas
  if (!token) {
    if (!isPublic && event.url.pathname !== '/') {
      throw redirect(303, '/login');
    }
    return resolve(event);
  }

  // Validar token JWT si existe
  const decoded = await verifyToken(token);

  if (decoded) {
    // Verificar que el usuario aún existe y está activo
    const user = await validateUser(decoded.userId);

    if (user) {
      console.log('✅ Usuario autenticado:', user.email, 'Rol:', user.role);
      event.locals.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        institutionId: user.institutionId
      };
    } else {
      // Usuario no existe o está inactivo
      console.log('❌ Usuario no válido en base de datos');
      event.cookies.delete('auth_token', { path: '/' });
      if (!isPublic) {
        throw redirect(303, '/login');
      }
    }
  } else {
    // Token inválido o expirado
    console.log('❌ Token JWT inválido o expirado');
    event.cookies.delete('auth_token', { path: '/' });
    if (!isPublic && event.url.pathname !== '/') {
      throw redirect(303, '/login');
    }
  }

  // Si es la ruta raíz y hay usuario autenticado, redirigir al dashboard
  if (event.url.pathname === '/' && event.locals.user) {
    console.log('🔄 Redirigiendo desde ruta raíz a dashboard');
    throw redirect(303, '/dashboard');
  }

  // Autorización por rol (solo si hay usuario autenticado)
  if (event.locals.user) {
    const userRole = event.locals.user.role;
    const path = event.url.pathname;

    console.log('🔐 Verificando autorización - Ruta:', path, 'Rol:', userRole);

    // Rutas exclusivas para ADMIN
    const adminOnlyRoutes = ['/dashboard/usuarios'];

    // Rutas de instituciones - permitir ADMIN e INTITUTION
    const institutionRoutes = ['/dashboard/instituciones'];

    // Verificar rutas solo-admin
    const needsAdminOnly = adminOnlyRoutes.some((r) => path.startsWith(r));
    const isInstitutionRoute = institutionRoutes.some((r) => path.startsWith(r));

    console.log('🔐 Ruta solo-admin:', needsAdminOnly, '| Ruta institución:', isInstitutionRoute);

    // Bloquear rutas solo-admin para no-admins
    if (needsAdminOnly && userRole !== 'ADMIN') {
      console.log('❌ Sin permisos de admin, redirigiendo a unauthorized');
      throw redirect(303, '/unauthorized');
    }

    // Para rutas de instituciones, permitir ADMIN e INTITUTION
    // Las validaciones a nivel de página verificarán que INTITUTION solo vea su institución
    if (isInstitutionRoute && userRole !== 'ADMIN' && userRole !== 'INTITUTION') {
      console.log('❌ Sin permisos para ver instituciones, redirigiendo a unauthorized');
      throw redirect(303, '/unauthorized');
    }

    console.log('✅ Permisos OK, continuando');
  }

  return resolve(event);
};

export const handle = sequence(auth);