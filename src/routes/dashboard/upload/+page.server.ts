import { redirect } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Validar que el usuario esté autenticado
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  // Validar que el usuario pueda subir (ADMIN o LIQUIDADOR)
  if (locals.user.role !== 'ADMIN' && locals.user.role !== 'LIQUIDADOR') {
    throw redirect(303, '/unauthorized');
  }

  // Para ADMIN, mostrar todas las instituciones
  // Para LIQUIDADOR, mostrar solo sus instituciones asignadas
  let institutions: Array<{ id: string; name: string | null; fopidEnabled?: boolean }> = [];

  if (locals.user.role === 'ADMIN') {
    const result = await InstitutionService.findMany({}, { page: 1, limit: 100 });
    institutions = result.data.map(inst => ({ id: inst.id, name: inst.name, fopidEnabled: inst.fopidEnabled ?? true }));
  } else {
    // LIQUIDADOR: usar las instituciones del usuario
    const userInsts = locals.user.institutions || [];
    // Enrich with fopidEnabled from DB
    for (const inst of userInsts) {
      const full = await InstitutionService.getById(inst.id);
      institutions.push({ id: inst.id, name: inst.name, fopidEnabled: full?.fopidEnabled ?? true });
    }
  }

  return {
    institutions,
    userRole: locals.user.role
  };
};
