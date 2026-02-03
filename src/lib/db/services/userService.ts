import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import { paginator, type PaginatedResult } from '../paginator';
import type {
  CreateUserData,
  UpdateUserData,
  UserWithRelations,
  UserListItem,
  UserFilters,
  PaginationParams
} from '../models';
import bcrypt from 'bcryptjs';

// Helper para manejar errores de Prisma
function handlePrismaError(error: unknown, context: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        const target = (error.meta?.target as string[])?.join(', ') || 'campo';
        if (target.includes('email')) {
          throw new Error('Ya existe un usuario con este email');
        }
        throw new Error(`Ya existe un usuario con el mismo ${target}`);
      case 'P2025':
        throw new Error('Usuario no encontrado');
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

// Crear instancia del paginador con opciones por defecto
const paginate = paginator({ page: 1, perPage: 10 });

export class UserService {
  /**
   * Crear un nuevo usuario
   */
  static async create(data: CreateUserData): Promise<UserWithRelations> {
    try {
      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Soportar institutionId (single) o institutionIds (multiple)
      const institutionIds = data.institutionIds || (data.institutionId ? [data.institutionId] : []);

      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          password: hashedPassword,
          role: data.role || 'LIQUIDADOR',
          isActive: data.isActive ?? true,
          userInstitutions: {
            create: institutionIds.map(instId => ({
              institutionId: instId
            }))
          }
        },
        include: {
          userInstitutions: {
            include: {
              institution: true
            }
          }
        }
      });

      return user;
    } catch (error) {
      handlePrismaError(error, 'crear el usuario');
    }
  }

  /**
   * Obtener un usuario por ID
   */
  static async findById(id: string): Promise<UserWithRelations | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          userInstitutions: {
            include: {
              institution: true
            }
          }
        }
      });

      return user;
    } catch (error) {
      handlePrismaError(error, 'obtener el usuario');
    }
  }

  /**
   * Obtener un usuario por email
   */
  static async findByEmail(email: string): Promise<UserWithRelations | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          userInstitutions: {
            include: {
              institution: true
            }
          }
        }
      });

      return user;
    } catch (error) {
      handlePrismaError(error, 'obtener el usuario por email');
    }
  }

  /**
   * Obtener todos los usuarios con paginación y filtros
   */
  static async findMany(
    filters: UserFilters = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<UserListItem>> {
    try {
      const { sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const { search, role, isActive, institutionId } = filters;

      // Construir condiciones WHERE
      const where: any = {
        deletedAt: null // Excluir usuarios eliminados (soft delete)
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (role) {
        where.role = role;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (institutionId) {
        where.userInstitutions = {
          some: {
            institutionId: institutionId
          }
        };
      }

      // Usar el paginador
      const result = await paginate(prisma.user, {
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          userInstitutions: {
            select: {
              institution: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder }
      }, {
        page: pagination.page,
        perPage: pagination.limit
      }) as PaginatedResult<UserListItem>;

      return result;
    } catch (error) {
      handlePrismaError(error, 'obtener los usuarios');
    }
  }

  /**
   * Actualizar un usuario
   */
  static async update(id: string, data: UpdateUserData): Promise<UserWithRelations> {
    try {
      const updateData: any = { ...data };

      // Si se proporciona una nueva contraseña, hashearla
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 12);
      }

      // Remover institutionIds del updateData ya que se maneja aparte
      delete updateData.institutionIds;
      delete updateData.institutionId;

      // Si hay nuevas instituciones, actualizar la relación usando transacción
      const institutionIds = data.institutionIds || (data.institutionId ? [data.institutionId] : null);

      if (institutionIds !== null) {
        // Usar transacción para evitar race conditions y errores de unique constraint
        await prisma.$transaction(async (tx) => {
          // Eliminar relaciones existentes
          await tx.userInstitution.deleteMany({
            where: { userId: id }
          });

          // Crear nuevas relaciones
          if (institutionIds.length > 0) {
            await tx.userInstitution.createMany({
              data: institutionIds.map(instId => ({
                userId: id,
                institutionId: instId
              })),
              skipDuplicates: true
            });
          }
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        include: {
          userInstitutions: {
            include: {
              institution: true
            }
          }
        }
      });

      return user;
    } catch (error: any) {
      console.error('Error al actualizar usuario:', error?.message || error);
      console.error('Stack:', error?.stack);
      throw new Error(`No se pudo actualizar el usuario: ${error?.message || 'Error desconocido'}`);
    }
  }

  /**
   * Eliminar un usuario (soft delete)
   */
  static async delete(id: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false
        }
      });
    } catch (error) {
      handlePrismaError(error, 'eliminar el usuario');
    }
  }

  /**
   * Verificar si existe un usuario por email
   */
  static async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    try {
      const where: any = { email };
      if (excludeId) {
        where.id = { not: excludeId };
      }

      const count = await prisma.user.count({ where });
      return count > 0;
    } catch (error) {
      handlePrismaError(error, 'verificar el email');
    }
  }

  /**
   * Activar/desactivar usuario
   */
  static async toggleActive(id: string): Promise<UserWithRelations> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { isActive: true }
      });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Actualizar directamente sin pasar institutionIds para no resetear las instituciones
      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        include: {
          userInstitutions: {
            include: {
              institution: true
            }
          }
        }
      });

      return updated;
    } catch (error) {
      handlePrismaError(error, 'cambiar el estado del usuario');
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  static async getStats() {
    try {
      const [totalUsers, activeUsers, adminUsers, institutionUsers] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { isActive: true, deletedAt: null } }),
        prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
        prisma.user.count({ where: { role: 'LIQUIDADOR', deletedAt: null } })
      ]);

      return {
        totalUsers,
        activeUsers,
        adminUsers,
        institutionUsers,
        inactiveUsers: totalUsers - activeUsers
      };
    } catch (error) {
      handlePrismaError(error, 'obtener las estadísticas');
    }
  }

  /**
   * Generar token de reset de contraseña
   */
  static async generateResetToken(email: string): Promise<{ token: string; user: UserWithRelations } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email, deletedAt: null, isActive: true },
        include: {
          userInstitutions: {
            include: { institution: true }
          }
        }
      });

      if (!user) {
        return null;
      }

      // Generar token único (32 bytes en hex = 64 caracteres)
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Expiración en 1 hora
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: token,
          resetExpires
        }
      });

      return { token, user };
    } catch (error) {
      console.error('Error al generar token de reset:', error);
      return null;
    }
  }

  /**
   * Buscar usuario por token de reset
   */
  static async findByResetToken(token: string): Promise<UserWithRelations | null> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetExpires: { gt: new Date() }, // Token no expirado
          deletedAt: null,
          isActive: true
        },
        include: {
          userInstitutions: {
            include: { institution: true }
          }
        }
      });

      return user;
    } catch (error) {
      console.error('Error al buscar por token de reset:', error);
      return null;
    }
  }

  /**
   * Restablecer contraseña usando token
   */
  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const user = await this.findByResetToken(token);

      if (!user) {
        return false;
      }

      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetExpires: null
        }
      });

      return true;
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      return false;
    }
  }
}
