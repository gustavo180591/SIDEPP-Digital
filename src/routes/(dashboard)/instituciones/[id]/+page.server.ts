import { error } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const institutionId = params.id;
  
  if (!institutionId) {
    throw error(400, 'ID de institución requerido');
  }

  try {
    // Obtener los datos de la institución
    const institution = await InstitutionService.getById(institutionId);
    
    if (!institution) {
      throw error(404, 'Institución no encontrada');
    }

    // Obtener los miembros de la institución (esto dependerá de tu modelo de datos)
    // Por ahora asumo que tienes una relación con usuarios o miembros
    const members = await InstitutionService.getMembers(institutionId);

    return {
      institution,
      members
    };
  } catch (err) {
    console.error('Error al cargar institución:', err);
    throw error(500, 'Error interno del servidor');
  }
};
