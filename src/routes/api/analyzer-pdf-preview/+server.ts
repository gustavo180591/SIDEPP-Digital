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
  type FilePreviewInput,
  type BatchPreviewResult,
  type AportesPreviewResult,
  type TransferenciaPreviewResult
} from '$lib/server/analyzer/preview';

const { MAX_FILE_SIZE } = CONFIG;

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

    // Convertir a FilePreviewInput[]
    const fileInputs: FilePreviewInput[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const detectedType = detectFileType(file.name);

      // Si el tipo es desconocido, intentamos analizarlo primero como aportes
      // y si falla, como transferencia
      let finalType: 'APORTES' | 'TRANSFERENCIA' = 'APORTES';

      if (detectedType === 'TRANSFERENCIA') {
        finalType = 'TRANSFERENCIA';
      } else if (detectedType === 'UNKNOWN') {
        // Intentar detectar por contenido analizando las primeras líneas
        // Por ahora asumimos APORTES como default
        finalType = 'APORTES';
      }

      fileInputs.push({
        buffer,
        fileName: file.name,
        type: finalType
      });
    }

    // Analizar todos los archivos
    const batchResult = await analyzeBatchPreview(
      fileInputs,
      selectedPeriodRaw,
      institutionIdRaw || undefined
    );

    return json(batchResult, { status: 200 });

  } catch (error) {
    console.error('[PREVIEW] Error en análisis:', error);

    return json({
      error: 'Error al analizar los archivos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
