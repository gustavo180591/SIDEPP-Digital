import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ cookies }) => {
    // Eliminar cookie de autenticación
    cookies.delete('auth_token', { path: '/' });

    // Redirigir a login
    throw redirect(303, '/login');
  }
};
