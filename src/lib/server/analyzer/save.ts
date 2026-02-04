/**
 * Módulo de Guardado Atómico para PDFs
 *
 * Este módulo guarda todos los datos de una sesión de preview en una transacción atómica.
 * Si algo falla, se hace rollback automático de todo.
 *
 * Los archivos se guardan en disco y su storagePath se persiste en la DB.
 * No se usa hash-index.json - la DB es la fuente de verdad.
 */

import { prisma } from '$lib/server/db';
import { saveAnalyzerFile, deleteFile } from '$lib/server/storage';
import type { AportesPreviewResult, TransferenciaPreviewResult } from './preview';
import type { ListadoPDFResult } from '$lib/utils/analyzer-pdf-ia/types/index.js';

// ============================================================================
// TIPOS
// ============================================================================

export interface SaveAportesInput {
  preview: AportesPreviewResult;
  selectedPeriod: { month: number; year: number };
  institutionId: string;
}

export interface SaveTransferenciaInput {
  preview: TransferenciaPreviewResult;
  selectedPeriod: { month: number; year: number };
  institutionId: string;
}

export interface BatchSaveInput {
  previews: {
    sueldos?: AportesPreviewResult;
    fopid?: AportesPreviewResult;
    aguinaldo?: AportesPreviewResult;
    transferencia?: TransferenciaPreviewResult;
  };
  selectedPeriod: { month: number; year: number };
  institutionId: string;
  forceConfirm?: boolean;
}

export interface SaveResult {
  success: boolean;
  error?: string;
  details?: string;
}

export interface BatchSaveResult {
  success: boolean;
  error?: string;
  details?: string;
  periodId: string | null;
  savedFiles: {
    sueldos?: { pdfFileId: string; contributionLineCount: number };
    fopid?: { pdfFileId: string; contributionLineCount: number };
    aguinaldo?: { pdfFileId: string; contributionLineCount: number };
    transferencia?: { pdfFileId: string; bankTransferId: string };
  };
}

// Tipo para el cliente de transacción de Prisma
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Busca un miembro por nombre dentro de una institución
 */
async function findMemberByName(
  institutionId: string,
  fullName: string,
  tx: TransactionClient
): Promise<{ id: string } | null> {
  const m = await tx.member.findFirst({
    where: {
      institucionId: institutionId,
      fullName: { equals: fullName, mode: 'insensitive' }
    }
  });
  return m ? { id: m.id } : null;
}

/**
 * Detecta si un error de Prisma es por violación de constraint unique (P2002)
 */
function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE GUARDADO BATCH
// ============================================================================

/**
 * Guarda todos los datos de una sesión de preview en una transacción atómica.
 *
 * Flujo:
 * 1. Guardar archivos en disco (con UUID para evitar colisiones)
 * 2. Crear registros en DB con storagePath (dentro de transacción Prisma)
 * 3. Si la transacción falla, limpiar archivos del disco
 */
