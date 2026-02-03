import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAportesPorPeriodo } from '$lib/db/services/reportService';
import { requireAuth } from '$lib/server/auth/middleware';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
  const auth = await requireAuth(event);
  if (auth.error) {
    return json({ error: auth.error }, { status: auth.status || 401 });
  }

  // Validar permisos: solo ADMIN y FINANZAS pueden ver reportes
  if (auth.user?.role !== 'ADMIN' && auth.user?.role !== 'FINANZAS') {
    return json({ error: 'No tiene permisos para acceder a reportes' }, { status: 403 });
  }

  try {
    const institutionId = event.url.searchParams.get('institutionId') || undefined;
    const startMonth = event.url.searchParams.get('startMonth') || undefined;
    const endMonth = event.url.searchParams.get('endMonth') || undefined;

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
