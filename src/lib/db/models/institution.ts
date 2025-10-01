import type { Institution, Member, User, PayrollPeriod } from '@prisma/client';

// Tipo base para Institution
export type InstitutionBase = {
  name: string;
  cuit?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  responsibleName?: string | null;
  responsibleEmail?: string | null;
  responsablePhone?: string | null;
};

// Tipo para crear una nueva institución
export type CreateInstitutionData = InstitutionBase;

// Tipo para actualizar una institución
export type UpdateInstitutionData = Partial<InstitutionBase>;

// Tipo para Institution con relaciones
export type InstitutionWithRelations = Institution & {
  members?: Member[];
  users?: User[];
  payrollPeriods?: PayrollPeriod[];
};

// Tipo para Institution sin relaciones (para listados)
export type InstitutionListItem = Pick<
  Institution,
  | 'id'
  | 'name'
  | 'cuit'
  | 'city'
  | 'state'
  | 'responsibleName'
  | 'responsibleEmail'
  | 'createdAt'
  | 'updatedAt'
>;

// Tipo para filtros de búsqueda
export type InstitutionFilters = {
  search?: string;
  city?: string;
  state?: string;
  country?: string;
};

// Tipo para paginación
export type PaginationParams = {
  page?: number;
  limit?: number;
  sortBy?: keyof Institution;
  sortOrder?: 'asc' | 'desc';
};

// Los tipos de paginación se importan desde paginator.ts