export async function saveBatchAtomic(input: BatchSaveInput): Promise<BatchSaveResult> {
  const { previews, selectedPeriod, institutionId } = input;

        
  // Archivos físicos guardados (para cleanup en caso de error)
  const savedFilePaths: string[] = [];

  try {
    // Usar transacción de Prisma para atomicidad en DB
    const result = await prisma.$transaction(async (tx) => {
      const savedFiles: BatchSaveResult['savedFiles'] = {};
      let periodId: string | null = null;

      // 1. Buscar o crear PayrollPeriod
            let period = await tx.payrollPeriod.findFirst({
        where: {
          institutionId,
          month: selectedPeriod.month,
          year: selectedPeriod.year
        }
      });

      if (!period) {
        const fallbackTransferId = `batch-${Date.now()}`;
        period = await tx.payrollPeriod.create({
          data: {
            institution: { connect: { id: institutionId } },
            month: selectedPeriod.month,
            year: selectedPeriod.year,
            transferId: fallbackTransferId
          }
        });
      } else {
      }

      periodId = period.id;

      // 2. Guardar archivos de aportes (sueldos, fopid, aguinaldo)
      for (const [key, preview] of Object.entries(previews)) {
        if (!preview || !preview.success) continue;

        if (preview.type === 'APORTES') {
          const aportesResult = await saveAportesFile(
            preview as AportesPreviewResult,
            periodId,
            institutionId,
            savedFilePaths,
            tx
          );

          savedFiles[key as 'sueldos' | 'fopid' | 'aguinaldo'] = aportesResult;
        }
      }

      // 3. Guardar transferencia
      if (previews.transferencia?.success && previews.transferencia.type === 'TRANSFERENCIA') {
        const transferResult = await saveTransferenciaFile(
          previews.transferencia as TransferenciaPreviewResult,
          periodId,
          savedFilePaths,
          tx
        );

        savedFiles.transferencia = transferResult;
      }

      return { periodId, savedFiles };
    }, {
      timeout: 60000
    });


    return {
      success: true,
      periodId: result.periodId,
      savedFiles: result.savedFiles
    };

  } catch (error) {
    console.error('[saveBatchAtomic] Error en transacción, ejecutando cleanup...');

    // Limpiar archivos físicos guardados
    for (const filePath of savedFilePaths) {
      const deleted = await deleteFile(filePath);
      if (deleted) {
      }
    }

    // Detectar error de duplicado (bufferHash unique constraint)
    if (isPrismaUniqueConstraintError(error)) {
      return {
        success: false,
        error: 'Archivo duplicado detectado',
        details: 'Este archivo ya fue cargado anteriormente. Si necesita recargarlo, primero elimine el archivo existente.',
        periodId: null,
        savedFiles: {}
      };
    }

    return {
      success: false,
      error: 'Error al guardar los datos',
      details: error instanceof Error ? error.message : 'Error desconocido',
      periodId: null,
      savedFiles: {}
    };
  }
}

/**
 * Guarda un archivo de aportes y sus contribution lines
 */
async function saveAportesFile(
  preview: AportesPreviewResult,
  periodId: string,
  institutionId: string,
  savedFilePaths: string[],
  tx: TransactionClient
): Promise<{ pdfFileId: string; contributionLineCount: number }> {
  // 1. Guardar archivo físico con UUID
  const buffer = Buffer.from(preview.bufferBase64, 'base64');
  const storagePath = await saveAnalyzerFile(buffer, preview.fileName);
  savedFilePaths.push(storagePath);

  // 2. Crear PdfFile en DB con storagePath
  const analysis = preview.analysis as ListadoPDFResult;

  const pdfFile = await tx.pdfFile.create({
    data: {
      fileName: preview.fileName,
      bufferHash: preview.bufferHash,
      storagePath,
      type: preview.conceptType === 'FOPID' ? 'FOPID' : 'SUELDO',
      concept: analysis.concepto || 'Aporte Sindical SIDEPP (1%)',
      peopleCount: preview.peopleCount,
      totalAmount: preview.totalAmount.toString(),
      period: { connect: { id: periodId } }
    }
  });

  // 3. Crear ContributionLines y Members
  let contributionLineCount = 0;

  if (analysis.personas && analysis.personas.length > 0) {
    for (const persona of analysis.personas) {
      const nombreUpperCase = persona.nombre.toUpperCase();

      // Buscar o crear miembro
      let member = await findMemberByName(institutionId, nombreUpperCase, tx);

      if (!member) {
        try {
          const createdMember = await tx.member.create({
            data: {
              institucion: { connect: { id: institutionId } },
              fullName: nombreUpperCase
            }
          });
          member = { id: createdMember.id };
        } catch (err: any) {
          // Race condition: buscar nuevamente
          if (err?.code === 'P2002') {
            member = await findMemberByName(institutionId, nombreUpperCase, tx);
          } else {
            throw err;
          }
        }
      }

      // Crear ContributionLine
      await tx.contributionLine.create({
        data: {
          name: nombreUpperCase,
          quantity: persona.cantidadLegajos,
          conceptAmount: persona.montoConcepto.toString(),
          totalRem: persona.totalRemunerativo.toString(),
          pdfFile: { connect: { id: pdfFile.id } },
          ...(member ? { member: { connect: { id: member.id } } } : {})
        }
      });
      contributionLineCount++;
    }
  }


  return { pdfFileId: pdfFile.id, contributionLineCount };
}

