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
        pdfFile: true,
        transfer: true
      },
      orderBy: { [sortBy]: sortOrder }
    }, { page, perPage: limit });

    // map to pdf-like shape for existing components: { ...pdfFile, period: payroll }
    const data = (result.data as any[]).map((p) => {
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
      const pdfLike = p.pdfFile ?? { id: `no-pdf-${p.id}`, fileName: 'Sin PDF', createdAt: p.createdAt, updatedAt: p.updatedAt, periodId: p.id, bufferHash: null };
      return { ...pdfLike, period };
    });

    return { ...result, data } as PaginatedResult<any>;
  }

  static async getById(id: string) {
    const p = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        pdfFile: {
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

    const transformedPdf = p.pdfFile ? {
      id: p.pdfFile.id,
      fileName: p.pdfFile.fileName,
      periodId: p.pdfFile.periodId,
      createdAt: p.pdfFile.createdAt,
      updatedAt: p.pdfFile.updatedAt,
      bufferHash: p.pdfFile.bufferHash,
      period: transformedPeriod,
      contributionLine: p.pdfFile.contributionLine.map((c) => ({
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

    return { ...transformedPeriod, pdfFile: transformedPdf };
  }
}


