import { UserService } from '$lib/db/services/userService';
import type { UserFilters, PaginationParams } from '$lib/db/models';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ url }: { url: URL }) => {
  try {
    // Obtener parámetros de la URL
    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') as any || undefined;
    const isActive = searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined;
    const institutionId = searchParams.get('institutionId') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    // Construir filtros
    const filters: UserFilters = {
      search,
      role,
      isActive,
      institutionId
    };

    // Construir paginación
    const pagination: PaginationParams = {
      page,
      limit,
      sortBy,
      sortOrder
    };

    // Obtener usuarios
    const result = await UserService.findMany(filters, pagination);
    console.log(result);
    return {
      users: result.data,
      pagination: {
        currentPage: result.meta.currentPage,
        totalPages: result.meta.lastPage,
        totalItems: result.meta.total,
        itemsPerPage: result.meta.perPage
      },
      filters
    };
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    return {
      users: [],
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
  create: async ({ request }: { request: Request }) => {
    try {
      const formData = await request.formData();
      
      const name = formData.get('name') as string;
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const confirmPassword = formData.get('confirmPassword') as string;
      const institutionId = formData.get('institutionId') as string;
      const role = formData.get('role') as any;
      const isActive = formData.get('isActive') === 'true';

      // Validaciones básicas
      if (!email?.trim()) {
        return fail(400, { error: 'El email es requerido' });
      }

      if (!password?.trim()) {
        return fail(400, { error: 'La contraseña es requerida' });
      }

      if (password !== confirmPassword) {
        return fail(400, { error: 'Las contraseñas no coinciden' });
      }

      // Verificar si el email ya existe
      const emailExists = await UserService.existsByEmail(email);
      if (emailExists) {
        return fail(400, { error: 'Ya existe un usuario con este email' });
      }

      // Crear el usuario
      const user = await UserService.create({
        name: name?.trim() || undefined,
        email: email.trim(),
        password: password,
        institutionId: institutionId?.trim() || undefined,
        role: role || 'INTITUTION',
        isActive
      });

      return { success: true, user };
    } catch (error) {
      console.error('Error al crear usuario:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  },

  update: async ({ request }: { request: Request }) => {
    try {
      const formData = await request.formData();
      
      const id = formData.get('id') as string;
      const name = formData.get('name') as string;
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const institutionId = formData.get('institutionId') as string;
      const role = formData.get('role') as any;
      const isActive = formData.get('isActive') === 'true';

      if (!id) {
        return fail(400, { error: 'ID de usuario requerido' });
      }

      if (!email?.trim()) {
        return fail(400, { error: 'El email es requerido' });
      }

      // Verificar si el email ya existe (excluyendo el usuario actual)
      const emailExists = await UserService.existsByEmail(email, id);
      if (emailExists) {
        return fail(400, { error: 'Ya existe otro usuario con este email' });
      }

      // Preparar datos de actualización
      const updateData: any = {
        name: name?.trim() || null,
        email: email.trim(),
        institutionId: institutionId?.trim() || null,
        role: role || 'INTITUTION',
        isActive
      };

      // Solo actualizar contraseña si se proporciona
      if (password?.trim()) {
        updateData.password = password;
      }

      // Actualizar el usuario
      const user = await UserService.update(id, updateData);

      return { success: true, user };
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  },

  delete: async ({ request }: { request: Request }) => {
    try {
      const formData = await request.formData();
      const id = formData.get('id') as string;

      if (!id) {
        return fail(400, { error: 'ID de usuario requerido' });
      }

      await UserService.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  }
};
