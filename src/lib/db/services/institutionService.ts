import { prisma } from '../index';
import { paginator, type PaginatedResult } from '../paginator';
import type {
  CreateInstitutionData,
  UpdateInstitutionData,
  InstitutionWithRelations,
  InstitutionListItem,
  InstitutionFilters,
  PaginationParams
} from '../models';

// Tipo para institución serializable
type SerializableInstitution = Omit<InstitutionWithRelations, 'payrollPeriods'> & {
  payrollPeriods: Array<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    institutionId: string;
    month: number;
    year: number;
    transferId: string;
  }>;
};

// Crear instancia del paginador con opciones por defecto
const paginate = paginator({ page: 1, perPage: 10 });

export class InstitutionService {
  /**
   * Crear una nueva institución
   */
  static async create(data: CreateInstitutionData): Promise<SerializableInstitution> {
    try {
      const institution = await prisma.institution.create({
        data,
        include: {
          members: true,
          userInstitutions: true,
          payrollPeriods: true
        }
      });

      return {
        ...institution
      } as SerializableInstitution;
    } catch (error) {
      console.error('Error al crear institución:', error);
      throw new Error('No se pudo crear la institución');
    }
  }

  /**
   * Obtener una institución por ID
   */
  static async findById(id: string): Promise<SerializableInstitution | null> {
    try {
      const institution = await prisma.institution.findUnique({
        where: { id },
        include: {
          members: true,
          userInstitutions: true,
          payrollPeriods: true
        }
      });
      
      if (!institution) {
        return null;
      }

      return {
        ...institution
      } as SerializableInstitution;
    } catch (error) {
      console.error('Error al obtener institución:', error);
      throw new Error('No se pudo obtener la institución');
    }
  }

  /**
   * Obtener una institución por ID (alias para compatibilidad)
   */
  static async getById(id: string): Promise<SerializableInstitution | null> {
    return this.findById(id);
  }

  /**
   * Obtener miembros de una institución con búsqueda y paginación
   */
  static async getMembers(institutionId: string, options: {
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    try {
      const { search = '', page = 1, limit = 10 } = options;

      // Construir condiciones WHERE
      const where: any = { institucionId: institutionId };

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { numeroOrden: { contains: search, mode: 'insensitive' } },
          { numeroMatricula: { contains: search, mode: 'insensitive' } },
          { documentoIdentidad: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Usar el paginador
      const result = await paginate(prisma.member, {
        where,
        select: {
          id: true,
          numeroOrden: true,
          numeroMatricula: true,
          fullName: true,
          email: true,
          documentoIdentidad: true,
          nacionalidad: true,
          status: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          membershipStartDate: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true
        },
        orderBy: { createdAt: 'desc' }
      }, {
        page,
        perPage: limit
      });

      return result;
    } catch (error) {
      console.error('Error al obtener miembros:', error);
      throw new Error('No se pudieron obtener los miembros');
    }
  }

  /**
   * Obtener todas las instituciones con paginación y filtros
   */
  static async findMany(
    filters: InstitutionFilters = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<InstitutionListItem>> {
    try {
      const { sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const { search, city, state, country } = filters;

      // Construir condiciones WHERE
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { cuit: { contains: search, mode: 'insensitive' } },
          { responsibleName: { contains: search, mode: 'insensitive' } },
          { responsibleEmail: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (city) {
        where.city = { contains: city, mode: 'insensitive' };
      }

      if (state) {
        where.state = { contains: state, mode: 'insensitive' };
      }

      if (country) {
        where.country = { contains: country, mode: 'insensitive' };
      }

      // Usar el paginador
      const result = await paginate(prisma.institution, {
        where,
        select: {
          id: true,
          name: true,
          cuit: true,
          address: true,
          city: true,
          state: true,
          country: true,
          responsibleName: true,
          responsibleEmail: true,
          responsablePhone: true,
          fopidEnabled: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { [sortBy]: sortOrder }
      }, {
        page: pagination.page,
        perPage: pagination.limit
      }) as PaginatedResult<InstitutionListItem>;

      return result;
    } catch (error) {
      console.error('Error al obtener instituciones:', error);
      throw new Error('No se pudieron obtener las instituciones');
    }
  }

  /**
   * Actualizar una institución
   */
  static async update(id: string, data: UpdateInstitutionData): Promise<SerializableInstitution> {
    try {
      const institution = await prisma.institution.update({
        where: { id },
        data,
        include: {
          members: true,
          userInstitutions: true,
          payrollPeriods: true
        }
      });

      return {
        ...institution
      } as SerializableInstitution;
    } catch (error) {
      console.error('Error al actualizar institución:', error);
      throw new Error('No se pudo actualizar la institución');
    }
  }

  /**
   * Eliminar una institución
   */
  static async delete(id: string): Promise<void> {
    try {
      await prisma.institution.delete({
        where: { id }
      });
    } catch (error) {
      console.error('Error al eliminar institución:', error);
      throw new Error('No se pudo eliminar la institución');
    }
  }

  /**
   * Verificar si existe una institución por CUIT
   */
  static async existsByCuit(cuit: string, excludeId?: string): Promise<boolean> {
    try {
      const where: any = { cuit };
      if (excludeId) {
        where.id = { not: excludeId };
      }

      const count = await prisma.institution.count({ where });
      return count > 0;
    } catch (error) {
      console.error('Error al verificar CUIT:', error);
      throw new Error('No se pudo verificar el CUIT');
    }
  }

  /**
   * Obtener estadísticas de una institución
   */
  static async getStats(id: string) {
    try {
      const [membersCount, usersCount, payrollPeriodsCount] = await Promise.all([
        prisma.member.count({ where: { institucionId: id } }),
        prisma.userInstitution.count({ where: { institutionId: id } }),
        prisma.payrollPeriod.count({ where: { institutionId: id } })
      ]);

      return {
        membersCount,
        usersCount,
        payrollPeriodsCount
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('No se pudieron obtener las estadísticas');
    }
  }

  /**
   * Obtener lista simplificada de instituciones para selectores
   * Opcionalmente filtra por IDs específicos (para LIQUIDADOR)
   */
  static async getListForSelect(institutionIds?: string[]): Promise<Array<{ id: string; name: string }>> {
    try {
      const where: any = {};

      if (institutionIds && institutionIds.length > 0) {
        where.id = { in: institutionIds };
      }

      const institutions = await prisma.institution.findMany({
        where,
        select: {
          id: true,
          name: true
        },
        orderBy: { name: 'asc' }
      });

      return institutions.map(inst => ({
        id: inst.id,
        name: inst.name || 'Sin nombre'
      }));
    } catch (error) {
      console.error('Error al obtener lista de instituciones:', error);
      throw new Error('No se pudieron obtener las instituciones');
    }
  }
}
