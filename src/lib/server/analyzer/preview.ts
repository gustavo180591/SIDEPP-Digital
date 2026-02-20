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
import { formatCuit, normalizeCuit } from '$lib/utils/cuit-utils.js';
import { parseAportesCSV, parseAportesExcel } from './csv-parser.js';

// ============================================================================
// TIPOS
// ============================================================================

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
 * Busca una institución por CUIT
 */
async function findInstitutionByCuit(cuit: string | null): Promise<{
  id: string;
  name: string | null;
  cuit: string | null;
} | null> {
  if (!cuit) return null;

  // Usar utilidades centralizadas de CUIT
  const digits = normalizeCuit(cuit);
  const formattedCuit = formatCuit(cuit);

  // Buscar con formato con guiones
  let institution = await prisma.institution.findUnique({
    where: { cuit: formattedCuit ?? undefined },
    select: { id: true, name: true, cuit: true }
  });

  // Fallback: buscar sin guiones
  if (!institution && digits && digits.length === 11) {
    institution = await prisma.institution.findUnique({
      where: { cuit: digits },
      select: { id: true, name: true, cuit: true }
    });
  }

  return institution;
}

/**
 * Busca una institución por ID
 */
async function findInstitutionById(id: string): Promise<{
  id: string;
  name: string | null;
  cuit: string | null;
} | null> {
  if (!id) return null;
  return prisma.institution.findUnique({
    where: { id },
    select: { id: true, name: true, cuit: true }
  });
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
  fileName: string,
  fallbackInstitutionId?: string
): Promise<AportesPreviewResult | PreviewError> {
  try {

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

    // Verificar duplicado
    const duplicateCheck = await checkDuplicate(bufferHash);

    // Analizar con IA
    const analysis = await analyzeAportesIA(buffer, fileName);

    // Buscar institución: primero por CUIT del PDF, luego fallback por ID del formulario
    const cuit = analysis.escuela?.cuit;
    let institution = await findInstitutionByCuit(cuit);

    if (!institution && fallbackInstitutionId) {
      institution = await findInstitutionById(fallbackInstitutionId);
    }

    if (!institution) {
      return {
        success: false,
        error: `No se pudo determinar la institución. CUIT detectado: ${formatCuit(cuit) || cuit || 'ninguno'}.`,
        details: `Verifique que la institución esté cargada en el sistema.`,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`[analyzeAportesPreview] Error para ${fileName}:`, errorMessage, errorStack);
    return {
      success: false,
      error: 'Error al analizar el PDF de aportes',
      details: errorMessage,
      fileName
    };
  }
}

/**
 * Analiza un PDF de transferencia sin guardar nada
 */
export async function analyzeTransferenciaPreview(
  buffer: Buffer,
  fileName: string,
  fallbackInstitutionId?: string
): Promise<TransferenciaPreviewResult | PreviewError> {
  try {

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

    // Verificar duplicado
    const duplicateCheck = await checkDuplicate(bufferHash);

    // Analizar con IA
    const analysis = await analyzeTransferenciaIA(buffer, fileName);

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

    // Buscar institución: primero por CUIT del ordenante, luego fallback por ID del formulario
    let institution = await findInstitutionByCuit(cuit);

    if (!institution && fallbackInstitutionId) {
      institution = await findInstitutionById(fallbackInstitutionId);
    }

    if (!institution) {
      return {
        success: false,
        error: `No se pudo determinar la institución. CUIT del ordenante: ${formatCuit(cuit) || cuit || 'no detectado'}.`,
        details: `Verifique que la institución esté cargada en el sistema.`,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`[analyzeTransferenciaPreview] Error para ${fileName}:`, errorMessage, errorStack);
    return {
      success: false,
      error: 'Error al analizar el PDF de transferencia',
      details: errorMessage,
      fileName
    };
  }
}

/**
 * Analiza un archivo CSV de aportes sin guardar nada
 */
export async function analyzeAportesCSVPreview(
  buffer: Buffer,
  fileName: string,
  fallbackInstitutionId?: string
): Promise<AportesPreviewResult | PreviewError> {
  try {
    // Calcular hash
    const bufferHash = createHash('sha256').update(buffer).digest('hex');

    // Verificar duplicado
    const duplicateCheck = await checkDuplicate(bufferHash);

    // Parsear CSV
    const analysis = parseAportesCSV(buffer, fileName);

    // Buscar institución por fallback (CSV no tiene CUIT)
    let institution: { id: string; name: string | null; cuit: string | null } | null = null;
    if (fallbackInstitutionId) {
      institution = await findInstitutionById(fallbackInstitutionId);
    }

    if (!institution) {
      return {
        success: false,
        error: 'No se pudo determinar la institución para el CSV. Seleccione una institución en el formulario.',
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[analyzeAportesCSVPreview] Error para ${fileName}:`, errorMessage);
    return {
      success: false,
      error: 'Error al procesar el CSV de aportes',
      details: errorMessage,
      fileName
    };
  }
}

/**
 * Analiza un archivo Excel (.xlsx) de aportes sin guardar nada
 */
export async function analyzeAportesExcelPreview(
  buffer: Buffer,
  fileName: string,
  fallbackInstitutionId?: string
): Promise<AportesPreviewResult | PreviewError> {
  try {
    const bufferHash = createHash('sha256').update(buffer).digest('hex');
    const duplicateCheck = await checkDuplicate(bufferHash);

    const analysis = parseAportesExcel(buffer, fileName);

    let institution: { id: string; name: string | null; cuit: string | null } | null = null;
    if (fallbackInstitutionId) {
      institution = await findInstitutionById(fallbackInstitutionId);
    }

    if (!institution) {
      return {
        success: false,
        error: 'No se pudo determinar la institución para el Excel. Seleccione una institución en el formulario.',
        fileName
      };
    }

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[analyzeAportesExcelPreview] Error para ${fileName}:`, errorMessage);
    return {
      success: false,
      error: 'Error al procesar el Excel de aportes',
      details: errorMessage,
      fileName
    };
  }
}
