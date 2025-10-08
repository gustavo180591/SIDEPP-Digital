import { prisma } from '../index';
import { paginator, type PaginatedResult } from '../paginator';
import type { PdfFile, PayrollPeriod, BankTransfer } from '@prisma/client';

export type PdfFileWithPeriod = PdfFile & {
  period: PayrollPeriod & {
    transfer?: BankTransfer | null;
  };
};

export type PdfFileFilters = {
  search?: string;
  year?: number;
  month?: number;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

// Crear instancia del paginador con opciones por defecto
const paginate = paginator({ page: 1, perPage: 10 });

export class PdfService {
  private static serializePdf(pdf: any): PdfFileWithPeriod {
    const period = pdf.period ? {
      ...pdf.period,
      transfer: pdf.period.transfer ? {
        ...pdf.period.transfer,
        importe: pdf.period.transfer.importe != null ? Number(pdf.period.transfer.importe) : null
      } : null
    } : null;

    return {
      ...pdf,
      totalAmount: pdf.totalAmount != null ? Number(pdf.totalAmount) : null,
      period
    } as PdfFileWithPeriod;
  }
  /**
   * Obtener PDFs de una institución con búsqueda y paginación
   */
  static async getByInstitution(
    institutionId: string, 
    filters: PdfFileFilters = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<PdfFileWithPeriod>> {
    try {
      const { search = '', year, month } = filters;
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      
      // Construir condiciones WHERE
      const where: any = {
        period: {
          institutionId: institutionId
        }
      };
      
      if (search) {
        where.OR = [
          { fileName: { contains: search, mode: 'insensitive' } },
          { period: { concept: { contains: search, mode: 'insensitive' } } }
        ];
      }

      if (year) {
        where.period.year = year;
      }

      if (month) {
        where.period.month = month;
      }

      // Usar el paginador
      const result = await paginate(prisma.pdfFile, {
        where,
        include: {
          period: {
            include: {
              transfer: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder }
      }, {
        page,
        perPage: limit
      });

      const data = (result.data as any[]).map(PdfService.serializePdf);
      return { ...result, data } as PaginatedResult<PdfFileWithPeriod>;
    } catch (error) {
      console.error('Error al obtener PDFs:', error);
      throw new Error('No se pudieron obtener los PDFs');
    }
  }

  /**
   * Obtener un PDF por ID con sus relaciones
   */
  static async getById(id: string): Promise<PdfFileWithPeriod | null> {
    try {
      const pdfFile = await prisma.pdfFile.findUnique({
        where: { id },
        include: {
          period: {
            include: {
              transfer: true
            }
          }
        }
      });

      return pdfFile ? PdfService.serializePdf(pdfFile) : null;
    } catch (error) {
      console.error('Error al obtener PDF:', error);
      throw new Error('No se pudo obtener el PDF');
    }
  }

  /**
   * Obtener líneas de contribución de un PDF
   */
  static async getContributionLines(pdfFileId: string) {
    try {
      const contributionLines = await prisma.contributionLine.findMany({
        where: { pdfFileId },
        include: {
          member: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return contributionLines.map((c) => ({
        ...c,
        conceptAmount: c.conceptAmount != null ? Number(c.conceptAmount) : null,
        totalRem: c.totalRem != null ? Number(c.totalRem) : null
      }));
    } catch (error) {
      console.error('Error al obtener líneas de contribución:', error);
      throw new Error('No se pudieron obtener las líneas de contribución');
    }
  }

  /**
   * Obtener estadísticas de PDFs por institución
   */
  static async getStats(institutionId: string) {
    try {
      const [totalPdfs, recentUploads] = await Promise.all([
        prisma.pdfFile.count({
          where: {
            period: {
              institutionId: institutionId
            }
          }
        }),
        prisma.pdfFile.count({
          where: {
            period: {
              institutionId: institutionId
            },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
            }
          }
        })
      ]);

      // Obtener el monto total desde los PDFs asociados a períodos de la institución
      const totalAmountResult = await prisma.pdfFile.aggregate({
        where: {
          period: {
            institutionId: institutionId
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      return {
        totalPdfs,
        totalAmount: totalAmountResult._sum.totalAmount != null ? Number(totalAmountResult._sum.totalAmount) : 0,
        recentUploads
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw new Error('No se pudieron obtener las estadísticas');
    }
  }
}
