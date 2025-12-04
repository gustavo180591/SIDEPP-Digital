import type { User, UserRole, Institution, UserInstitution } from '@prisma/client';

// Tipos para crear usuario
export type CreateUserData = {
  email: string;
  name?: string;
  password: string;
  institutionId?: string;       // Para compatibilidad (single)
  institutionIds?: string[];    // Para N:N (multiple)
  role?: UserRole;
  isActive?: boolean;
};

// Tipos para actualizar usuario
export type UpdateUserData = Partial<Omit<CreateUserData, 'password'>> & {
  password?: string;
};

// Tipo para usuario con relaciones (N:N)
export type UserWithRelations = User & {
  userInstitutions: (UserInstitution & {
    institution: Institution;
  })[];
};

// Tipo para lista de usuarios (sin datos sensibles)
export type UserListItem = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userInstitutions: {
    institution: {
      id: string;
      name: string | null;
    };
  }[];
};

// Filtros para búsqueda de usuarios
export type UserFilters = {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  institutionId?: string;
};

// Parámetros de paginación
export type PaginationParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
