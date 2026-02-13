import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import type { Member } from '@prisma/client';

// Helper para manejar errores de Prisma
function handlePrismaError(error: unknown, context: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Violación de constraint único
        const target = (error.meta?.target as string[])?.join(', ') || 'campo';
        throw new Error(`Ya existe un miembro con el mismo ${target}`);
      case 'P2025':
        throw new Error('Miembro no encontrado');
      case 'P2003':
        throw new Error('La institución especificada no existe');
      default:
        console.error(`Error Prisma [${error.code}] en ${context}:`, error.message);
        throw new Error(`Error de base de datos: ${error.message}`);
    }
  }
  console.error(`Error en ${context}:`, error);
  throw new Error(`No se pudo ${context}`);
}

export type CreateMemberData = {
  fullName: string;
  email?: string;
  numeroOrden?: string;
  numeroMatricula?: string;
  documentoIdentidad: string;
  nacionalidad?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  membershipStartDate?: Date;
  status?: string;
  institucionId: string;
};

export type UpdateMemberData = Partial<Omit<CreateMemberData, 'institucionId'>>;

export class MemberService {
  static async create(data: CreateMemberData): Promise<Member> {
    try {
      const member = await prisma.member.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          numeroOrden: data.numeroOrden,
          numeroMatricula: data.numeroMatricula,
          documentoIdentidad: data.documentoIdentidad,
          nacionalidad: data.nacionalidad,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          membershipStartDate: data.membershipStartDate,
          status: data.status || 'active',
          institucionId: data.institucionId
        }
      });
      return member;
    } catch (error) {
      handlePrismaError(error, 'crear el miembro');
    }
  }

  static async findById(id: string): Promise<Member | null> {
    try {
      const member = await prisma.member.findUnique({
        where: { id },
        include: {
          institucion: true,
          contributions: true
        }
      });

      return member;
    } catch (error) {
      handlePrismaError(error, 'obtener el miembro');
    }
  }

  static async update(id: string, data: UpdateMemberData): Promise<Member> {
    try {
      const member = await prisma.member.update({
        where: { id },
        data: {
          fullName: data.fullName,
          email: data.email,
          numeroOrden: data.numeroOrden,
          numeroMatricula: data.numeroMatricula,
          documentoIdentidad: data.documentoIdentidad,
          nacionalidad: data.nacionalidad,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          membershipStartDate: data.membershipStartDate,
          status: data.status
        }
      });

      return member;
    } catch (error) {
      handlePrismaError(error, 'actualizar el miembro');
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await prisma.member.delete({
        where: { id }
      });
    } catch (error) {
      handlePrismaError(error, 'eliminar el miembro');
    }
  }

  static async getByInstitution(institutionId: string): Promise<Member[]> {
    try {
      const members = await prisma.member.findMany({
        where: { institucionId: institutionId },
        orderBy: { createdAt: 'desc' }
      });

      return members;
    } catch (error) {
      handlePrismaError(error, 'obtener los miembros de la institución');
    }
  }

  static async existsByNumeroOrden(numeroOrden: string, institutionId: string, excludeId?: string): Promise<boolean> {
    try {
      const where: any = {
        numeroOrden,
        institucionId: institutionId
      };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const count = await prisma.member.count({ where });
      return count > 0;
    } catch (error) {
      handlePrismaError(error, 'verificar el número de orden');
    }
  }

  static async existsByNumeroMatricula(numeroMatricula: string, institutionId: string, excludeId?: string): Promise<boolean> {
    try {
      const where: any = {
        numeroMatricula,
        institucionId: institutionId
      };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const count = await prisma.member.count({ where });
      return count > 0;
    } catch (error) {
      handlePrismaError(error, 'verificar el número de matrícula');
    }
  }

  static async existsByDocumentoIdentidad(documentoIdentidad: string, institutionId: string, excludeId?: string): Promise<boolean> {
    try {
      const where: any = {
        documentoIdentidad,
        institucionId: institutionId
      };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const count = await prisma.member.count({ where });
      return count > 0;
    } catch (error) {
      handlePrismaError(error, 'verificar el documento de identidad');
    }
  }

  static async getAll(options: {
    search?: string;
    page?: number;
    limit?: number;
    institutionId?: string;
    institutionIds?: string[];
  }) {
    try {
      const { search = '', page = 1, limit = 10, institutionId, institutionIds } = options;
      const skip = (page - 1) * limit;

      const where: any = {
        deletedAt: null
      };

      // Filtrar por una institución específica
      if (institutionId) {
        where.institucionId = institutionId;
      }
      // O filtrar por múltiples instituciones (para LIQUIDADOR con varias)
      else if (institutionIds && institutionIds.length > 0) {
        where.institucionId = { in: institutionIds };
      }

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { documentoIdentidad: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { numeroOrden: { contains: search, mode: 'insensitive' } },
          { numeroMatricula: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [members, total] = await Promise.all([
        prisma.member.findMany({
          where,
          include: {
            institucion: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.member.count({ where })
      ]);

      return {
        data: members,
        meta: {
          total,
          currentPage: page,
          lastPage: Math.ceil(total / limit),
          perPage: limit
        }
      };
    } catch (error) {
      handlePrismaError(error, 'obtener los miembros');
    }
  }
}
