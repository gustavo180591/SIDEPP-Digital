import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAportesPorPeriodo } from '$lib/db/services/reportService';
import {
  generateAportesReportPdf,
  generatePdfFileName
} from '$lib/server/pdf/generate-aportes-report';
import { requireAuth } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
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
          error: 'Parámetros startMonth y endMonth son requeridos'
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

    // Determinar nombre de institución
    const institutionName = reporte.institution?.name || 'Todas-las-instituciones';

    // Generar PDF
    const pdfBytes = await generateAportesReportPdf({
      reporte,
      institutionName,
      startMonth,
      endMonth
    });

    // Generar nombre de archivo
    const fileName = generatePdfFileName(institutionName, startMonth, endMonth);

    // Retornar PDF
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    console.error('Error al exportar reporte de aportes:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al generar el PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
