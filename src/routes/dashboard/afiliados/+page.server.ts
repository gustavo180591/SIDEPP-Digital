import { error, redirect } from '@sveltejs/kit';
import { MemberService } from '$lib/db/services/memberService';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  // Validar que el usuario esté autenticado
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  try {
    // Obtener parámetros de búsqueda y paginación
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    let institutionId = url.searchParams.get('institutionId') || undefined;

    // Si el usuario es INTITUTION, forzar filtro por su institución
    if (locals.user.role === 'INTITUTION') {
      if (!locals.user.institutionId) {
        throw error(403, 'Usuario sin institución asignada');
      }
      institutionId = locals.user.institutionId;
    }

    // Obtener todos los miembros con filtros
    const members = await MemberService.getAll({
      search,
      page,
      limit,
      institutionId
    });

    return {
      members: members.data || [],
      pagination: {
        currentPage: members.meta.currentPage,
        totalPages: members.meta.lastPage,
        totalItems: members.meta.total,
        itemsPerPage: members.meta.perPage
      },
      search,
      institutionId
    };
  } catch (err) {
    console.error('Error al cargar afiliados:', err);
    throw error(500, 'Error interno del servidor');
  }
};
