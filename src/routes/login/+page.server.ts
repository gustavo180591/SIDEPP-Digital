import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { UserService } from '$lib/db/services/userService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export const load: ServerLoad = async ({ locals }) => {
  // Si ya está autenticado, redirigir al dashboard
  if (locals.user) {
    throw redirect(303, '/dashboard');
  }
  
  return {};
};

export const actions: Actions = {
  login: async ({ request, cookies, url }) => {
    try {
      const formData = await request.formData();
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const redirectTo = formData.get('redirect') as string || '/dashboard';

      // Validaciones básicas
      if (!email?.trim()) {
        return fail(400, { error: 'El email es requerido' });
      }

      if (!password?.trim()) {
        return fail(400, { error: 'La contraseña es requerida' });
      }

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
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return fail(401, { error: 'Credenciales inválidas' });
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          role: user.role,
          institutionId: user.institutionId
        }, 
        JWT_SECRET, 
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Configurar cookie de sesión
      cookies.set('auth_token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 7 días
      });

      // Redirigir al usuario
      throw redirect(303, redirectTo);

    } catch (error) {
      console.error('Error en login:', error);
      
      // Si es un redirect, lo re-lanzamos
      if (error instanceof Response) {
        throw error;
      }
      
      return fail(500, { error: 'Error interno del servidor' });
    }
  }
};
