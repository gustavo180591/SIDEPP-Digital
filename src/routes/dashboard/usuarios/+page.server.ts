import { UserService } from '$lib/db/services/userService';
import { InstitutionService } from '$lib/db/services/institutionService';
import type { UserFilters, PaginationParams } from '$lib/db/models';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ url, locals }: { url: URL; locals: any }) => {
  // Validar que el usuario esté autenticado
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  // Validar que sea ADMIN (solo admins pueden ver usuarios)
  if (locals.user.role !== 'ADMIN') {
    throw redirect(303, '/unauthorized');
  }

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

    // Obtener instituciones para el dropdown
    const institutionsResult = await InstitutionService.findMany({}, { page: 1, limit: 100 });

    return {
      users: result.data,
      institutions: institutionsResult.data,
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

// Funciones de validación
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['ADMIN', 'FINANZAS', 'LIQUIDADOR'];

function validateEmail(email: string): string | null {
  if (!email?.trim()) return 'El email es requerido';
  if (!EMAIL_REGEX.test(email.trim())) return 'El formato del email no es válido';
  return null;
}

function validatePassword(password: string, isRequired: boolean = true): string | null {
  if (!password?.trim()) {
    return isRequired ? 'La contraseña es requerida' : null;
  }
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula';
  if (!/[a-z]/.test(password)) return 'La contraseña debe contener al menos una minúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número';
  return null;
}

function validateName(name: string): string | null {
  if (!name?.trim()) return 'El nombre es requerido';
  if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
  if (name.trim().length > 100) return 'El nombre no puede exceder 100 caracteres';
  return null;
}

export const actions: Actions = {
  create: async ({ request }: { request: Request }) => {
    try {
      const formData = await request.formData();

      const name = formData.get('name') as string;
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const confirmPassword = formData.get('confirmPassword') as string;
      const institutionIds = formData.getAll('institutionIds') as string[];
      const role = formData.get('role') as string;
      const isActive = formData.get('isActive') === 'true';

      // Validaciones
      const nameError = validateName(name);
      if (nameError) return fail(400, { error: nameError });

      const emailError = validateEmail(email);
      if (emailError) return fail(400, { error: emailError });

      const passwordError = validatePassword(password);
      if (passwordError) return fail(400, { error: passwordError });

      if (password !== confirmPassword) {
        return fail(400, { error: 'Las contraseñas no coinciden' });
      }

      // Validar rol
      if (role && !VALID_ROLES.includes(role)) {
        return fail(400, { error: 'Rol no válido' });
      }

      // Verificar si el email ya existe
      const emailExists = await UserService.existsByEmail(email);
      if (emailExists) {
        return fail(400, { error: 'Ya existe un usuario con este email' });
      }

      // Validar que todas las instituciones seleccionadas existan
      const filteredInstitutionIds = institutionIds.filter(id => id.trim());
      if (filteredInstitutionIds.length > 0) {
        const allInstitutions = await InstitutionService.findMany({}, { page: 1, limit: 100 });
        const validIds = new Set(allInstitutions.data.map((i: any) => i.id));
        const invalidIds = filteredInstitutionIds.filter(id => !validIds.has(id));
        if (invalidIds.length > 0) {
          return fail(400, { error: 'Una o más instituciones seleccionadas no existen' });
        }
      }

      // Crear el usuario con múltiples instituciones
      const user = await UserService.create({
        name: name.trim(),
        email: email.trim(),
        password: password,
        institutionIds: filteredInstitutionIds,
        role: (role as 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR') || 'LIQUIDADOR',
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
      const institutionIds = formData.getAll('institutionIds') as string[];
      const role = formData.get('role') as string;
      const isActive = formData.get('isActive') === 'true';

      if (!id) {
        return fail(400, { error: 'ID de usuario requerido' });
      }

      // Validaciones
      const nameError = validateName(name);
      if (nameError) return fail(400, { error: nameError });

      const emailError = validateEmail(email);
      if (emailError) return fail(400, { error: emailError });

      // Validar password solo si se proporciona (no es required en update)
      if (password?.trim()) {
        const passwordError = validatePassword(password, false);
        if (passwordError) return fail(400, { error: passwordError });
      }

      // Validar rol
      if (role && !VALID_ROLES.includes(role)) {
        return fail(400, { error: 'Rol no válido' });
      }

      // Verificar si el email ya existe (excluyendo el usuario actual)
      const emailExists = await UserService.existsByEmail(email, id);
      if (emailExists) {
        return fail(400, { error: 'Ya existe otro usuario con este email' });
      }

      // Validar que todas las instituciones seleccionadas existan
      const filteredInstitutionIds = institutionIds.filter(id => id.trim());
      if (filteredInstitutionIds.length > 0) {
        const allInstitutions = await InstitutionService.findMany({}, { page: 1, limit: 100 });
        const validIds = new Set(allInstitutions.data.map((i: any) => i.id));
        const invalidIds = filteredInstitutionIds.filter(id => !validIds.has(id));
        if (invalidIds.length > 0) {
          return fail(400, { error: 'Una o más instituciones seleccionadas no existen' });
        }
      }

      // Preparar datos de actualización con múltiples instituciones
      const updateData: {
        name: string;
        email: string;
        institutionIds: string[];
        role: 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR';
        isActive: boolean;
        password?: string;
      } = {
        name: name.trim(),
        email: email.trim(),
        institutionIds: filteredInstitutionIds,
        role: (role as 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR') || 'LIQUIDADOR',
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
  },

  toggleActive: async ({ request }: { request: Request }) => {
    try {
      const formData = await request.formData();
      const id = formData.get('id') as string;

      if (!id) {
        return fail(400, { error: 'ID de usuario requerido' });
      }

      const user = await UserService.toggleActive(id);
      return { success: true, user };
    } catch (error) {
      console.error('Error al cambiar estado del usuario:', error);
      return fail(500, { error: 'Error interno del servidor' });
    }
  }
};
