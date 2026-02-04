/**
 * Endpoint de Confirmación para guardado de PDFs
 *
 * Este endpoint recibe los datos del preview y los guarda
 * en una transacción atómica.
 *
 * POST /api/analyzer-pdf-confirm
 *
 * Request: JSON con:
 *   - sessionId: string
 *   - selectedPeriod: { month: number; year: number }
 *   - institutionId: string
 *   - previews: { sueldos?, fopid?, aguinaldo?, transferencia? }
 *   - forceConfirm?: boolean (guardar aunque no coincidan los totales)
 *
 * Response: BatchSaveResult
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/middleware';
import { saveBatchAtomic, type BatchSaveInput } from '$lib/server/analyzer/save';
import type { AportesPreviewResult, TransferenciaPreviewResult } from '$lib/server/analyzer/preview';

interface ConfirmRequest {
  sessionId: string;
  selectedPeriod: { month: number; year: number };
  institutionId: string;
  previews: {
    sueldos?: AportesPreviewResult;
    fopid?: AportesPreviewResult;
    aguinaldo?: AportesPreviewResult;
    transferencia?: TransferenciaPreviewResult;
  };
  forceConfirm?: boolean;
}

export const POST: RequestHandler = async (event) => {
  // Requerir autenticación
  const auth = await requireAuth(event);
  if (auth.error) {
    return json({ error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const contentType = event.request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return json({ error: 'Se esperaba application/json' }, { status: 400 });
    }

    const body: ConfirmRequest = await event.request.json();

    // Validar campos requeridos
    if (!body.sessionId) {
      return json({ error: 'sessionId es requerido' }, { status: 400 });
    }

    if (!body.selectedPeriod || !body.selectedPeriod.month || !body.selectedPeriod.year) {
      return json({ error: 'selectedPeriod es requerido con month y year' }, { status: 400 });
    }

    if (!body.institutionId) {
      return json({ error: 'institutionId es requerido' }, { status: 400 });
    }

    if (!body.previews || Object.keys(body.previews).length === 0) {
      return json({ error: 'No hay archivos para guardar' }, { status: 400 });
    }

    // Validar que al menos un archivo tenga success: true
    const validPreviews = Object.values(body.previews).filter(p => p && p.success);
    if (validPreviews.length === 0) {
      return json({
        error: 'No hay archivos válidos para guardar',
        details: 'Todos los archivos tienen errores'
      }, { status: 400 });
    }

    // Validar permisos de usuario LIQUIDADOR
    if (auth.user?.role === 'LIQUIDADOR') {
      const userInstitutionIds = auth.user.institutions?.map((i: { id: string }) => i.id) || [];

      if (userInstitutionIds.length === 0) {
        return json({
          error: 'Usuario sin institución asignada'
        }, { status: 403 });
      }

      if (!userInstitutionIds.includes(body.institutionId)) {
        return json({
          error: 'No tiene permiso para guardar archivos para esta institución'
        }, { status: 403 });
      }
    }

    // Verificar que todas las instituciones detectadas coincidan con la solicitada
    for (const [key, preview] of Object.entries(body.previews)) {
      if (preview && preview.success && 'institution' in preview) {
        if (preview.institution?.id !== body.institutionId) {
          return json({
            error: `El archivo ${preview.fileName} corresponde a una institución diferente`,
            details: {
              expected: body.institutionId,
              detected: preview.institution?.id
            }
          }, { status: 400 });
        }
      }
    }

    // Preparar input para guardado
    const saveInput: BatchSaveInput = {
      previews: body.previews as {
        sueldos?: AportesPreviewResult;
        fopid?: AportesPreviewResult;
        aguinaldo?: AportesPreviewResult;
        transferencia?: TransferenciaPreviewResult;
      },
      selectedPeriod: body.selectedPeriod,
      institutionId: body.institutionId,
      forceConfirm: body.forceConfirm
    };

    // Ejecutar guardado atómico
    const result = await saveBatchAtomic(saveInput);

    if (!result.success) {
      console.error('[CONFIRM] Error en guardado:', result.error);
      return json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 500 });
    }

    return json({
      success: true,
      periodId: result.periodId,
      savedFiles: result.savedFiles,
      message: 'Archivos guardados exitosamente'
    }, { status: 201 });

  } catch (error) {
    console.error('[CONFIRM] Error en guardado:', error);

    return json({
      success: false,
      error: 'Error al guardar los archivos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
