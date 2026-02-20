/**
 * Endpoint de Preview para análisis de archivos
 *
 * Cada archivo se recibe en su key específica según el slot del formulario:
 *   - file_sueldos: Aportes Sueldos (PDF, CSV o Excel)
 *   - file_fopid: Aportes FOPID (PDF, CSV o Excel)
 *   - file_aguinaldo: Aportes Aguinaldo (PDF, CSV o Excel)
 *   - file_transferencia: Comprobante de transferencia (PDF)
 *
 * POST /api/analyzer-pdf-preview
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/middleware';
import { CONFIG } from '$lib/server/config';
import {
  analyzeAportesPreview,
  analyzeTransferenciaPreview,
  analyzeAportesCSVPreview,
  analyzeAportesExcelPreview,
  type BatchPreviewResult,
  type AportesPreviewResult,
  type TransferenciaPreviewResult
} from '$lib/server/analyzer/preview';

const { MAX_FILE_SIZE } = CONFIG;

function isCSVFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')
    || file.type === 'text/csv' || file.type === 'text/tab-separated-values';
}

function isExcelFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || file.type === 'application/vnd.ms-excel';
}

// Analiza un archivo de aportes (sueldos/fopid/aguinaldo) según su formato
async function analyzeAportesFile(file: File, institutionId?: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isCSVFile(file)) {
    return analyzeAportesCSVPreview(buffer, file.name, institutionId);
  } else if (isExcelFile(file)) {
    return analyzeAportesExcelPreview(buffer, file.name, institutionId);
  } else {
    // PDF - usar análisis con IA
    return analyzeAportesPreview(buffer, file.name, institutionId);
  }
}

export const POST: RequestHandler = async (event) => {
  const auth = await requireAuth(event);
  if (auth.error) {
    return json({ error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const contentType = event.request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
    }

    const formData = await event.request.formData();
    const selectedPeriodRaw = formData.get('selectedPeriod') as string | null;
    const institutionIdRaw = formData.get('institutionId') as string | null;
    const institutionId = institutionIdRaw || undefined;

    // Validar período seleccionado
    if (!selectedPeriodRaw || !/^\d{4}-\d{2}$/.test(selectedPeriodRaw)) {
      return json({
        error: 'Debe seleccionar el período (mes/año) antes de analizar',
        message: 'Período inválido o no proporcionado'
      }, { status: 400 });
    }

    // Obtener archivos por slot
    const fileSueldos = formData.get('file_sueldos') as File | null;
    const fileFopid = formData.get('file_fopid') as File | null;
    const fileAguinaldo = formData.get('file_aguinaldo') as File | null;
    const fileTransferencia = formData.get('file_transferencia') as File | null;

    // Validar que al menos sueldos y transferencia existan
    if (!fileSueldos || !(fileSueldos instanceof File)) {
      return json({ error: 'Se requiere el archivo de Aportes Sueldos' }, { status: 400 });
    }
    if (!fileTransferencia || !(fileTransferencia instanceof File)) {
      return json({ error: 'Se requiere el archivo de Transferencia Bancaria' }, { status: 400 });
    }

    // Validar tamaño de archivos
    const allFiles = [fileSueldos, fileFopid, fileAguinaldo, fileTransferencia].filter((f): f is File => f instanceof File);
    for (const file of allFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return json({
          error: `El archivo "${file.name}" excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`
        }, { status: 413 });
      }
    }

    // Crear sessionId
    const { createHash } = await import('node:crypto');
    const sessionId = createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex').substring(0, 16);

    // Inicializar resultado
    const batchResult: BatchPreviewResult = {
      sessionId,
      previews: {},
      validation: { totalAportes: 0, totalTransferencia: 0, diferencia: 0, coinciden: false, porcentajeDiferencia: 0, warnings: [] },
      allFilesValid: true
    };

    // Procesar cada archivo en paralelo
    const [sueldosResult, fopidResult, aguinaldoResult, transferenciaResult] = await Promise.all([
      analyzeAportesFile(fileSueldos, institutionId),
      fileFopid instanceof File ? analyzeAportesFile(fileFopid, institutionId) : null,
      fileAguinaldo instanceof File ? analyzeAportesFile(fileAguinaldo, institutionId) : null,
      (async () => {
        const buffer = Buffer.from(await fileTransferencia.arrayBuffer());
        return analyzeTransferenciaPreview(buffer, fileTransferencia.name, institutionId);
      })()
    ]);

    // Asignar resultados a sus slots
    batchResult.previews.sueldos = sueldosResult;
    if (!sueldosResult.success) batchResult.allFilesValid = false;

    if (fopidResult) {
      batchResult.previews.fopid = fopidResult;
      if (!fopidResult.success) batchResult.allFilesValid = false;
    }

    if (aguinaldoResult) {
      batchResult.previews.aguinaldo = aguinaldoResult;
      if (!aguinaldoResult.success) batchResult.allFilesValid = false;
    }

    batchResult.previews.transferencia = transferenciaResult;
    if (!transferenciaResult.success) batchResult.allFilesValid = false;

    // Calcular validación de totales
    const { sumarMontos, diferenciaMonto, calcularTolerancia, porcentajeMonto } = await import('$lib/utils/currency.js');

    const montosAportes: number[] = [];
    for (const key of ['sueldos', 'fopid', 'aguinaldo'] as const) {
      const preview = batchResult.previews[key];
      if (preview && preview.success && preview.type === 'APORTES') {
        montosAportes.push((preview as AportesPreviewResult).totalAmount);
      }
    }

    const totalAportes = sumarMontos(...montosAportes);
    let totalTransferencia = 0;
    if (transferenciaResult.success && transferenciaResult.type === 'TRANSFERENCIA') {
      totalTransferencia = (transferenciaResult as TransferenciaPreviewResult).transferAmount;
    }

    const diferencia = diferenciaMonto(totalAportes, totalTransferencia);
    const montoMayor = Math.max(totalAportes, totalTransferencia);
    const tolerancia = calcularTolerancia(montoMayor, 0.001, 1);
    const coinciden = diferencia <= tolerancia;
    const porcentajeDif = porcentajeMonto(diferencia, montoMayor);

    batchResult.validation = {
      totalAportes,
      totalTransferencia,
      diferencia,
      coinciden,
      porcentajeDiferencia: porcentajeDif,
      warnings: []
    };

    if (!coinciden) {
      batchResult.validation.warnings.push(`Los totales no coinciden. Diferencia: $${diferencia.toFixed(2)} (${porcentajeDif.toFixed(2)}%)`);
    }

    // Advertencia si la cantidad de personas difiere entre archivos
    const personCounts: Record<string, number> = {};
    for (const key of ['sueldos', 'fopid', 'aguinaldo'] as const) {
      const preview = batchResult.previews[key];
      if (preview && preview.success && preview.type === 'APORTES') {
        personCounts[key] = (preview as AportesPreviewResult).peopleCount;
      }
    }
    const counts = Object.values(personCounts);
    if (counts.length > 1 && !counts.every(c => c === counts[0])) {
      const details = Object.entries(personCounts).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v} personas`).join(', ');
      batchResult.validation.warnings.push(`Se detectaron diferencias en la cantidad de personas entre archivos. ${details}`);
    }

    batchResult.allFilesValid = batchResult.allFilesValid && coinciden;

    return json(batchResult, { status: 200 });

  } catch (error) {
    console.error('[PREVIEW] Error en análisis:', error);

    return json({
      error: 'Error al analizar los archivos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
