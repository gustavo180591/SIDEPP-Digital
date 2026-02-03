import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { UserService } from '$lib/db/services/userService';
import { verifyPassword, generateToken } from '$lib/server/auth/utils';

export const load: ServerLoad = async ({ locals }) => {
  // Si ya está autenticado, redirigir al dashboard
  if (locals.user) {
    throw redirect(303, '/dashboard');
  }

  return {};
};

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    let redirectTo = formData.get('redirect') as string || '/dashboard';
    if (!redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
      redirectTo = '/dashboard';
    }

    // Validaciones básicas
    if (!email?.trim()) {
      return fail(400, { error: 'El email es requerido' });
    }

    if (!password?.trim()) {
      return fail(400, { error: 'La contraseña es requerida' });
    }

    try {
      // Buscar usuario por email
      const user = await UserService.findByEmail(email.trim());

      if (!user) {
        return fail(401, { error: 'Credenciales inválidas' });
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        return fail(401, { error: 'Tu cuenta está desactivada. Contacta al administrador.' });
      }

      // Verificar contraseña
      const isValidPassword = await verifyPassword(password, user.password);

      if (!isValidPassword) {
        return fail(401, { error: 'Credenciales inválidas' });
      }

      // Extraer IDs de instituciones de la relación N:N
      const institutionIds = user.userInstitutions?.map(ui => ui.institution.id) || [];

      // Generar token JWT usando la utilidad centralizada
      const token = generateToken(
        user.id,
        user.email,
        user.role,
        institutionIds
      );

      // Configurar cookie de sesión
      cookies.set('auth_token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 7 días
      });

    } catch (error) {
      console.error('Error en login:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }

    // Redirigir al usuario FUERA del try-catch
    throw redirect(303, redirectTo);
  }
};
