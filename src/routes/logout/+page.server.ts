import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
  // Eliminar cookie de autenticación
  cookies.delete('auth_token', { path: '/' });
  
  // Redirigir a login
  throw redirect(303, '/login');
};
