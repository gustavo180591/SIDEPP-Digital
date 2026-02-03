import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAportesPorPeriodo } from '$lib/db/services/reportService';
import {
  generateAportesReportExcel,
  generateExcelFileName
} from '$lib/server/excel/generate-aportes-report';
import { requireAuth } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticacion
  const auth = await requireAuth(event);
  if (auth.error) {
    return json({ error: auth.error }, { status: auth.status || 401 });
  }

  // Validar permisos: solo ADMIN y FINANZAS pueden exportar reportes
  if (auth.user?.role !== 'ADMIN' && auth.user?.role !== 'FINANZAS') {
    return json({ error: 'No tiene permisos para exportar reportes' }, { status: 403 });
  }

  try {
    const institutionId = event.url.searchParams.get('institutionId') || undefined;
    const startMonth = event.url.searchParams.get('startMonth') || undefined;
    const endMonth = event.url.searchParams.get('endMonth') || undefined;

    if (!startMonth || !endMonth) {
      return new Response(
        JSON.stringify({
          error: 'Parametros startMonth y endMonth son requeridos'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Obtener datos del reporte
    const reporte = await getAportesPorPeriodo({
      institutionId,
      startMonth,
      endMonth
    });

    // Determinar nombre de institucion
    const institutionName = reporte.institution?.name || 'Todas-las-instituciones';

    // Generar Excel
    const excelBuffer = generateAportesReportExcel({
      reporte,
      institutionName,
      startMonth,
      endMonth
    });

    // Generar nombre de archivo
    const fileName = generateExcelFileName(institutionName, startMonth, endMonth);

    // Retornar Excel
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    console.error('Error al exportar reporte de aportes a Excel:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al generar el Excel',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
