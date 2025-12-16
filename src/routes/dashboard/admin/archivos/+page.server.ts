import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url }) => {
  // Verificar autenticación y rol ADMIN
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  if (locals.user.role !== 'ADMIN') {
    throw redirect(303, '/unauthorized');
  }

  // Obtener parámetros de filtro
  const institutionId = url.searchParams.get('institution') || '';
  const year = url.searchParams.get('year') || '';
  const month = url.searchParams.get('month') || '';

  // Construir filtro dinámico
  const whereClause: {
    institutionId?: string;
    year?: number;
    month?: number;
  } = {};

  if (institutionId) {
    whereClause.institutionId = institutionId;
  }
  if (year) {
    whereClause.year = parseInt(year, 10);
  }
  if (month) {
    whereClause.month = parseInt(month, 10);
  }

  // Obtener períodos con sus archivos
  const periods = await prisma.payrollPeriod.findMany({
    where: whereClause,
    include: {
      institution: {
        select: {
          id: true,
          name: true,
          cuit: true
        }
      },
      transfer: {
        select: {
          id: true,
          importe: true,
          operationNo: true,
          datetime: true
        }
      },
      pdfFiles: {
        select: {
          id: true,
          fileName: true,
          type: true,
          totalAmount: true,
          peopleCount: true,
          createdAt: true,
          bufferHash: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    },
    orderBy: [
      { year: 'desc' },
      { month: 'desc' },
      { createdAt: 'desc' }
    ]
  });

  // Obtener lista de instituciones para el filtro
  const institutions = await prisma.institution.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  // Generar lista de años disponibles (últimos 5 años)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Meses para filtro
  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  return {
    periods: periods.map(p => ({
      ...p,
      transfer: p.transfer ? {
        ...p.transfer,
        importe: p.transfer.importe?.toString() || null
      } : null,
      pdfFiles: p.pdfFiles.map(f => ({
        ...f,
        totalAmount: f.totalAmount?.toString() || null
      }))
    })),
    institutions,
    years,
    months,
    filters: {
      institutionId,
      year,
      month
    }
  };
};
