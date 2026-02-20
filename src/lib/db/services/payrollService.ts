import { prisma } from '../index';
import { paginator, type PaginatedResult } from '../paginator';

const paginate = paginator({ page: 1, perPage: 10 });

export class PayrollService {
  static async getByInstitution(
    institutionId: string,
    filters: { search?: string; year?: number; month?: number } = {},
    pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
  ): Promise<PaginatedResult<any>> {
    try {
    const { search = '', year, month } = filters;
    const ALLOWED_SORT_FIELDS = ['createdAt', 'year', 'month', 'updatedAt'] as const;
    const { page = 1, limit = 10, sortOrder = 'desc' } = pagination;
    const sortBy = ALLOWED_SORT_FIELDS.includes(pagination.sortBy as any) ? pagination.sortBy! : 'createdAt';

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
      // Calcular totales desde los PDFs asociados
      const pdfFilesArray = p.pdfFiles || [];
      const totalPeopleCount = pdfFilesArray.reduce((sum: number, pdf: any) => sum + (pdf.peopleCount || 0), 0);
      const totalAmount = pdfFilesArray.reduce((sum: number, pdf: any) => {
        const amount = pdf.totalAmount != null ? Number(pdf.totalAmount) : 0;
        return sum + amount;
      }, 0);

      const period = {
        id: p.id,
        institutionId: p.institutionId,
        month: p.month,
        year: p.year,
        peopleCount: totalPeopleCount,
        totalAmount: totalAmount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        transfer: p.transfer ? { ...p.transfer, importe: p.transfer.importe != null ? Number(p.transfer.importe) : null } : null
      };

      // Si hay PDFs asociados, crear una entrada por cada uno
      if (p.pdfFiles && p.pdfFiles.length > 0) {
        p.pdfFiles.forEach((pdf: any) => {
          const pdfWithNumbers = {
            ...pdf,
            totalAmount: pdf.totalAmount != null ? Number(pdf.totalAmount) : null
          };
          data.push({ ...pdfWithNumbers, period });
        });
      } else {
        // Si no hay PDFs, crear una entrada falsa
        const pdfLike = { id: `no-pdf-${p.id}`, fileName: 'Sin PDF', createdAt: p.createdAt, updatedAt: p.updatedAt, periodId: p.id, bufferHash: null, type: null, concept: null, peopleCount: null, totalAmount: null };
        data.push({ ...pdfLike, period });
      }
    });

    // Mantener el total original para paginación correcta (no recalcular con data.length expandido)
    return { ...result, data } as PaginatedResult<any>;
    } catch (error) {
      console.error('Error al obtener períodos de nómina:', error);
      throw new Error('No se pudieron obtener los períodos de nómina');
    }
  }

  static async getById(id: string) {
    try {
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

    // Calcular totales desde los PDFs asociados
    const pdfFilesArray = p.pdfFiles || [];
    const totalPeopleCount = pdfFilesArray.reduce((sum: number, pdf: any) => sum + (pdf.peopleCount || 0), 0);
    const totalAmount = pdfFilesArray.reduce((sum: number, pdf: any) => {
      const amount = pdf.totalAmount != null ? Number(pdf.totalAmount) : 0;
      return sum + amount;
    }, 0);

    const transformedPeriod: any = {
      id: p.id,
      institutionId: p.institutionId,
      month: p.month,
      year: p.year,
      peopleCount: totalPeopleCount,
      totalAmount: totalAmount,
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
      type: firstPdf.type,
      concept: firstPdf.concept,
      peopleCount: firstPdf.peopleCount,
      totalAmount: firstPdf.totalAmount != null ? Number(firstPdf.totalAmount) : null,
      metadata: firstPdf.metadata,
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

    // Transformar todos los pdfFiles
    const transformedPdfFiles = p.pdfFiles.map((pdf) => ({
      id: pdf.id,
      fileName: pdf.fileName,
      periodId: pdf.periodId,
      createdAt: pdf.createdAt,
      updatedAt: pdf.updatedAt,
      bufferHash: pdf.bufferHash,
      type: pdf.type,
      concept: pdf.concept,
      peopleCount: pdf.peopleCount,
      totalAmount: pdf.totalAmount != null ? Number(pdf.totalAmount) : null,
      contributionLine: pdf.contributionLine.map((c) => ({
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
    }));

    return { ...transformedPeriod, pdfFile: transformedPdf, pdfFiles: transformedPdfFiles };
    } catch (error) {
      console.error('Error al obtener período de nómina:', error);
      throw new Error('No se pudo obtener el período de nómina');
    }
  }
}


