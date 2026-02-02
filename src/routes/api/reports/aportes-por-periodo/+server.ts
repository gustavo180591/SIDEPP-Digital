import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAportesPorPeriodo } from '$lib/db/services/reportService';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const institutionId = url.searchParams.get('institutionId') || undefined;
    const startMonth = url.searchParams.get('startMonth') || undefined;
    const endMonth = url.searchParams.get('endMonth') || undefined;

    const reporte = await getAportesPorPeriodo({
      institutionId,
      startMonth,
      endMonth
    });

    return json(reporte);
  } catch (error) {
    console.error('Error al obtener reporte de aportes:', error);
    return json(
      {
        error: 'Error al generar el reporte',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
