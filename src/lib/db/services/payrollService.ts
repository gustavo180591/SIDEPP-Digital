import { prisma } from '../index';
import { paginator, type PaginatedResult } from '../paginator';

const paginate = paginator({ page: 1, perPage: 10 });

export class PayrollService {
  static async getByInstitution(
    institutionId: string,
    filters: { search?: string; year?: number; month?: number } = {},
    pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
  ): Promise<PaginatedResult<any>> {
    const { search = '', year, month } = filters;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const where: any = { institutionId };
    if (year) where.year = year;
    if (month) where.month = month;
    if (search) where.OR = [{ concept: { contains: search, mode: 'insensitive' } }];

    const result = await paginate(prisma.payrollPeriod, {
      where,
      include: {
        pdfFiles: true,
        transfer: true
      },
      orderBy: { [sortBy]: sortOrder }
    }, { page, perPage: limit });

    // map to pdf-like shape for existing components: { ...pdfFile, period: payroll }
    // Si un período tiene múltiples PDFs, crear una entrada por cada PDF
    const data: any[] = [];

    (result.data as any[]).forEach((p) => {
      const period = {
        id: p.id,
        institutionId: p.institutionId,
        month: p.month,
        year: p.year,
        concept: p.concept,
        peopleCount: p.peopleCount,
        totalAmount: p.totalAmount != null ? Number(p.totalAmount) : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        transfer: p.transfer ? { ...p.transfer, importe: p.transfer.importe != null ? Number(p.transfer.importe) : null } : null
      };

      // Si hay PDFs asociados, crear una entrada por cada uno
      if (p.pdfFiles && p.pdfFiles.length > 0) {
        p.pdfFiles.forEach((pdf: any) => {
          data.push({ ...pdf, period });
        });
      } else {
        // Si no hay PDFs, crear una entrada falsa
        const pdfLike = { id: `no-pdf-${p.id}`, fileName: 'Sin PDF', createdAt: p.createdAt, updatedAt: p.updatedAt, periodId: p.id, bufferHash: null, type: null };
        data.push({ ...pdfLike, period });
      }
    });

    return { ...result, data, meta: { ...result.meta, total: data.length } } as PaginatedResult<any>;
  }

  static async getById(id: string) {
    const p = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        pdfFiles: {
          include: { contributionLine: { include: { member: true }, orderBy: { createdAt: 'desc' } } }
        },
        transfer: true
      }
    });
    if (!p) return null;
    const transformedPeriod: any = {
      id: p.id,
      institutionId: p.institutionId,
      month: p.month,
      year: p.year,
      concept: p.concept,
      peopleCount: p.peopleCount,
      totalAmount: p.totalAmount != null ? Number(p.totalAmount) : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      transfer: p.transfer ? { ...p.transfer, importe: p.transfer.importe != null ? Number(p.transfer.importe) : null } : null
    };

    // Usar el primer PDF si hay varios
    const firstPdf = p.pdfFiles && p.pdfFiles[0];
    const transformedPdf = firstPdf ? {
      id: firstPdf.id,
      fileName: firstPdf.fileName,
      periodId: firstPdf.periodId,
      createdAt: firstPdf.createdAt,
      updatedAt: firstPdf.updatedAt,
      bufferHash: firstPdf.bufferHash,
      period: transformedPeriod,
      contributionLine: firstPdf.contributionLine.map((c) => ({
        id: c.id,
        memberId: c.memberId,
        name: c.name,
        quantity: c.quantity,
        conceptAmount: c.conceptAmount != null ? Number(c.conceptAmount) : null,
        totalRem: c.totalRem != null ? Number(c.totalRem) : null,
        status: c.status,
        pdfFileId: c.pdfFileId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        member: c.member
      }))
    } : null;

    return { ...transformedPeriod, pdfFile: transformedPdf, pdfFiles: p.pdfFiles };
  }
}


