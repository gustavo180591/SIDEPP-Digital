// import { redirect, type Handle } from '@sveltejs/kit';
// import { sequence } from '@sveltejs/kit/hooks';
// import { UserService } from '$lib/db/services/userService';
// import jwt from 'jsonwebtoken';

// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// // Rutas públicas que no requieren autenticación
// const publicRoutes = ['/login', '/api/auth', '/unauthorized', '/logout'];

// // Función para validar token JWT
// async function validateToken(token: string) {
//   try {
//     const decoded = jwt.verify(token, JWT_SECRET) as { 
//       userId: string; 
//       email: string; 
//       role: string;
//       institutionId?: string;
//     };
    
//     // Verificar que el usuario aún existe y está activo
//     const user = await UserService.findById(decoded.userId);
    
//     if (!user || !user.isActive) {
//       return null;
//     }

//     return {
//       id: user.id,
//       email: user.email,
//       name: user.name,
//       role: user.role,
//       institutionId: user.institutionId
//     };
//   } catch (error) {
//     console.error('Error validating token:', error);
//     return null;
//   }
// }

// // Función para generar token JWT
// export function generateToken(userId: string, email: string, role: string, institutionId?: string) {
//   return jwt.sign(
//     { userId, email, role, institutionId }, 
//     JWT_SECRET, 
//     { expiresIn: '7d' }
//   );
// }

// const auth: Handle = async ({ event, resolve }) => {
//   const token = event.cookies.get('auth_token');
  
//   // Verificar si la ruta es pública
//   const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));
  
//   // Si no hay token de autenticación, solo permitir rutas públicas
//   if (!token) {
//     if (!isPublic) {
//       throw redirect(303, '/login');
//     }
//     return resolve(event);
//   }

//   // Validar token si existe
//   const user = await validateToken(token);
//   if (user) {
//     console.log('✅ Usuario autenticado en hook:', user.email, 'Rol:', user.role);
//     event.locals.user = user;
//   } else {
//     // Token inválido, eliminar cookie y redirigir a login
//     console.log('❌ Token inválido en hook');
//     event.cookies.delete('auth_token', { path: '/' });
//     throw redirect(303, '/login');
//   }

//   // Si es la ruta raíz y hay usuario autenticado, redirigir al dashboard
//   if (event.url.pathname === '/' && event.locals.user) {
//     console.log('🔄 Redirigiendo desde ruta raíz a dashboard');
//     throw redirect(303, '/dashboard');
//   }

//   // Autorización por rol (solo si hay usuario autenticado)
//   if (event.locals.user) {
//     const userRole = event.locals.user.role;
//     const path = event.url.pathname;
    
//     console.log('🔐 Verificando autorización - Ruta:', path, 'Rol:', userRole);

//     // Definir rutas que requieren roles específicos
//     const adminRoutes = ['/dashboard/usuarios', '/dashboard/instituciones'];
//     const operatorRoutes = ['/dashboard/upload'];

//     const needsAdmin = adminRoutes.some((r) => path.startsWith(r));
//     const needsOperator = operatorRoutes.some((r) => path.startsWith(r));
    
//     console.log('🔐 Necesita admin:', needsAdmin, 'Necesita operator:', needsOperator);

//     // Verificar permisos
//     if (needsAdmin && userRole !== 'ADMIN') {
//       console.log('❌ Sin permisos de admin, redirigiendo a unauthorized');
//       throw redirect(303, '/unauthorized');
//     }
    
//     if (needsOperator && !['ADMIN', 'OPERATOR'].includes(userRole)) {
//       console.log('❌ Sin permisos de operator, redirigiendo a unauthorized');
//       throw redirect(303, '/unauthorized');
//     }
    
//     console.log('✅ Permisos OK, continuando');
//   }

//   return resolve(event);
// };

// export const handle = sequence(auth);