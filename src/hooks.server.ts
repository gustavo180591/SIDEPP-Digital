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
      console.log('✅ Usuario autenticado:', user.email, 'Rol:', user.role, 'Instituciones:', user.institutions.length);
      event.locals.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        institutions: user.institutions,
        // Compatibilidad temporal
        institutionId: user.institutionId,
        institutionName: user.institutionName
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

    // Rutas para subir - ADMIN y LIQUIDADOR
    const uploadRoutes = ['/dashboard/upload'];

    // Verificar rutas solo-admin
    const needsAdminOnly = adminOnlyRoutes.some((r) => path.startsWith(r));
    const isUploadRoute = uploadRoutes.some((r) => path.startsWith(r));

    // Verificar si es ruta de listado de instituciones (exacta) o afiliados
    const isInstitutionsListRoute = path === '/dashboard/instituciones';
    const isAfiliadosRoute = path.startsWith('/dashboard/afiliados');

    // Verificar si es ruta de detalle de institución (/dashboard/instituciones/{id})
    const isInstitutionDetailRoute = path.startsWith('/dashboard/instituciones/') && path !== '/dashboard/instituciones/';

    console.log('🔐 Ruta solo-admin:', needsAdminOnly, '| Ruta upload:', isUploadRoute, '| Lista instituciones:', isInstitutionsListRoute, '| Detalle institución:', isInstitutionDetailRoute);

    // Bloquear rutas solo-admin para no-admins
    if (needsAdminOnly && userRole !== 'ADMIN') {
      console.log('❌ Sin permisos de admin, redirigiendo a unauthorized');
      throw redirect(303, '/unauthorized');
    }

    // Lista de instituciones: ADMIN, FINANZAS y LIQUIDADOR
    if (isInstitutionsListRoute && userRole !== 'ADMIN' && userRole !== 'FINANZAS' && userRole !== 'LIQUIDADOR') {
      console.log('❌ Sin permisos para ver lista de instituciones');
      throw redirect(303, '/unauthorized');
    }

    // Afiliados: solo ADMIN y FINANZAS
    if (isAfiliadosRoute && userRole !== 'ADMIN' && userRole !== 'FINANZAS') {
      console.log('❌ Sin permisos para ver afiliados');
      throw redirect(303, '/unauthorized');
    }

    // Detalle de institución: solo ADMIN y FINANZAS pueden acceder
    if (isInstitutionDetailRoute && userRole !== 'ADMIN' && userRole !== 'FINANZAS') {
      console.log('❌ Sin permisos para ver detalle de institución');
      throw redirect(303, '/unauthorized');
    }

    // Rutas de upload: solo ADMIN y LIQUIDADOR
    if (isUploadRoute && userRole !== 'ADMIN' && userRole !== 'LIQUIDADOR') {
      console.log('❌ Sin permisos para subir, redirigiendo a unauthorized');
      throw redirect(303, '/unauthorized');
    }

    console.log('✅ Permisos OK, continuando');
  }

  return resolve(event);
};

export const handle = sequence(auth);