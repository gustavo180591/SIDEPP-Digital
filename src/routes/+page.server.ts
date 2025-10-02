import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Si está logueado, redirigir al dashboard
  if (locals.user) {
    throw redirect(303, '/dashboard');
  }
  
  // Si no está logueado, redirigir al login
  throw redirect(303, '/login');
};
