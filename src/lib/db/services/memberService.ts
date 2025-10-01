import { prisma } from '../index';
import type { Member } from '@prisma/client';

export type CreateMemberData = {
  firstName: string;
  lastName: string;
  email?: string;
  numeroOrden: string;
  numeroMatricula: string;
  documentoIdentidad: string;
  membershipStartDate: Date;
  status?: 'active' | 'inactive';
  institucionId: string;
};

export type UpdateMemberData = Partial<Omit<CreateMemberData, 'institucionId'>>;

export class MemberService {
  static async create(data: CreateMemberData): Promise<Member> {
    try {
      const member = await prisma.member.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          numeroOrden: data.numeroOrden,
          numeroMatricula: data.numeroMatricula,
          documentoIdentidad: data.documentoIdentidad,
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
        where: { id }
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
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          numeroOrden: data.numeroOrden,
          numeroMatricula: data.numeroMatricula,
          documentoIdentidad: data.documentoIdentidad,
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
}
