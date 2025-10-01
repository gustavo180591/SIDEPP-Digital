import { InstitutionService } from '$lib/db/services/institutionService';
import type { InstitutionFilters, PaginationParams } from '$lib/db/models';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ url }: { url: URL }) => {
  try {
    // Obtener parámetros de la URL
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
    console.log(result);
    return {
      institutions: result.data,
      pagination: {
        page: result.meta.currentPage,
        limit: result.meta.perPage,
        total: result.meta.total,
        totalPages: result.meta.lastPage,
        hasNext: result.meta.next !== null,
        hasPrev: result.meta.prev !== null
      },
      filters
    };
  } catch (error) {
    console.error('Error al cargar instituciones:', error);
    return {
      institutions: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      filters: {}
    };
  }
};

export const actions: Actions = {
  create: async ({ request }: { request: Request }) => {
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

      // Validaciones básicas
      if (!name?.trim()) {
        return fail(400, { error: 'El nombre es requerido' });
      }

      // Verificar si el CUIT ya existe
      if (cuit) {
        const cuitExists = await InstitutionService.existsByCuit(cuit);
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

  update: async ({ request }: { request: Request }) => {
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

      if (!name?.trim()) {
        return fail(400, { error: 'El nombre es requerido' });
      }

      // Verificar si el CUIT ya existe (excluyendo la institución actual)
      if (cuit) {
        const cuitExists = await InstitutionService.existsByCuit(cuit, id);
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

  delete: async ({ request }: { request: Request }) => {
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
