import { error, redirect } from '@sveltejs/kit';
import { InstitutionService } from '$lib/db/services/institutionService';
import { MemberService } from '$lib/db/services/memberService';
import type { PageServerLoad, Actions } from './$types';

// Funciones de validación
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+()]{7,20}$/;

function validateEmail(email: string): string | null {
  if (!email?.trim()) return null; // Email es opcional
  if (!EMAIL_REGEX.test(email.trim())) return 'El formato del email no es válido';
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone?.trim()) return null; // Teléfono es opcional
  if (!PHONE_REGEX.test(phone.trim())) return 'El formato del teléfono no es válido';
  return null;
}

function validateNumero(value: string, fieldName: string): string | null {
  if (!value?.trim()) return `${fieldName} es requerido`;
  if (!/^\d+$/.test(value.trim())) return `${fieldName} debe contener solo números`;
  if (value.trim().length > 20) return `${fieldName} es demasiado largo`;
  return null;
}

function validateDate(dateStr: string, fieldName: string): string | null {
  if (!dateStr?.trim()) return `${fieldName} es requerida`;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return `${fieldName} no es una fecha válida`;
  // Validar que no sea una fecha futura
  if (date > new Date()) return `${fieldName} no puede ser una fecha futura`;
  // Validar que no sea antes de 1900
  if (date.getFullYear() < 1900) return `${fieldName} no puede ser antes de 1900`;
  return null;
}

