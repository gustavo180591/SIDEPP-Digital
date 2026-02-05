import { InstitutionService } from '$lib/db/services/institutionService';
import type { InstitutionFilters, PaginationParams } from '$lib/db/models';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';

// Funciones de validación
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+()]{7,20}$/;

function validateCUIT(cuit: string): string | null {
  if (!cuit?.trim()) return null; // CUIT es opcional
  const cleanCuit = cuit.replace(/[-\s]/g, '');
  if (!/^\d{11}$/.test(cleanCuit)) {
    return 'El CUIT debe tener 11 dígitos';
  }
  // Validar prefijo (20, 23, 24, 27, 30, 33, 34)
  const prefix = cleanCuit.substring(0, 2);
  const validPrefixes = ['20', '23', '24', '27', '30', '33', '34'];
  if (!validPrefixes.includes(prefix)) {
    return 'El prefijo del CUIT no es válido';
  }
  // Validar dígito verificador
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCuit[i]) * multipliers[i];
  }
  const remainder = sum % 11;
  const verifier = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  if (parseInt(cleanCuit[10]) !== verifier) {
    return 'El dígito verificador del CUIT no es válido';
  }
  return null;
}

function validateEmail(email: string, isRequired: boolean = false): string | null {
  if (!email?.trim()) return isRequired ? 'El email es requerido' : null;
  if (!EMAIL_REGEX.test(email.trim())) return 'El formato del email no es válido';
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone?.trim()) return null; // Teléfono es opcional
  if (!PHONE_REGEX.test(phone.trim())) return 'El formato del teléfono no es válido';
  return null;
}

