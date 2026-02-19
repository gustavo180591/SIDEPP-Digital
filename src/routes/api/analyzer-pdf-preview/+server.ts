/**
 * Endpoint de Preview para análisis de PDFs
 *
 * Este endpoint analiza los archivos SIN guardar nada.
 * Retorna un preview con los datos extraídos para que el usuario
 * pueda validar antes de confirmar el guardado.
 *
 * POST /api/analyzer-pdf-preview
 *
 * Request: FormData con:
 *   - files: File[] (archivos PDF)
 *   - selectedPeriod: string (formato "YYYY-MM")
 *   - institutionId?: string (opcional, se detecta del PDF si no se proporciona)
 *
 * Response: BatchPreviewResult
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/middleware';
import { CONFIG } from '$lib/server/config';
import {
  analyzeAportesPreview,
  analyzeTransferenciaPreview,
  analyzeBatchPreview,
  analyzeAportesCSVPreview,
  analyzeAportesExcelPreview,
  type FilePreviewInput,
  type BatchPreviewResult,
  type AportesPreviewResult,
  type TransferenciaPreviewResult
} from '$lib/server/analyzer/preview';

const { MAX_FILE_SIZE } = CONFIG;

// Detecta si el archivo es CSV (texto plano separado por delimitador)
function isCSVFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')
    || file.type === 'text/csv' || file.type === 'text/tab-separated-values';
}

// Detecta si el archivo es Excel (.xlsx, .xls)
function isExcelFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || file.type === 'application/vnd.ms-excel';
}

// Función para detectar el tipo de archivo basándose en el nombre y contenido
function detectFileType(fileName: string): 'APORTES' | 'TRANSFERENCIA' | 'UNKNOWN' {
  const lowerName = fileName.toLowerCase();

  // Patrones de listados/aportes primero (más específicos)
  if (
    lowerName.includes('listado') ||
    lowerName.includes('aporte') ||
    lowerName.includes('fopid') ||
    lowerName.includes('sueldo') ||
    lowerName.includes('haberes') ||
    lowerName.includes('aguinaldo') ||
    lowerName.includes('concepto') ||
    /^\d{4}\s*-\s*listado/i.test(lowerName)
  ) {
    return 'APORTES';
  }

  // Patrones de transferencias (sin 'sidep' que es demasiado genérico)
  if (
    lowerName.includes('transfer') ||
    lowerName.includes('comprobante') ||
    lowerName.includes('cbu') ||
    /^\d{4}\s*-\s*sidep/i.test(lowerName)
  ) {
    return 'TRANSFERENCIA';
  }

  // Si no podemos determinar por el nombre, asumimos que es un listado
  // (más común) y dejamos que el análisis determine si es transferencia
  return 'UNKNOWN';
}

export const POST: RequestHandler = async (event) => {
  // Requerir autenticación
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

    // Validar período seleccionado
    if (!selectedPeriodRaw || !/^\d{4}-\d{2}$/.test(selectedPeriodRaw)) {
      return json({
        error: 'Debe seleccionar el período (mes/año) antes de analizar',
        message: 'Período inválido o no proporcionado'
      }, { status: 400 });
    }

    // Parsear período
    const [year, month] = selectedPeriodRaw.split('-').map(Number);

    // Obtener todos los archivos
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    }

    // También verificar si hay un array de archivos
    const filesArray = formData.getAll('files');
    for (const file of filesArray) {
      if (file instanceof File) {
        files.push(file);
      }
    }

    if (files.length === 0) {
      return json({ error: 'No se proporcionaron archivos' }, { status: 400 });
    }

    // Validar tamaño de archivos
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return json({
          error: `El archivo "${file.name}" excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`
        }, { status: 413 });
      }
    }

    // Separar archivos por tipo: CSV, Excel, PDF
    const csvFiles: { buffer: Buffer; fileName: string }[] = [];
    const excelFiles: { buffer: Buffer; fileName: string }[] = [];
    const pdfFiles: { file: File; buffer: Buffer }[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (isCSVFile(file)) {
        csvFiles.push({ buffer, fileName: file.name });
      } else if (isExcelFile(file)) {
        excelFiles.push({ buffer, fileName: file.name });
      } else {
        pdfFiles.push({ file, buffer });
      }
    }

    // Convertir PDFs a FilePreviewInput[]
    const fileInputs: FilePreviewInput[] = [];

    for (const { file, buffer } of pdfFiles) {
      const detectedType = detectFileType(file.name);

      let finalType: 'APORTES' | 'TRANSFERENCIA' = 'APORTES';

      if (detectedType === 'TRANSFERENCIA') {
        finalType = 'TRANSFERENCIA';
      } else if (detectedType === 'UNKNOWN') {
        finalType = 'APORTES';
      }

      fileInputs.push({
        buffer,
        fileName: file.name,
        type: finalType
      });
    }

    // Analizar PDFs con el batch (si hay PDFs)
    let batchResult: BatchPreviewResult;

    if (fileInputs.length > 0) {
      batchResult = await analyzeBatchPreview(
        fileInputs,
        selectedPeriodRaw,
        institutionIdRaw || undefined
      );
    } else {
      // Solo CSVs/Excel, crear batch result vacío
      const { createHash } = await import('node:crypto');
      batchResult = {
        sessionId: createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 16),
        previews: {},
        validation: { totalAportes: 0, totalTransferencia: 0, diferencia: 0, coinciden: false, porcentajeDiferencia: 0, warnings: [] },
        allFilesValid: true
      };
    }

    // Procesar archivos CSV de aportes e inyectar en el resultado
    for (const csv of csvFiles) {
      const csvResult = await analyzeAportesCSVPreview(csv.buffer, csv.fileName, institutionIdRaw || undefined);

      // Asignar al slot disponible
      if (csvResult.success && csvResult.type === 'APORTES') {
        const conceptType = (csvResult as AportesPreviewResult).conceptType;
        if (conceptType === 'FOPID' && !batchResult.previews.fopid) {
          batchResult.previews.fopid = csvResult;
        } else if (!batchResult.previews.sueldos) {
          batchResult.previews.sueldos = csvResult;
        } else if (!batchResult.previews.fopid) {
          batchResult.previews.fopid = csvResult;
        } else if (!batchResult.previews.aguinaldo) {
          batchResult.previews.aguinaldo = csvResult;
        }
      } else if (!csvResult.success) {
        // Error en CSV - asignar al primer slot disponible
        if (!batchResult.previews.sueldos) {
          batchResult.previews.sueldos = csvResult;
        } else if (!batchResult.previews.fopid) {
          batchResult.previews.fopid = csvResult;
        }
        batchResult.allFilesValid = false;
      }
    }

    // Procesar archivos Excel de aportes e inyectar en el resultado
    for (const excel of excelFiles) {
      const excelResult = await analyzeAportesExcelPreview(excel.buffer, excel.fileName, institutionIdRaw || undefined);

      if (excelResult.success && excelResult.type === 'APORTES') {
        const conceptType = (excelResult as AportesPreviewResult).conceptType;
        if (conceptType === 'FOPID' && !batchResult.previews.fopid) {
          batchResult.previews.fopid = excelResult;
        } else if (!batchResult.previews.sueldos) {
          batchResult.previews.sueldos = excelResult;
        } else if (!batchResult.previews.fopid) {
          batchResult.previews.fopid = excelResult;
        } else if (!batchResult.previews.aguinaldo) {
          batchResult.previews.aguinaldo = excelResult;
        }
      } else if (!excelResult.success) {
        if (!batchResult.previews.sueldos) {
          batchResult.previews.sueldos = excelResult;
        } else if (!batchResult.previews.fopid) {
          batchResult.previews.fopid = excelResult;
        }
        batchResult.allFilesValid = false;
      }
    }

    // Recalcular validación si hubo CSVs o Excel
    if (csvFiles.length > 0 || excelFiles.length > 0) {
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
      if (batchResult.previews.transferencia?.success && batchResult.previews.transferencia.type === 'TRANSFERENCIA') {
        totalTransferencia = (batchResult.previews.transferencia as TransferenciaPreviewResult).transferAmount;
      }

      const diferencia = diferenciaMonto(totalAportes, totalTransferencia);
      const montoMayor = Math.max(totalAportes, totalTransferencia);
      const tolerancia = calcularTolerancia(montoMayor, 0.001, 1);
      const coinciden = diferencia <= tolerancia;
      const porcentajeDif = porcentajeMonto(diferencia, montoMayor);

      batchResult.validation = {
        ...batchResult.validation,
        totalAportes,
        totalTransferencia,
        diferencia,
        coinciden,
        porcentajeDiferencia: porcentajeDif
      };

      if (!coinciden && !batchResult.validation.warnings.some(w => w.includes('no coinciden'))) {
        batchResult.validation.warnings.push(`Los totales no coinciden. Diferencia: $${diferencia.toFixed(2)} (${porcentajeDif.toFixed(2)}%)`);
      }

      batchResult.allFilesValid = batchResult.allFilesValid && coinciden;
    }

    return json(batchResult, { status: 200 });

  } catch (error) {
    console.error('[PREVIEW] Error en análisis:', error);

    return json({
      error: 'Error al analizar los archivos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
