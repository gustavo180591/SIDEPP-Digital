import type { PageServerLoad } from './$types';
import {
  getInstitutionsForReport,
  getAvailableMonthsRange
} from '$lib/db/services/reportService';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
  // Verificar autenticación
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  // Obtener instituciones disponibles
  const institutions = await getInstitutionsForReport();

  // Obtener rango de meses disponibles
  const monthsRange = await getAvailableMonthsRange();

  return {
    user: locals.user,
    institutions,
    monthsRange
  };
};
