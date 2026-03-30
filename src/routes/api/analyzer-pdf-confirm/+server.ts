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
 *   - previews: { sueldos?, fopid?, aguinaldo?, transferencias?[] }
 *   - forceConfirm?: boolean (guardar aunque no coincidan los totales)
 *
 * Response: BatchSaveResult
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/middleware';
import { saveBatchAtomic, type BatchSaveInput } from '$lib/server/analyzer/save';
import type { AportesPreviewResult, TransferenciaPreviewResult } from '$lib/server/analyzer/preview';
import { sumarMontos, diferenciaMonto, calcularTolerancia } from '$lib/utils/currency.js';

interface ConfirmRequest {
  sessionId: string;
  selectedPeriod: { month: number; year: number };
  institutionId: string;
  previews: {
    sueldos?: AportesPreviewResult;
    fopid?: AportesPreviewResult;
    aguinaldo?: AportesPreviewResult;
    transferencias?: TransferenciaPreviewResult[];
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
    const aportesPreviews = [body.previews.sueldos, body.previews.fopid, body.previews.aguinaldo].filter(p => p && p.success);
    const transferenciasValidas = (body.previews.transferencias || []).filter(p => p && p.success);
    if (aportesPreviews.length === 0 && transferenciasValidas.length === 0) {
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
    const allPreviews: any[] = [
      body.previews.sueldos,
      body.previews.fopid,
      body.previews.aguinaldo,
      ...(body.previews.transferencias || [])
    ].filter(Boolean);

    for (const preview of allPreviews) {
      if (preview.success && 'institution' in preview) {
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

    // VALIDAR MONTOS: La única traba es que coincidan listado con comprobante
    if (!body.forceConfirm) {
      const montosAportes: number[] = [];
      for (const key of ['sueldos', 'fopid', 'aguinaldo'] as const) {
        const preview = body.previews[key];
        if (preview?.success && preview.type === 'APORTES') {
          montosAportes.push((preview as AportesPreviewResult).totalAmount);
        }
      }
      const totalAportes = sumarMontos(...montosAportes);

      // Sumar todas las transferencias
      const montosTransferencias = (body.previews.transferencias || [])
        .filter(t => t.success && t.type === 'TRANSFERENCIA')
        .map(t => (t as TransferenciaPreviewResult).transferAmount);
      const totalTransferencia = sumarMontos(...montosTransferencias);

      // Solo validar si hay ambos tipos de documentos
      if (totalAportes > 0 && totalTransferencia > 0) {
        const diferencia = diferenciaMonto(totalAportes, totalTransferencia);
        const montoMayor = Math.max(totalAportes, totalTransferencia);
        const tolerancia = calcularTolerancia(montoMayor, 0.001, 1);

        if (diferencia > tolerancia) {
          return json({
            success: false,
            error: 'Los montos no coinciden',
            details: `Total aportes: $${totalAportes.toFixed(2)} | Total transferencia: $${totalTransferencia.toFixed(2)} | Diferencia: $${diferencia.toFixed(2)}`
          }, { status: 400 });
        }
      }
    }

    // Preparar input para guardado
    const saveInput: BatchSaveInput = {
      previews: {
        sueldos: body.previews.sueldos,
        fopid: body.previews.fopid,
        aguinaldo: body.previews.aguinaldo,
        transferencias: body.previews.transferencias
      },
      selectedPeriod: body.selectedPeriod,
      institutionId: body.institutionId,
      forceConfirm: body.forceConfirm,
      uploadedBy: auth.user!.id
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
