import { prisma } from '../index';
import type { Member } from '@prisma/client';

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
      console.error('Error al crear miembro:', error);
      throw new Error('No se pudo crear el miembro');
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
      console.error('Error al obtener miembro:', error);
      throw new Error('No se pudo obtener el miembro');
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
      console.error('Error al actualizar miembro:', error);
      throw new Error('No se pudo actualizar el miembro');
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await prisma.member.delete({
        where: { id }
      });
    } catch (error) {
      console.error('Error al eliminar miembro:', error);
      throw new Error('No se pudo eliminar el miembro');
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
      console.error('Error al obtener miembros:', error);
      throw new Error('No se pudieron obtener los miembros');
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
      console.error('Error al verificar número de orden:', error);
      throw new Error('No se pudo verificar el número de orden');
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
      console.error('Error al verificar número de matrícula:', error);
      throw new Error('No se pudo verificar el número de matrícula');
    }
  }

  static async getAll(options: {
    search?: string;
    page?: number;
    limit?: number;
    institutionId?: string;
  }) {
    try {
      const { search = '', page = 1, limit = 10, institutionId } = options;
      const skip = (page - 1) * limit;

      const where: any = {
        deletedAt: null
      };

      if (institutionId) {
        where.institucionId = institutionId;
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
      console.error('Error al obtener miembros:', error);
      throw new Error('No se pudieron obtener los miembros');
    }
  }
}
