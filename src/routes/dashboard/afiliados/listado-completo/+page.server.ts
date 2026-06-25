import { error, redirect } from '@sveltejs/kit';
import { MemberService } from '$lib/db/services/memberService';
import { InstitutionService } from '$lib/db/services/institutionService';
import { prisma } from '$lib/db';
import type { PageServerLoad } from './$types';

// Helper para verificar acceso a institución
function hasAccessToInstitution(user: App.Locals['user'], institutionId: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  // LIQUIDADOR solo puede acceder a sus instituciones asignadas
  return user.institutions?.some(inst => inst.id === institutionId) || false;
}

export const load: PageServerLoad = async ({ locals }) => {
  // Validar que el usuario esté autenticado
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  try {
    // Control de acceso por rol
    const canEdit = locals.user.role === 'ADMIN' || locals.user.role === 'LIQUIDADOR';

    let institutionIds: string[] | undefined;

    // Si el usuario es LIQUIDADOR, obtener solo sus instituciones
    if (locals.user.role === 'LIQUIDADOR') {
      if (!locals.user.institutions || locals.user.institutions.length === 0) {
        throw error(403, 'Usuario sin institución asignada');
      }
      institutionIds = locals.user.institutions.map(inst => inst.id);
    }

    // Obtener todos los miembros sin paginación
    const members = await MemberService.getAllWithoutPagination({
      institutionIds
    });

    // Obtener contribuciones de cada miembro para el año actual
    const currentYear = new Date().getFullYear();
    const memberIds = members.map(m => m.id);

    const contributions = await prisma.contributionLine.findMany({
      where: {
        memberId: { in: memberIds },
        createdAt: {
          gte: new Date(currentYear, 0, 1), // 1 de enero del año actual
          lt: new Date(currentYear + 1, 0, 1) // 1 de enero del siguiente año
        }
      },
      select: {
        memberId: true,
        conceptAmount: true,
        createdAt: true
      }
    });

    // Agrupar contribuciones por miembro y mes
    const contributionsByMember = new Map<string, Array<{ monthIndex: number; amount: number }>>();

    for (const contrib of contributions) {
      if (!contrib.memberId || !contrib.conceptAmount) continue;

      const monthIndex = contrib.createdAt.getMonth(); // 0-11
      const amount = Number(contrib.conceptAmount);

      if (!contributionsByMember.has(contrib.memberId)) {
        contributionsByMember.set(contrib.memberId, []);
      }

      const memberContribs = contributionsByMember.get(contrib.memberId)!;

      // Sumar si ya existe contribución para ese mes
      const existingMonth = memberContribs.find(c => c.monthIndex === monthIndex);
      if (existingMonth) {
        existingMonth.amount += amount;
      } else {
        memberContribs.push({ monthIndex, amount });
      }
    }

    // Obtener lista de instituciones para el selector (solo si puede editar)
    let institutions: Array<{ id: string; name: string }> = [];
    if (canEdit) {
      if (locals.user.role === 'LIQUIDADOR') {
        // LIQUIDADOR solo ve sus instituciones
        institutions = await InstitutionService.getListForSelect(
          locals.user.institutions.map(inst => inst.id)
        );
      } else {
        // ADMIN ve todas
        institutions = await InstitutionService.getListForSelect();
      }
    }

    return {
      members,
      canEdit,
      institutions,
      contributionsByMember: Object.fromEntries(contributionsByMember),
      user: {
        role: locals.user.role,
        institutions: locals.user.institutions || []
      }
    };
  } catch (err) {
    console.error('Error al cargar listado completo de afiliados:', err);
    throw error(500, 'Error interno del servidor');
  }
};