// Helper para verificar acceso a institución
function hasAccessToInstitution(user: App.Locals['user'], institutionId: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'FINANZAS') return true;
  // LIQUIDADOR solo puede acceder a sus instituciones asignadas
  return user.institutions?.some(inst => inst.id === institutionId) || false;
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
  // Validar que el usuario esté autenticado
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const institutionId = params.id;

  if (!institutionId) {
    throw error(400, 'ID de institución requerido');
  }

  // Validar que usuarios LIQUIDADOR solo puedan acceder a sus instituciones asignadas
  if (locals.user.role === 'LIQUIDADOR') {
    if (!locals.user.institutions || locals.user.institutions.length === 0) {
      throw error(403, 'Usuario sin institución asignada');
    }
    if (!hasAccessToInstitution(locals.user, institutionId)) {
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

    // FINANZAS no puede crear miembros (solo lectura)
    if (locals.user?.role === 'FINANZAS') {
      return { success: false, message: 'No tiene permisos para crear miembros' };
    }

    // Validar que usuarios LIQUIDADOR solo puedan crear miembros en sus instituciones
    if (locals.user?.role === 'LIQUIDADOR') {
      if (!hasAccessToInstitution(locals.user, institutionId)) {
        throw error(403, 'No tiene permiso para modificar esta institución');
      }
    }

    try {
      const formData = await request.formData();

      const fullName = formData.get('fullName') as string;
      const email = formData.get('email') as string;
      const phone = formData.get('phone') as string;
      const numeroOrden = formData.get('numeroOrden') as string;
      const numeroMatricula = formData.get('numeroMatricula') as string;
      const documentoIdentidad = formData.get('documentoIdentidad') as string;
      const membershipStartDateStr = formData.get('membershipStartDate') as string;
      const status = (formData.get('status') as 'active' | 'inactive') || 'active';

      // Validaciones
      if (!fullName?.trim()) {
        return { success: false, message: 'El nombre completo es requerido' };
      }
      if (fullName.trim().length < 2) {
        return { success: false, message: 'El nombre debe tener al menos 2 caracteres' };
      }

      if (!documentoIdentidad?.trim()) {
        return { success: false, message: 'El documento de identidad es requerido' };
      }

      // Validar email si se proporciona
      const emailError = validateEmail(email);
      if (emailError) return { success: false, message: emailError };

      // Validar teléfono si se proporciona
      const phoneError = validatePhone(phone);
      if (phoneError) return { success: false, message: phoneError };

      // Validar números de orden y matrícula
      const ordenError = validateNumero(numeroOrden, 'Número de orden');
      if (ordenError) return { success: false, message: ordenError };

      const matriculaError = validateNumero(numeroMatricula, 'Número de matrícula');
      if (matriculaError) return { success: false, message: matriculaError };

      // Validar fecha de inicio de membresía
      const dateError = validateDate(membershipStartDateStr, 'Fecha de inicio de membresía');
      if (dateError) return { success: false, message: dateError };

      // Verificar que el número de orden no esté duplicado
      const ordenExists = await MemberService.existsByNumeroOrden(numeroOrden.trim(), institutionId);
      if (ordenExists) {
        return { success: false, message: 'El número de orden ya existe en esta institución' };
      }

      // Verificar que el número de matrícula no esté duplicado
      const matriculaExists = await MemberService.existsByNumeroMatricula(numeroMatricula.trim(), institutionId);
      if (matriculaExists) {
        return { success: false, message: 'El número de matrícula ya existe en esta institución' };
      }

      await MemberService.create({
        fullName: fullName.trim(),
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
        numeroOrden: numeroOrden.trim(),
        numeroMatricula: numeroMatricula.trim(),
        documentoIdentidad: documentoIdentidad.trim(),
        membershipStartDate: new Date(membershipStartDateStr),
        status,
        institucionId: institutionId
      });

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

    // FINANZAS no puede actualizar miembros (solo lectura)
    if (locals.user?.role === 'FINANZAS') {
      return { success: false, message: 'No tiene permisos para actualizar miembros' };
    }

    // Validar que usuarios LIQUIDADOR solo puedan actualizar miembros de sus instituciones
    if (locals.user?.role === 'LIQUIDADOR') {
      if (!hasAccessToInstitution(locals.user, institutionId)) {
        throw error(403, 'No tiene permiso para modificar esta institución');
      }
    }

    try {
      const formData = await request.formData();
      const memberId = formData.get('id') as string;

      if (!memberId) {
        return { success: false, message: 'ID de miembro requerido' };
      }

      const fullName = formData.get('fullName') as string;
      const email = formData.get('email') as string;
      const phone = formData.get('phone') as string;
      const numeroOrden = formData.get('numeroOrden') as string;
      const numeroMatricula = formData.get('numeroMatricula') as string;
      const documentoIdentidad = formData.get('documentoIdentidad') as string;
      const membershipStartDateStr = formData.get('membershipStartDate') as string;
      const status = (formData.get('status') as 'active' | 'inactive') || 'active';

      // Validaciones
      if (!fullName?.trim()) {
        return { success: false, message: 'El nombre completo es requerido' };
      }
      if (fullName.trim().length < 2) {
        return { success: false, message: 'El nombre debe tener al menos 2 caracteres' };
      }

      if (!documentoIdentidad?.trim()) {
        return { success: false, message: 'El documento de identidad es requerido' };
      }

      // Validar email si se proporciona
      const emailError = validateEmail(email);
      if (emailError) return { success: false, message: emailError };

      // Validar teléfono si se proporciona
      const phoneError = validatePhone(phone);
      if (phoneError) return { success: false, message: phoneError };

      // Validar números de orden y matrícula
      const ordenError = validateNumero(numeroOrden, 'Número de orden');
      if (ordenError) return { success: false, message: ordenError };

      const matriculaError = validateNumero(numeroMatricula, 'Número de matrícula');
      if (matriculaError) return { success: false, message: matriculaError };

      // Validar fecha de inicio de membresía
      const dateError = validateDate(membershipStartDateStr, 'Fecha de inicio de membresía');
      if (dateError) return { success: false, message: dateError };

      // Verificar que el número de orden no esté duplicado (excluyendo el miembro actual)
      const ordenExists = await MemberService.existsByNumeroOrden(numeroOrden.trim(), institutionId, memberId);
      if (ordenExists) {
        return { success: false, message: 'El número de orden ya existe en esta institución' };
      }

      // Verificar que el número de matrícula no esté duplicado (excluyendo el miembro actual)
      const matriculaExists = await MemberService.existsByNumeroMatricula(numeroMatricula.trim(), institutionId, memberId);
      if (matriculaExists) {
        return { success: false, message: 'El número de matrícula ya existe en esta institución' };
      }

      await MemberService.update(memberId, {
        fullName: fullName.trim(),
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
        numeroOrden: numeroOrden.trim(),
        numeroMatricula: numeroMatricula.trim(),
        documentoIdentidad: documentoIdentidad.trim(),
        membershipStartDate: new Date(membershipStartDateStr),
        status
      });

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

    // FINANZAS no puede eliminar miembros (solo lectura)
    if (locals.user?.role === 'FINANZAS') {
      return { success: false, message: 'No tiene permisos para eliminar miembros' };
    }

    // Validar que usuarios LIQUIDADOR solo puedan eliminar miembros de sus instituciones
    if (locals.user?.role === 'LIQUIDADOR') {
      if (!hasAccessToInstitution(locals.user, institutionId)) {
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

    // Solo ADMIN puede actualizar instituciones
    if (locals.user?.role !== 'ADMIN') {
      return { success: false, message: 'No tiene permisos para actualizar instituciones' };
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
  delete: async ({ params, locals }) => {
    const institutionId = params.id;

    if (!institutionId) {
      throw error(400, 'ID de institución requerido');
    }

    // Solo ADMIN puede eliminar instituciones
    if (locals.user?.role !== 'ADMIN') {
      return { success: false, message: 'No tiene permisos para eliminar instituciones' };
    }

    try {
      await InstitutionService.delete(institutionId);
      throw redirect(302, '/dashboard/instituciones');
    } catch (err) {
      // Si es un redirect, re-lanzarlo
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 302) {
        throw err;
      }
      console.error('Error al eliminar institución:', err);
      return { success: false, message: 'Error al eliminar institución' };
    }
  }
};
