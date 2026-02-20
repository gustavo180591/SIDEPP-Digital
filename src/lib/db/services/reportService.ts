import { prisma } from '../index';
import type { Prisma } from '@prisma/client';

export interface AporteMensual {
  montoConcepto: number;
  totalRemunerativo: number;
}

export interface AfiliadoConAportes {
  fullName: string;
  dni: string;
  memberId: string | null;
  meses: Record<string, AporteMensual>; // key: 'YYYY-MM'
}

export interface ReporteAportesPorPeriodo {
  afiliados: AfiliadoConAportes[];
  mesesOrdenados: string[]; // Array de 'YYYY-MM' ordenados
  totalesPorMes: Record<string, AporteMensual>;
  institution?: {
    id: string;
    name: string | null;
    cuit: string | null;
  };
}

/**
 * Obtiene un reporte de aportes por período para una institución
 * Agrupa las contribuciones por afiliado y mes
 */
export async function getAportesPorPeriodo(params: {
  institutionId?: string;
  startMonth?: string; // 'YYYY-MM'
  endMonth?: string; // 'YYYY-MM'
}): Promise<ReporteAportesPorPeriodo> {
  try {
  const { institutionId, startMonth, endMonth } = params;

  // Construir filtros para PayrollPeriod
  const periodWhere: Prisma.PayrollPeriodWhereInput = {};

  if (institutionId) {
    periodWhere.institutionId = institutionId;
  }

  // Filtrar por rango de fechas si se especifica
  if (startMonth || endMonth) {
    periodWhere.AND = [];

    if (startMonth) {
      const [year, month] = startMonth.split('-').map(Number);
      periodWhere.AND.push({
        OR: [
          { year: { gt: year } },
          {
            AND: [{ year: year }, { month: { gte: month } }]
          }
        ]
      });
    }

    if (endMonth) {
      const [year, month] = endMonth.split('-').map(Number);
      periodWhere.AND.push({
        OR: [
          { year: { lt: year } },
          {
            AND: [{ year: year }, { month: { lte: month } }]
          }
        ]
      });
    }
  }

  // Obtener todos los períodos con sus contribution lines
  const periods = await prisma.payrollPeriod.findMany({
    where: periodWhere,
    include: {
      institution: {
        select: {
          id: true,
          name: true,
          cuit: true
        }
      },
      pdfFiles: {
        include: {
          contributionLine: {
            where: {
              status: {
                in: ['MATCHED', 'PENDING'] // Incluir solo líneas válidas
              }
            },
            include: {
              member: {
                select: {
                  id: true,
                  fullName: true,
                  documentoIdentidad: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }]
  });

  // Mapear para agrupar por afiliado
  const afiliadosMap = new Map<string, AfiliadoConAportes>();
  const mesesSet = new Set<string>();
  const totalesPorMes: Record<string, AporteMensual> = {};
  let institution;

  for (const period of periods) {
    const mesKey = `${period.year}-${String(period.month).padStart(2, '0')}`;
    mesesSet.add(mesKey);

    // Guardar institución (solo la primera)
    if (!institution && period.institution) {
      institution = period.institution;
    }

    // Inicializar totales para este mes
    if (!totalesPorMes[mesKey]) {
      totalesPorMes[mesKey] = {
        montoConcepto: 0,
        totalRemunerativo: 0
      };
    }

    // Procesar cada PDF del período
    for (const pdfFile of period.pdfFiles) {
      for (const line of pdfFile.contributionLine) {
        // Determinar identificador único del afiliado
        let afiliadoKey: string;
        let fullName: string;
        let dni: string;
        let memberId: string | null = null;

        if (line.member) {
          // Si está vinculado a un miembro, usar su ID
          afiliadoKey = line.member.id;
          fullName = line.member.fullName || 'DESCONOCIDO';
          dni = line.member.documentoIdentidad || '';
          memberId = line.member.id;
        } else {
          // Si no está vinculado, usar el nombre de la línea
          fullName = line.name || 'DESCONOCIDO';
          dni = ''; // No tenemos DNI si no está vinculado
          afiliadoKey = `unlinked-${fullName}`;
        }

        // Obtener o crear entrada del afiliado
        let afiliado = afiliadosMap.get(afiliadoKey);
        if (!afiliado) {
          afiliado = {
            fullName,
            dni,
            memberId,
            meses: {}
          };
          afiliadosMap.set(afiliadoKey, afiliado);
        }

        // Inicializar mes si no existe
        if (!afiliado.meses[mesKey]) {
          afiliado.meses[mesKey] = {
            montoConcepto: 0,
            totalRemunerativo: 0
          };
        }

        // Acumular valores
        const montoConcepto = Number(line.conceptAmount || 0);
        const totalRem = Number(line.totalRem || 0);

        afiliado.meses[mesKey].montoConcepto += montoConcepto;
        afiliado.meses[mesKey].totalRemunerativo += totalRem;

        // Acumular en totales
        totalesPorMes[mesKey].montoConcepto += montoConcepto;
        totalesPorMes[mesKey].totalRemunerativo += totalRem;
      }
    }
  }

  // Convertir Map a Array y ordenar por fullName
  const afiliados = Array.from(afiliadosMap.values()).sort((a, b) => {
    return a.fullName.localeCompare(b.fullName);
  });

  // Ordenar meses
  const mesesOrdenados = Array.from(mesesSet).sort();

  return {
    afiliados,
    mesesOrdenados,
    totalesPorMes,
    institution
  };
  } catch (error) {
    console.error('Error al generar reporte de aportes por período:', error);
    throw new Error('No se pudo generar el reporte de aportes');
  }
}

/**
 * Obtiene todas las instituciones disponibles para el selector
 */
export async function getInstitutionsForReport() {
  try {
    return await prisma.institution.findMany({
      select: {
        id: true,
        name: true,
        cuit: true
      },
      orderBy: {
        name: 'asc'
      }
    });
  } catch (error) {
    console.error('Error al obtener instituciones para reporte:', error);
    throw new Error('No se pudieron obtener las instituciones');
  }
}

/**
 * Obtiene el rango de meses disponibles en el sistema
 */
export async function getAvailableMonthsRange(): Promise<{
  minMonth: string | null;
  maxMonth: string | null;
}> {
  try {
    const minPeriod = await prisma.payrollPeriod.findFirst({
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      select: { year: true, month: true }
    });

    const maxPeriod = await prisma.payrollPeriod.findFirst({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { year: true, month: true }
    });

    return {
      minMonth: minPeriod
        ? `${minPeriod.year}-${String(minPeriod.month).padStart(2, '0')}`
        : null,
      maxMonth: maxPeriod
        ? `${maxPeriod.year}-${String(maxPeriod.month).padStart(2, '0')}`
        : null
    };
  } catch (error) {
    console.error('Error al obtener rango de meses disponibles:', error);
    throw new Error('No se pudo obtener el rango de meses');
  }
}
