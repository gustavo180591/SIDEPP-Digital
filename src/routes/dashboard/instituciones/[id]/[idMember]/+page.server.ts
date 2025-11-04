import { error } from '@sveltejs/kit';
import { MemberService } from '$lib/db/services/memberService';
import { InstitutionService } from '$lib/db/services/institutionService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { id: institutionId, idMember } = params;

  if (!institutionId || !idMember) {
    throw error(400, 'ID de institución y miembro requeridos');
  }

  // Validar que usuarios INTITUTION solo puedan acceder a miembros de su institución
  if (locals.user?.role === 'INTITUTION') {
    if (!locals.user.institutionId) {
      throw error(403, 'Usuario sin institución asignada');
    }
    if (institutionId !== locals.user.institutionId) {
      throw error(403, 'No tiene permiso para ver esta institución');
    }
  }

  // Obtener los datos de la institución
  const institution = await InstitutionService.getById(institutionId);

  if (!institution) {
    throw error(404, 'Institución no encontrada');
  }

  // Obtener los datos del miembro con sus contribuciones
  const memberData = await MemberService.findById(idMember);

  if (!memberData) {
    throw error(404, 'Miembro no encontrado');
  }

  // Verificar que el miembro pertenezca a esta institución
  if (memberData.institucionId !== institutionId) {
    throw error(403, 'El miembro no pertenece a esta institución');
  }

  // Serializar los datos para evitar problemas con Decimal de Prisma
  const contributions = (memberData as any).contributions || [];

  return {
    institution,
    member: {
      ...memberData,
      contributions: contributions.map((contribution: any) => ({
        ...contribution,
        conceptAmount: contribution.conceptAmount ? Number(contribution.conceptAmount) : null,
        totalRem: contribution.totalRem ? Number(contribution.totalRem) : null
      }))
    }
  };
};
