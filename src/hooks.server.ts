// import { redirect, type Handle } from '@sveltejs/kit';
// import { sequence } from '@sveltejs/kit/hooks';
// import { prisma } from '$lib/db';
// import { compare } from 'bcryptjs';
// import jwt from 'jsonwebtoken';
// const { sign, verify } = jwt;

// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// const JWT_EXPIRES_IN = '7d';

// const publicRoutes = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/unauthorized'];

// // Función para validar token JWT
// async function validateToken(token: string) {
//   try {
//     const decoded = verify(token, JWT_SECRET) as { userId: string; email: string };
//     const user = await prisma.user.findUnique({
//       where: { id: decoded.userId },
//       select: {
//         id: true,
//         email: true,
//         name: true,
//         role: true,
//         isActive: true,
//         institutionId: true
//       }
//     });

//     if (!user || !user.isActive) {
//       return null;
//     }

//     return user;
//   } catch (error) {
//     return null;
//   }
// }

// // Función para generar token JWT
// export function generateToken(userId: string, email: string) {
//   return sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
// }

// const auth: Handle = async ({ event, resolve }) => {
//   const token = event.cookies.get('auth_token');

//   if (token) {
//     const user = await validateToken(token);
//     if (user) {
//       event.locals.user = {
//         id: user.id,
//         email: user.email,
//         name: user.name,
//         role: user.role as 'ADMIN' | 'OPERATOR' | 'VIEWER',
//         institutionId: user.institutionId
//       };
//     } else {
//       event.cookies.delete('auth_token', { path: '/' });
//     }
//   }

//   // Bloqueo de rutas públicas/privadas
//   const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));
//   if (!isPublic && !event.locals.user) {
//     throw redirect(303, '/login?redirect=' + encodeURIComponent(event.url.pathname));
//   }

//   // Autorización por rol
//   if (event.locals.user) {
//     const userRole = event.locals.user.role;
//     const path = event.url.pathname;

//     const adminRoutes = ['/admin', '/instituciones'];
//     const operatorRoutes = ['/upload', '/reports'];

//     const needsAdmin = adminRoutes.some((r) => path.startsWith(r));
//     const needsOperator = operatorRoutes.some((r) => path.startsWith(r));

//     if ((needsAdmin && userRole !== 'ADMIN') ||
//         (needsOperator && !['ADMIN', 'OPERATOR'].includes(userRole))) {
//       throw redirect(303, '/unauthorized');
//     }
//   }

//   return resolve(event);
// };

// export const handle = sequence(auth);
