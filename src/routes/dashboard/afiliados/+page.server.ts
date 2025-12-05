import { error, redirect } from '@sveltejs/kit';
import { MemberService } from '$lib/db/services/memberService';
import { InstitutionService } from '$lib/db/services/institutionService';
import type { PageServerLoad, Actions } from './$types';

// Helper para verificar acceso a institución
function hasAccessToInstitution(user: App.Locals['user'], institutionId: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  // LIQUIDADOR solo puede acceder a sus instituciones asignadas
  return user.institutions?.some(inst => inst.id === institutionId) || false;
}

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
    let institutionIds: string[] | undefined;

    // Control de acceso por rol
    const canEdit = locals.user.role === 'ADMIN' || locals.user.role === 'LIQUIDADOR';

    // Si el usuario es LIQUIDADOR, forzar filtro por sus instituciones
    if (locals.user.role === 'LIQUIDADOR') {
      if (!locals.user.institutions || locals.user.institutions.length === 0) {
        throw error(403, 'Usuario sin institución asignada');
      }
      // Si hay una institución seleccionada en URL, validar que el usuario tenga acceso
      if (institutionId) {
        const hasAccess = locals.user.institutions.some(inst => inst.id === institutionId);
        if (!hasAccess) {
          throw error(403, 'No tiene acceso a esta institución');
        }
      } else {
        // Si no hay filtro, mostrar de todas sus instituciones
        institutionIds = locals.user.institutions.map(inst => inst.id);
      }
    }

    // Obtener todos los miembros con filtros
    const members = await MemberService.getAll({
      search,
      page,
      limit,
      institutionId,
      institutionIds
    });

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
      members: members.data || [],
      pagination: {
        currentPage: members.meta.currentPage,
        totalPages: members.meta.lastPage,
        totalItems: members.meta.total,
        itemsPerPage: members.meta.perPage
      },
      search,
      institutionId,
      canEdit,
      institutions,
      user: {
        role: locals.user.role,
        institutions: locals.user.institutions || []
      }
    };
  } catch (err) {
    console.error('Error al cargar afiliados:', err);
    throw error(500, 'Error interno del servidor');
  }
};

