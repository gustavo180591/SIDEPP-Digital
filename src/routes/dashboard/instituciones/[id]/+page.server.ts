import { error, redirect } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import { MemberService } from '$lib/db/services/memberService';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
  // Validar que el usuario esté autenticado
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const institutionId = params.id;

  if (!institutionId) {
    throw error(400, 'ID de institución requerido');
  }

  // Validar que usuarios INTITUTION solo puedan acceder a su propia institución
  if (locals.user.role === 'INTITUTION') {
    if (!locals.user.institutionId) {
      throw error(403, 'Usuario sin institución asignada');
    }
    if (institutionId !== locals.user.institutionId) {
      throw error(403, 'No tiene permiso para ver esta institución');
    }
  }

  try {
    // Obtener los datos de la institución
    const institution = await InstitutionService.getById(institutionId);
    
    if (!institution) {
      throw error(404, 'Institución no encontrada');
    }

    // Obtener parámetros de búsqueda y paginación
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Obtener los miembros de la institución con filtros
    const members = await InstitutionService.getMembers(institutionId, {
      search,
      page,
      limit
    });

    return {
      institution,
      members: members.data ? members.data : [],
      pagination: {
        currentPage: members.meta.currentPage,
        totalPages: members.meta.lastPage,
        totalItems: members.meta.total,
        itemsPerPage: members.meta.perPage
      },
      search
    };
  } catch (err) {
    console.error('Error al cargar institución:', err);
    throw error(500, 'Error interno del servidor');
  }
};

export const actions: Actions = {
  // Crear miembro
  createMember: async ({ request, params, locals }) => {
    const institutionId = params.id;

    if (!institutionId) {
      throw error(400, 'ID de institución requerido');
    }

    // Validar que usuarios INTITUTION solo puedan crear miembros en su institución
    if (locals.user?.role === 'INTITUTION') {
      if (!locals.user.institutionId) {
        throw error(403, 'Usuario sin institución asignada');
      }
      if (institutionId !== locals.user.institutionId) {
        throw error(403, 'No tiene permiso para modificar esta institución');
      }
    }

    try {
      const formData = await request.formData();
      
      const memberData = {
        fullName: formData.get('fullName') as string,
        email: formData.get('email') as string,
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

      // Verificar que el número de orden no esté duplicado
      const ordenExists = await MemberService.existsByNumeroOrden(memberData.numeroOrden, institutionId);
      if (ordenExists) {
        return { success: false, message: 'El número de orden ya existe en esta institución' };
      }

      // Verificar que el número de matrícula no esté duplicado
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
  updateMember: async ({ request, params, locals }) => {
    const institutionId = params.id;

    if (!institutionId) {
      throw error(400, 'ID de institución requerido');
    }

    // Validar que usuarios INTITUTION solo puedan actualizar miembros de su institución
    if (locals.user?.role === 'INTITUTION') {
      if (!locals.user.institutionId) {
        throw error(403, 'Usuario sin institución asignada');
      }
      if (institutionId !== locals.user.institutionId) {
        throw error(403, 'No tiene permiso para modificar esta institución');
      }
    }

    try {
      const formData = await request.formData();
      const memberId = formData.get('id') as string;

      if (!memberId) {
        return { success: false, message: 'ID de miembro requerido' };
      }

      // Obtener el miembro actual para preservar el fullName original
      const currentMember = await MemberService.findById(memberId);
      if (!currentMember) {
        return { success: false, message: 'Miembro no encontrado' };
      }

      const memberData = {
        fullName: currentMember.fullName, // Preservar el nombre original (no editable)
        email: formData.get('email') as string,
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

      // Verificar que el número de orden no esté duplicado (excluyendo el miembro actual)
      const ordenExists = await MemberService.existsByNumeroOrden(memberData.numeroOrden, institutionId, memberId);
      if (ordenExists) {
        return { success: false, message: 'El número de orden ya existe en esta institución' };
      }

      // Verificar que el número de matrícula no esté duplicado (excluyendo el miembro actual)
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
  deleteMember: async ({ request, params, locals }) => {
    const institutionId = params.id;

    if (!institutionId) {
      throw error(400, 'ID de institución requerido');
    }

    // Validar que usuarios INTITUTION solo puedan eliminar miembros de su institución
    if (locals.user?.role === 'INTITUTION') {
      if (!locals.user.institutionId) {
        throw error(403, 'Usuario sin institución asignada');
      }
      if (institutionId !== locals.user.institutionId) {
        throw error(403, 'No tiene permiso para modificar esta institución');
      }
    }

    try{
      const formData = await request.formData();
      const memberId = formData.get('id') as string;
      
      if (!memberId) {
        return { success: false, message: 'ID de miembro requerido' };
      }

      await MemberService.delete(memberId);
      
      return { success: true, message: 'Miembro eliminado exitosamente' };
    } catch (err) {
      console.error('Error al eliminar miembro:', err);
      return { success: false, message: 'Error al eliminar miembro' };
    }
  },

  // Actualizar institución
  update: async ({ request, params, locals }) => {
    const institutionId = params.id;

    if (!institutionId) {
      throw error(400, 'ID de institución requerido');
    }

    // Validar que usuarios INTITUTION solo puedan actualizar su propia institución
    if (locals.user?.role === 'INTITUTION') {
      if (!locals.user.institutionId) {
        throw error(403, 'Usuario sin institución asignada');
      }
      if (institutionId !== locals.user.institutionId) {
        throw error(403, 'No tiene permiso para modificar esta institución');
      }
    }

    try {
      const formData = await request.formData();
      const institutionData = {
        name: formData.get('name') as string,
        cuit: formData.get('cuit') as string,
        city: formData.get('city') as string,
        state: formData.get('state') as string,
        responsibleName: formData.get('responsibleName') as string,
        responsibleEmail: formData.get('responsibleEmail') as string
      };

      await InstitutionService.update(institutionId, institutionData);
      
      return { success: true, message: 'Institución actualizada exitosamente' };
    } catch (err) {
      console.error('Error al actualizar institución:', err);
      return { success: false, message: 'Error al actualizar institución' };
    }
  },

  // Eliminar institución
  delete: async ({ params }) => {
    const institutionId = params.id;
    
    if (!institutionId) {
      throw error(400, 'ID de institución requerido');
    }

    try {
      await InstitutionService.delete(institutionId);
      throw redirect(302, '/instituciones');
    } catch (err) {
      console.error('Error al eliminar institución:', err);
      return { success: false, message: 'Error al eliminar institución' };
    }
  }
};
