/**
 * Módulo de Preview para análisis de PDFs
 *
 * Este módulo analiza PDFs SIN guardar nada en la base de datos ni en disco.
 * Retorna los datos extraídos para que el frontend pueda mostrar un preview
 * y el usuario decida si confirmar el guardado.
 */

import { createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { prisma } from '$lib/server/db';
import { analyzeAportesIA, analyzeTransferenciaIA } from '$lib/utils/analyzer-pdf-ia/index.js';
import type { ListadoPDFResult, TransferenciaPDFResult, MultiTransferenciaPDFResult } from '$lib/utils/analyzer-pdf-ia/types/index.js';

// ============================================================================
// TIPOS
// ============================================================================

export interface FilePreviewInput {
  buffer: Buffer;
  fileName: string;
  type: 'APORTES' | 'TRANSFERENCIA';
}

export interface AportesPreviewResult {
  success: true;
  type: 'APORTES';
  fileName: string;
  bufferHash: string;
  bufferBase64: string; // Para enviar al confirm
  isDuplicate: boolean;
  duplicateInfo?: {
    pdfFileId: string;
    existingFileName: string;
  };
  analysis: ListadoPDFResult;
  institution: {
    id: string;
    name: string | null;
    cuit: string | null;
  } | null;
  // Datos calculados
  peopleCount: number;
  totalAmount: number;
  conceptType: 'FOPID' | 'SUELDO' | 'DESCONOCIDO';
}

export interface TransferenciaPreviewResult {
  success: true;
  type: 'TRANSFERENCIA';
  fileName: string;
  bufferHash: string;
  bufferBase64: string;
  isDuplicate: boolean;
  duplicateInfo?: {
    pdfFileId: string;
    existingFileName: string;
  };
  analysis: TransferenciaPDFResult | MultiTransferenciaPDFResult;
  institution: {
    id: string;
    name: string | null;
    cuit: string | null;
  } | null;
  // Datos calculados
  transferAmount: number;
  isMultiple: boolean;
  transferCount: number;
}

export interface PreviewError {
  success: false;
  error: string;
  details?: string;
  fileName: string;
}

export type PreviewResult = AportesPreviewResult | TransferenciaPreviewResult | PreviewError;

export interface BatchPreviewResult {
  sessionId: string;
  previews: {
    sueldos?: PreviewResult;
    fopid?: PreviewResult;
    aguinaldo?: PreviewResult;
    transferencia?: PreviewResult;
  };
  validation: {
    totalAportes: number;
    totalTransferencia: number;
    diferencia: number;
    coinciden: boolean;
    porcentajeDiferencia: number;
    warnings: string[];
  };
  allFilesValid: boolean;
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Detecta el tipo de concepto (FOPID o SUELDO) basado en el análisis
 */
function detectConceptType(analysis: ListadoPDFResult): 'FOPID' | 'SUELDO' | 'DESCONOCIDO' {
  const concepto = analysis.concepto?.toLowerCase() || '';

  if (concepto.includes('fopid') || concepto.includes('fondo permanente')) {
    return 'FOPID';
  }

  if (concepto.includes('sueldo') || concepto.includes('haberes') || concepto.includes('remuneración')) {
    return 'SUELDO';
  }

  // Intentar detectar por el tipo de documento
  if (analysis.tipo === 'LISTADO_APORTES') {
    // Si es un listado sin concepto claro, asumimos SUELDO
    return 'SUELDO';
  }

  return 'DESCONOCIDO';
}

/**
 * Formatea un CUIT de 11 dígitos al formato XX-XXXXXXXX-X
 */
function formatCuit(cuitDigits: string | null): string | null {
  if (!cuitDigits) return null;
  const digits = cuitDigits.replace(/\D/g, '');
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/**
 * Busca una institución por CUIT
 */
async function findInstitutionByCuit(cuit: string | null): Promise<{
  id: string;
  name: string | null;
  cuit: string | null;
} | null> {
  if (!cuit) return null;

  const digits = cuit.replace(/\D/g, '');
  const formattedCuit = formatCuit(digits);

  // Buscar con formato con guiones
  let institution = await prisma.institution.findUnique({
    where: { cuit: formattedCuit ?? undefined },
    select: { id: true, name: true, cuit: true }
  });

  // Fallback: buscar sin guiones
  if (!institution && digits.length === 11) {
    institution = await prisma.institution.findUnique({
      where: { cuit: digits },
      select: { id: true, name: true, cuit: true }
    });
  }

  return institution;
}

/**
 * Verifica si un archivo ya existe en la BD por su hash
 */
async function checkDuplicate(bufferHash: string): Promise<{
  isDuplicate: boolean;
  duplicateInfo?: { pdfFileId: string; existingFileName: string };
}> {
  const existing = await prisma.pdfFile.findUnique({
    where: { bufferHash },
    select: { id: true, fileName: true }
  });

  if (existing) {
    return {
      isDuplicate: true,
      duplicateInfo: {
        pdfFileId: existing.id,
        existingFileName: existing.fileName
      }
    };
  }

  return { isDuplicate: false };
}

// ============================================================================
// FUNCIONES PRINCIPALES DE PREVIEW
// ============================================================================

/**
 * Analiza un PDF de aportes sin guardar nada
 */
export async function analyzeAportesPreview(
  buffer: Buffer,
  fileName: string
): Promise<AportesPreviewResult | PreviewError> {
  try {
    console.log(`[analyzeAportesPreview] Iniciando análisis de: ${fileName}`);

    // Validar que es un PDF
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || detected.mime !== 'application/pdf') {
      return {
        success: false,
        error: 'Solo se permiten archivos PDF',
        fileName
      };
    }

    // Calcular hash
    const bufferHash = createHash('sha256').update(buffer).digest('hex');
    console.log(`[analyzeAportesPreview] Hash: ${bufferHash}`);

    // Verificar duplicado
    const duplicateCheck = await checkDuplicate(bufferHash);

    // Analizar con IA
    console.log(`[analyzeAportesPreview] Analizando con IA...`);
    const analysis = await analyzeAportesIA(buffer, fileName);
    console.log(`[analyzeAportesPreview] Análisis completado:`, {
      tipo: analysis.tipo,
      escuela: analysis.escuela?.nombre,
      personas: analysis.personas?.length,
      montoTotal: analysis.totales?.montoTotal
    });

    // Buscar institución
    const cuit = analysis.escuela?.cuit;
    const institution = await findInstitutionByCuit(cuit);

    if (!institution) {
      return {
        success: false,
        error: `No existe una institución con CUIT ${formatCuit(cuit) || cuit}. Debe cargarla primero.`,
        details: `CUIT detectado: ${cuit}`,
        fileName
      };
    }

    // Detectar tipo de concepto
    const conceptType = detectConceptType(analysis);

    return {
      success: true,
      type: 'APORTES',
      fileName,
      bufferHash,
      bufferBase64: buffer.toString('base64'),
      ...duplicateCheck,
      analysis,
      institution,
      peopleCount: analysis.totales?.cantidadPersonas || analysis.personas?.length || 0,
      totalAmount: analysis.totales?.montoTotal || 0,
      conceptType
    };

  } catch (error) {
    console.error(`[analyzeAportesPreview] Error:`, error);
    return {
      success: false,
      error: 'Error al analizar el PDF de aportes',
      details: error instanceof Error ? error.message : 'Error desconocido',
      fileName
    };
  }
}

/**
 * Analiza un PDF de transferencia sin guardar nada
 */
export async function analyzeTransferenciaPreview(
  buffer: Buffer,
  fileName: string
): Promise<TransferenciaPreviewResult | PreviewError> {
  try {
    console.log(`[analyzeTransferenciaPreview] Iniciando análisis de: ${fileName}`);

    // Validar que es un PDF
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || detected.mime !== 'application/pdf') {
      return {
        success: false,
        error: 'Solo se permiten archivos PDF',
        fileName
      };
    }

    // Calcular hash
    const bufferHash = createHash('sha256').update(buffer).digest('hex');
    console.log(`[analyzeTransferenciaPreview] Hash: ${bufferHash}`);

    // Verificar duplicado
    const duplicateCheck = await checkDuplicate(bufferHash);

    // Analizar con IA
    console.log(`[analyzeTransferenciaPreview] Analizando con IA...`);
    const analysis = await analyzeTransferenciaIA(buffer, fileName);
    console.log(`[analyzeTransferenciaPreview] Análisis completado:`, {
      tipo: analysis.tipo
    });

    // Determinar importe y si son múltiples transferencias
    let transferAmount = 0;
    let isMultiple = false;
    let transferCount = 1;
    let cuit: string | null = null;

    if (analysis.tipo === 'TRANSFERENCIAS_MULTIPLES') {
      isMultiple = true;
      transferCount = analysis.resumen?.cantidadTransferencias || analysis.transferencias?.length || 0;
      transferAmount = analysis.resumen?.importeTotal || 0;
      // Usar CUIT del primer ordenante
      cuit = analysis.transferencias?.[0]?.ordenante?.cuit || null;
    } else {
      transferAmount = analysis.operacion?.importe || 0;
      cuit = analysis.ordenante?.cuit || null;
    }

    // Buscar institución por CUIT del ordenante
    const institution = await findInstitutionByCuit(cuit);

    if (!institution) {
      return {
        success: false,
        error: `No existe una institución con CUIT ${formatCuit(cuit) || cuit}. Debe cargarla primero.`,
        details: `CUIT del ordenante detectado: ${cuit}`,
        fileName
      };
    }

    return {
      success: true,
      type: 'TRANSFERENCIA',
      fileName,
      bufferHash,
      bufferBase64: buffer.toString('base64'),
      ...duplicateCheck,
      analysis,
      institution,
      transferAmount,
      isMultiple,
      transferCount
    };

  } catch (error) {
    console.error(`[analyzeTransferenciaPreview] Error:`, error);
    return {
      success: false,
      error: 'Error al analizar el PDF de transferencia',
      details: error instanceof Error ? error.message : 'Error desconocido',
      fileName
    };
  }
}

/**
 * Analiza múltiples archivos y genera un preview batch con validación cruzada
 */
export async function analyzeBatchPreview(
  files: FilePreviewInput[],
  selectedPeriod: string,
  institutionId?: string
): Promise<BatchPreviewResult> {
  const sessionId = createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 16);

  console.log(`[analyzeBatchPreview] Sesión: ${sessionId}`);
  console.log(`[analyzeBatchPreview] Período: ${selectedPeriod}`);
  console.log(`[analyzeBatchPreview] Archivos: ${files.length}`);

  const previews: BatchPreviewResult['previews'] = {};
  const warnings: string[] = [];
  let allFilesValid = true;

  // Procesar cada archivo
  for (const file of files) {
    console.log(`[analyzeBatchPreview] Procesando: ${file.fileName} (${file.type})`);

    let result: PreviewResult;

    if (file.type === 'APORTES') {
      result = await analyzeAportesPreview(file.buffer, file.fileName);

      if (result.success) {
        // Determinar a qué slot corresponde basándose en el concepto
        const conceptType = (result as AportesPreviewResult).conceptType;

        if (conceptType === 'FOPID') {
          previews.fopid = result;
        } else if (conceptType === 'SUELDO') {
          // Verificar si ya hay uno de sueldos (podría ser aguinaldo)
          if (previews.sueldos) {
            previews.aguinaldo = result;
          } else {
            previews.sueldos = result;
          }
        } else {
          // Sin concepto claro, asignar al primer slot disponible
          if (!previews.sueldos) {
            previews.sueldos = result;
          } else if (!previews.fopid) {
            previews.fopid = result;
          } else {
            previews.aguinaldo = result;
          }
        }
      } else {
        allFilesValid = false;
        // Guardar error en el slot más probable
        if (!previews.sueldos) {
          previews.sueldos = result;
        } else if (!previews.fopid) {
          previews.fopid = result;
        }
      }

    } else if (file.type === 'TRANSFERENCIA') {
      result = await analyzeTransferenciaPreview(file.buffer, file.fileName);
      previews.transferencia = result;

      if (!result.success) {
        allFilesValid = false;
      }
    }
  }

  // Calcular totales para validación
  let totalAportes = 0;
  let totalTransferencia = 0;

  // Sumar aportes de todos los listados válidos
  for (const key of ['sueldos', 'fopid', 'aguinaldo'] as const) {
    const preview = previews[key];
    if (preview && preview.success && preview.type === 'APORTES') {
      totalAportes += (preview as AportesPreviewResult).totalAmount;
    }
  }

  // Obtener total de transferencia
  if (previews.transferencia?.success && previews.transferencia.type === 'TRANSFERENCIA') {
    totalTransferencia = (previews.transferencia as TransferenciaPreviewResult).transferAmount;
  }

  // Calcular diferencia
  const diferencia = Math.abs(totalAportes - totalTransferencia);
  const porcentajeDiferencia = totalTransferencia > 0
    ? (diferencia / totalTransferencia) * 100
    : (totalAportes > 0 ? 100 : 0);

  // Determinar si coinciden (tolerancia de $0.50)
  const coinciden = diferencia <= 0.5;

  // Generar warnings
  if (!coinciden) {
    warnings.push(`Los totales no coinciden. Diferencia: $${diferencia.toFixed(2)} (${porcentajeDiferencia.toFixed(2)}%)`);
  }

  // Verificar duplicados
  for (const [key, preview] of Object.entries(previews)) {
    if (preview && preview.success && 'isDuplicate' in preview && preview.isDuplicate) {
      warnings.push(`El archivo ${preview.fileName} ya fue cargado anteriormente.`);
    }
  }

  // Verificar que todas las instituciones coincidan
  const institutions = new Set<string>();
  for (const preview of Object.values(previews)) {
    if (preview && preview.success && 'institution' in preview && preview.institution) {
      institutions.add(preview.institution.id);
    }
  }

  if (institutions.size > 1) {
    warnings.push('Los archivos corresponden a diferentes instituciones.');
    allFilesValid = false;
  }

  return {
    sessionId,
    previews,
    validation: {
      totalAportes,
      totalTransferencia,
      diferencia,
      coinciden,
      porcentajeDiferencia,
      warnings
    },
    allFilesValid: allFilesValid && coinciden
  };
}
