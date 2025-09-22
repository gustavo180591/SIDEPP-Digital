import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { validateSession } from '$lib/server/auth/utils';

const publicRoutes = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/unauthorized'];

const auth: Handle = async ({ event, resolve }) => {
  const sessionToken = event.cookies.get('session_token');

  if (sessionToken) {
    const user = await validateSession(sessionToken);
    if (user) {
      // Gracias a app.d.ts, TypeScript ya sabe qué es locals.user
      event.locals.user = {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: user.role // 'ADMIN' | 'OPERATOR' | 'VIEWER'
      };
    } else {
      event.cookies.delete('session_token', { path: '/' });
    }
  }

  // Bloqueo de rutas públicas/privadas
  const isPublic = publicRoutes.some((route) => event.url.pathname.startsWith(route));
  if (!isPublic && !event.locals.user) {
    throw redirect(303, '/login?redirect=' + encodeURIComponent(event.url.pathname));
  }

  // Autorización por rol
  if (event.locals.user) {
    const userRole = event.locals.user.role;
    const path = event.url.pathname;

    const adminRoutes = ['/admin'];
    const operatorRoutes = ['/upload', '/reports'];

    const needsAdmin = adminRoutes.some((r) => path.startsWith(r));
    const needsOperator = operatorRoutes.some((r) => path.startsWith(r));

    if ((needsAdmin && userRole !== 'ADMIN') ||
        (needsOperator && !['ADMIN', 'OPERATOR'].includes(userRole))) {
      throw redirect(303, '/unauthorized');
    }
  }

  return resolve(event);
};

export const handle = sequence(auth);