export const load: ServerLoad = async ({ url, locals }: { url: URL; locals: any }) => {
  // Validar que el usuario esté autenticado
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  // Validar rol: ADMIN, FINANZAS o LIQUIDADOR
  if (locals.user.role !== 'ADMIN' && locals.user.role !== 'FINANZAS' && locals.user.role !== 'LIQUIDADOR') {
    throw redirect(303, '/unauthorized');
  }

  try {
    // Si es LIQUIDADOR, devolver solo sus instituciones asignadas
    if (locals.user.role === 'LIQUIDADOR') {
      const userInstitutions = locals.user.institutions || [];
      return {
        institutions: userInstitutions,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: userInstitutions.length,
          itemsPerPage: userInstitutions.length
        },
        filters: {}
      };
    }

    // Para ADMIN y FINANZAS: obtener todas las instituciones con filtros
    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || undefined;
    const city = searchParams.get('city') || undefined;
    const state = searchParams.get('state') || undefined;
    const country = searchParams.get('country') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    // Construir filtros
    const filters: InstitutionFilters = {
      search,
      city,
      state,
      country
    };

    // Construir paginación
    const pagination: PaginationParams = {
      page,
      limit,
      sortBy,
      sortOrder
    };

    // Obtener instituciones
    const result = await InstitutionService.findMany(filters, pagination);
    return {
      institutions: result.data,
      pagination: {
        currentPage: result.meta.currentPage,
        totalPages: result.meta.lastPage,
        totalItems: result.meta.total,
        itemsPerPage: result.meta.perPage
      },
      filters
    };
  } catch (error) {
    console.error('Error al cargar instituciones:', error);
    return {
      institutions: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: 10
      },
      filters: {}
    };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }: { request: Request; locals: any }) => {
    // Solo ADMIN puede crear instituciones
    if (locals.user?.role !== 'ADMIN') {
      return fail(403, { error: 'No tiene permisos para crear instituciones' });
    }

    try {
      const formData = await request.formData();

      const name = formData.get('name') as string;
      const cuit = formData.get('cuit') as string;
      const address = formData.get('address') as string;
      const city = formData.get('city') as string;
      const state = formData.get('state') as string;
      const country = formData.get('country') as string;
      const responsibleName = formData.get('responsibleName') as string;
      const responsibleEmail = formData.get('responsibleEmail') as string;
      const responsablePhone = formData.get('responsablePhone') as string;

      // Validaciones
      if (!name?.trim()) {
        return fail(400, { error: 'El nombre es requerido' });
      }
      if (name.trim().length < 2) {
        return fail(400, { error: 'El nombre debe tener al menos 2 caracteres' });
      }

      // Validar CUIT
      const cuitError = validateCUIT(cuit);
      if (cuitError) return fail(400, { error: cuitError });

      // Validar email del responsable
      const emailError = validateEmail(responsibleEmail);
      if (emailError) return fail(400, { error: emailError });

      // Validar teléfono del responsable
      const phoneError = validatePhone(responsablePhone);
      if (phoneError) return fail(400, { error: phoneError });

      // Verificar si el CUIT ya existe
      if (cuit?.trim()) {
        const cuitExists = await InstitutionService.existsByCuit(cuit.trim());
        if (cuitExists) {
          return fail(400, { error: 'Ya existe una institución con este CUIT' });
        }
      }

      // Crear la institución
      const institution = await InstitutionService.create({
        name: name.trim(),
        cuit: cuit?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || 'Argentina',
        responsibleName: responsibleName?.trim() || null,
        responsibleEmail: responsibleEmail?.trim() || null,
        responsablePhone: responsablePhone?.trim() || null
      });

      return { success: true, institution };
    } catch (error) {
      console.error('Error al crear institución:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  },

  update: async ({ request, locals }: { request: Request; locals: any }) => {
    // Solo ADMIN puede actualizar instituciones
    if (locals.user?.role !== 'ADMIN') {
      return fail(403, { error: 'No tiene permisos para actualizar instituciones' });
    }

    try {
      const formData = await request.formData();

      const id = formData.get('id') as string;
      const name = formData.get('name') as string;
      const cuit = formData.get('cuit') as string;
      const address = formData.get('address') as string;
      const city = formData.get('city') as string;
      const state = formData.get('state') as string;
      const country = formData.get('country') as string;
      const responsibleName = formData.get('responsibleName') as string;
      const responsibleEmail = formData.get('responsibleEmail') as string;
      const responsablePhone = formData.get('responsablePhone') as string;

      if (!id) {
        return fail(400, { error: 'ID de institución requerido' });
      }

      // Validaciones
      if (!name?.trim()) {
        return fail(400, { error: 'El nombre es requerido' });
      }
      if (name.trim().length < 2) {
        return fail(400, { error: 'El nombre debe tener al menos 2 caracteres' });
      }

      // Validar CUIT
      const cuitError = validateCUIT(cuit);
      if (cuitError) return fail(400, { error: cuitError });

      // Validar email del responsable
      const emailError = validateEmail(responsibleEmail);
      if (emailError) return fail(400, { error: emailError });

      // Validar teléfono del responsable
      const phoneError = validatePhone(responsablePhone);
      if (phoneError) return fail(400, { error: phoneError });

      // Verificar si el CUIT ya existe (excluyendo la institución actual)
      if (cuit?.trim()) {
        const cuitExists = await InstitutionService.existsByCuit(cuit.trim(), id);
        if (cuitExists) {
          return fail(400, { error: 'Ya existe otra institución con este CUIT' });
        }
      }

      // Actualizar la institución
      const institution = await InstitutionService.update(id, {
        name: name.trim(),
        cuit: cuit?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || 'Argentina',
        responsibleName: responsibleName?.trim() || null,
        responsibleEmail: responsibleEmail?.trim() || null,
        responsablePhone: responsablePhone?.trim() || null
      });

      return { success: true, institution };
    } catch (error) {
      console.error('Error al actualizar institución:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  },

  delete: async ({ request, locals }: { request: Request; locals: any }) => {
    // Solo ADMIN puede eliminar instituciones
    if (locals.user?.role !== 'ADMIN') {
      return fail(403, { error: 'No tiene permisos para eliminar instituciones' });
    }

    try {
      const formData = await request.formData();
      const id = formData.get('id') as string;

      if (!id) {
        return fail(400, { error: 'ID de institución requerido' });
      }

      await InstitutionService.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Error al eliminar institución:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  }
};