/**
 * Guarda un archivo de transferencia y crea el BankTransfer
 */
async function saveTransferenciaFile(
  preview: TransferenciaPreviewResult,
  periodId: string,
  savedFilePaths: string[],
  tx: TransactionClient
): Promise<{ pdfFileId: string; bankTransferId: string }> {
  // 1. Guardar archivo físico con UUID
  const buffer = Buffer.from(preview.bufferBase64, 'base64');
  const storagePath = await saveAnalyzerFile(buffer, preview.fileName);
  savedFilePaths.push(storagePath);

  // 2. Crear PdfFile en DB con storagePath
  const pdfFile = await tx.pdfFile.create({
    data: {
      fileName: preview.fileName,
      bufferHash: preview.bufferHash,
      storagePath,
      type: 'COMPROBANTE',
      concept: 'Transferencia Bancaria',
      totalAmount: preview.transferAmount.toString(),
      period: { connect: { id: periodId } }
    }
  });

  // 3. Crear BankTransfer
  const analysis = preview.analysis;

  let operacion: any;
  let ordenante: any;
  let nroReferencia: string | null = null;
  let nroOperacion: string | null = null;
  let fecha: string | null = null;
  let hora: string | null = null;

  if (analysis.tipo === 'TRANSFERENCIAS_MULTIPLES') {
    const primera = analysis.transferencias?.[0];
    operacion = primera?.operacion || {};
    ordenante = primera?.ordenante || {};
    nroReferencia = primera?.nroReferencia || null;
    nroOperacion = primera?.nroOperacion || null;
    fecha = primera?.fecha || null;
    hora = primera?.hora || null;
  } else {
    operacion = analysis.operacion || {};
    ordenante = analysis.ordenante || {};
    nroReferencia = analysis.nroReferencia || null;
    nroOperacion = analysis.nroOperacion || null;
    fecha = analysis.fecha || null;
    hora = analysis.hora || null;
  }

  // Parsear fecha
  let fechaTransfer: Date | null = null;
  if (fecha && hora) {
    const fechaMatch = `${fecha} ${hora}`.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (fechaMatch) {
      const [, day, month, year, hourPart, minute] = fechaMatch;
      fechaTransfer = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hourPart), parseInt(minute));
    }
  }

  const bankTransfer = await tx.bankTransfer.create({
    data: {
      period: { connect: { id: periodId } },
      datetime: fechaTransfer,
      reference: nroReferencia,
      operationNo: nroOperacion,
      cbuDestino: operacion?.cbuDestino || null,
      cuentaOrigen: operacion?.cuentaOrigen || null,
      importe: preview.transferAmount,
      cuitOrdenante: ordenante?.cuit || null,
      cuitBenef: operacion?.cuit || null,
      titular: operacion?.titular || null,
      bufferHash: preview.bufferHash,
      banco: operacion?.banco || null,
      tipoOperacion: operacion?.tipoOperacion || null,
      importeATransferir: operacion?.importeATransferir || null,
      importeTotal: preview.isMultiple
        ? preview.transferAmount
        : (operacion?.importeTotal || null),
      ordenanteNombre: ordenante?.nombre || null,
      ordenanteDomicilio: ordenante?.domicilio || null
    }
  });


  return { pdfFileId: pdfFile.id, bankTransferId: bankTransfer.id };
}
