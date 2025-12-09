import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Manejar GET request para logout directo
export const load: PageServerLoad = async ({ cookies }) => {
  cookies.delete('auth_token', { path: '/' });
  throw redirect(303, '/login');
};

export const actions: Actions = {
  default: async ({ cookies }) => {
    // Eliminar cookie de autenticación
    cookies.delete('auth_token', { path: '/' });

    // Redirigir a login
    throw redirect(303, '/login');
  }
};