export const actions: Actions = {
  // Crear miembro
  createMember: async ({ request, locals }) => {
    // FINANZAS no puede crear miembros (solo lectura)
    if (locals.user?.role === 'FINANZAS') {
      return { success: false, message: 'No tiene permisos para crear miembros' };
    }

    try {
      const formData = await request.formData();
      const institutionId = formData.get('institutionId') as string;

      if (!institutionId) {
        return { success: false, message: 'Debe seleccionar una institución' };
      }

      // Validar que usuarios LIQUIDADOR solo puedan crear miembros en sus instituciones
      if (locals.user?.role === 'LIQUIDADOR') {
        if (!hasAccessToInstitution(locals.user, institutionId)) {
          return { success: false, message: 'No tiene permiso para crear miembros en esta institución' };
        }
      }

      const memberData = {
        fullName: formData.get('fullName') as string,
        email: (formData.get('email') as string) || undefined,
        phone: (formData.get('phone') as string) || undefined,
        numeroOrden: formData.get('numeroOrden') as string,
        numeroMatricula: formData.get('numeroMatricula') as string,
        documentoIdentidad: formData.get('documentoIdentidad') as string,
        membershipStartDate: new Date(formData.get('membershipStartDate') as string),
        status: (formData.get('status') as 'active' | 'inactive') || 'active',
        institucionId: institutionId
      };

      // Validar campos requeridos
      if (!memberData.fullName || !memberData.documentoIdentidad ||
          !memberData.numeroOrden || !memberData.numeroMatricula) {
        return { success: false, message: 'Todos los campos obligatorios deben ser completados' };
      }

      // Verificar que el número de orden no esté duplicado en esa institución
      const ordenExists = await MemberService.existsByNumeroOrden(memberData.numeroOrden, institutionId);
      if (ordenExists) {
        return { success: false, message: 'El número de orden ya existe en esta institución' };
      }

      // Verificar que el número de matrícula no esté duplicado en esa institución
      const matriculaExists = await MemberService.existsByNumeroMatricula(memberData.numeroMatricula, institutionId);
      if (matriculaExists) {
        return { success: false, message: 'El número de matrícula ya existe en esta institución' };
      }

      await MemberService.create(memberData);

      return { success: true, message: 'Miembro creado exitosamente' };
    } catch (err) {
      console.error('Error al crear miembro:', err);
      return { success: false, message: 'Error al crear miembro' };
    }
  },

  // Actualizar miembro
  updateMember: async ({ request, locals }) => {
    // FINANZAS no puede actualizar miembros (solo lectura)
    if (locals.user?.role === 'FINANZAS') {
      return { success: false, message: 'No tiene permisos para actualizar miembros' };
    }

    try {
      const formData = await request.formData();
      const memberId = formData.get('id') as string;
      const institutionId = formData.get('institutionId') as string;

      if (!memberId) {
        return { success: false, message: 'ID de miembro requerido' };
      }

      // Validar que usuarios LIQUIDADOR solo puedan actualizar miembros de sus instituciones
      if (locals.user?.role === 'LIQUIDADOR') {
        if (!hasAccessToInstitution(locals.user, institutionId)) {
          return { success: false, message: 'No tiene permiso para modificar miembros de esta institución' };
        }
      }

      const memberData = {
        fullName: formData.get('fullName') as string,
        email: (formData.get('email') as string) || undefined,
        phone: (formData.get('phone') as string) || undefined,
        numeroOrden: formData.get('numeroOrden') as string,
        numeroMatricula: formData.get('numeroMatricula') as string,
        documentoIdentidad: formData.get('documentoIdentidad') as string,
        membershipStartDate: new Date(formData.get('membershipStartDate') as string),
        status: (formData.get('status') as 'active' | 'inactive') || 'active'
      };

      // Validar campos requeridos
      if (!memberData.fullName || !memberData.documentoIdentidad ||
          !memberData.numeroOrden || !memberData.numeroMatricula) {
        return { success: false, message: 'Todos los campos obligatorios deben ser completados' };
      }

      // Verificar duplicados excluyendo el miembro actual
      const ordenExists = await MemberService.existsByNumeroOrden(memberData.numeroOrden, institutionId, memberId);
      if (ordenExists) {
        return { success: false, message: 'El número de orden ya existe en esta institución' };
      }

      const matriculaExists = await MemberService.existsByNumeroMatricula(memberData.numeroMatricula, institutionId, memberId);
      if (matriculaExists) {
        return { success: false, message: 'El número de matrícula ya existe en esta institución' };
      }

      await MemberService.update(memberId, memberData);

      return { success: true, message: 'Miembro actualizado exitosamente' };
    } catch (err) {
      console.error('Error al actualizar miembro:', err);
      return { success: false, message: 'Error al actualizar miembro' };
    }
  },

  // Eliminar miembro
  deleteMember: async ({ request, locals }) => {
    // FINANZAS no puede eliminar miembros (solo lectura)
    if (locals.user?.role === 'FINANZAS') {
      return { success: false, message: 'No tiene permisos para eliminar miembros' };
    }

    try {
      const formData = await request.formData();
      const memberId = formData.get('id') as string;
      const institutionId = formData.get('institutionId') as string;

      if (!memberId) {
        return { success: false, message: 'ID de miembro requerido' };
      }

      // Validar que usuarios LIQUIDADOR solo puedan eliminar miembros de sus instituciones
      if (locals.user?.role === 'LIQUIDADOR') {
        if (!hasAccessToInstitution(locals.user, institutionId)) {
          return { success: false, message: 'No tiene permiso para eliminar miembros de esta institución' };
        }
      }

      await MemberService.delete(memberId);

      return { success: true, message: 'Miembro eliminado exitosamente' };
    } catch (err) {
      console.error('Error al eliminar miembro:', err);
      return { success: false, message: 'Error al eliminar miembro' };
    }
  }
};
