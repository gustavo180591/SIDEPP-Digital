/**
 * Módulo de Guardado Atómico para PDFs
 *
 * Este módulo guarda todos los datos de una sesión de preview en una transacción atómica.
 * Si algo falla, se hace rollback automático de todo.
 */

import { writeFile, unlink, readFile as fsReadFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '$lib/server/db';
import { CONFIG } from '$lib/server/config';
import type { AportesPreviewResult, TransferenciaPreviewResult } from './preview';
import type { ListadoPDFResult, TransferenciaPDFResult, MultiTransferenciaPDFResult } from '$lib/utils/analyzer-pdf-ia/types/index.js';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const { UPLOAD_DIR } = CONFIG;
const ANALYZER_DIR = join(UPLOAD_DIR, 'analyzer');
const HASH_INDEX = join(ANALYZER_DIR, 'hash-index.json');

// Asegurar que el directorio existe
if (!existsSync(ANALYZER_DIR)) {
  mkdirSync(ANALYZER_DIR, { recursive: true, mode: 0o755 });
}

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
  forceConfirm?: boolean; // Guardar aunque no coincidan los totales
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

async function loadHashIndex(): Promise<Record<string, { fileName: string; savedName: string; savedPath: string }>> {
  try {
    const buf = await fsReadFile(HASH_INDEX, 'utf8');
    return JSON.parse(buf) as Record<string, { fileName: string; savedName: string; savedPath: string }>;
  } catch {
    return {};
  }
}

async function saveHashIndex(index: Record<string, { fileName: string; savedName: string; savedPath: string }>): Promise<void> {
  await writeFile(HASH_INDEX, Buffer.from(JSON.stringify(index, null, 2), 'utf8'));
}

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

// ============================================================================
// FUNCIÓN PRINCIPAL DE GUARDADO BATCH
// ============================================================================

/**
 * Guarda todos los datos de una sesión de preview en una transacción atómica
 */
export async function saveBatchAtomic(input: BatchSaveInput): Promise<BatchSaveResult> {
  const { previews, selectedPeriod, institutionId, forceConfirm } = input;

  console.log('[saveBatchAtomic] Iniciando guardado atómico...');
  console.log('[saveBatchAtomic] Período:', selectedPeriod);
  console.log('[saveBatchAtomic] Institución:', institutionId);
  console.log('[saveBatchAtomic] Archivos a guardar:', Object.keys(previews).filter(k => previews[k as keyof typeof previews]));

  // Archivos físicos guardados (para cleanup en caso de error)
  const savedFilePaths: string[] = [];
  const hashEntries: string[] = [];

  try {
    // Usar transacción de Prisma para atomicidad
    const result = await prisma.$transaction(async (tx) => {
      const savedFiles: BatchSaveResult['savedFiles'] = {};
      let periodId: string | null = null;

      // 1. Buscar o crear PayrollPeriod
      console.log('[saveBatchAtomic] Paso 1: Buscar/crear PayrollPeriod...');
      let period = await tx.payrollPeriod.findFirst({
        where: {
          institutionId,
          month: selectedPeriod.month,
          year: selectedPeriod.year
        }
      });

      if (!period) {
        // Crear nuevo período
        const fallbackTransferId = `batch-${Date.now()}`;
        period = await tx.payrollPeriod.create({
          data: {
            institution: { connect: { id: institutionId } },
            month: selectedPeriod.month,
            year: selectedPeriod.year,
            transferId: fallbackTransferId
          }
        });
        console.log('[saveBatchAtomic] ✓ PayrollPeriod creado:', period.id);
      } else {
        console.log('[saveBatchAtomic] ✓ PayrollPeriod existente:', period.id);
      }

      periodId = period.id;

      // 2. Guardar archivos de aportes (sueldos, fopid, aguinaldo)
      for (const [key, preview] of Object.entries(previews)) {
        if (!preview || !preview.success) continue;

        if (preview.type === 'APORTES') {
          console.log(`[saveBatchAtomic] Paso 2: Guardando ${key}...`);
          const aportesResult = await saveAportesFile(
            preview as AportesPreviewResult,
            periodId,
            institutionId,
            savedFilePaths,
            hashEntries,
            tx
          );

          savedFiles[key as 'sueldos' | 'fopid' | 'aguinaldo'] = aportesResult;
        }
      }

      // 3. Guardar transferencia
      if (previews.transferencia?.success && previews.transferencia.type === 'TRANSFERENCIA') {
        console.log('[saveBatchAtomic] Paso 3: Guardando transferencia...');
        const transferResult = await saveTransferenciaFile(
          previews.transferencia as TransferenciaPreviewResult,
          periodId,
          savedFilePaths,
          hashEntries,
          tx
        );

        savedFiles.transferencia = transferResult;
      }

      return { periodId, savedFiles };
    }, {
      timeout: 60000 // 60 segundos para transacciones complejas
    });

    // Si llegamos aquí, la transacción fue exitosa
    // Guardar en hash-index DESPUÉS de la transacción exitosa
    const hashIndex = await loadHashIndex();
    for (const hash of hashEntries) {
      // Los archivos ya fueron guardados, solo necesitamos registrar los hashes
      // La info del archivo está en savedFilePaths
    }

    console.log('[saveBatchAtomic] ✓ Guardado atómico completado exitosamente');

    return {
      success: true,
      periodId: result.periodId,
      savedFiles: result.savedFiles
    };

  } catch (error) {
    console.error('[saveBatchAtomic] ❌ Error en transacción, ejecutando cleanup...');

    // Limpiar archivos físicos guardados
    for (const filePath of savedFilePaths) {
      try {
        await unlink(filePath);
        console.log(`[saveBatchAtomic] ✓ Archivo eliminado: ${filePath}`);
      } catch (unlinkErr) {
        // Ignorar si el archivo no existe
        if ((unlinkErr as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error(`[saveBatchAtomic] Error eliminando archivo: ${filePath}`, unlinkErr);
        }
      }
    }

    // Limpiar entradas del hash-index
    if (hashEntries.length > 0) {
      try {
        const hashIndex = await loadHashIndex();
        for (const hash of hashEntries) {
          delete hashIndex[hash];
        }
        await saveHashIndex(hashIndex);
        console.log(`[saveBatchAtomic] ✓ ${hashEntries.length} entradas de hash eliminadas`);
      } catch (hashErr) {
        console.error('[saveBatchAtomic] Error limpiando hash-index:', hashErr);
      }
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
  hashEntries: string[],
  tx: TransactionClient
): Promise<{ pdfFileId: string; contributionLineCount: number }> {
  // 1. Guardar archivo físico
  const buffer = Buffer.from(preview.bufferBase64, 'base64');
  const timestamp = Date.now();
  const ext = preview.fileName.split('.').pop() || 'pdf';
  const savedName = `${timestamp}.${ext}`;
  const savedPath = join(ANALYZER_DIR, savedName);

  await writeFile(savedPath, buffer);
  savedFilePaths.push(savedPath);
  console.log(`[saveAportesFile] ✓ Archivo guardado: ${savedPath}`);

  // 2. Registrar en hash-index
  const hashIndex = await loadHashIndex();
  hashIndex[preview.bufferHash] = { fileName: preview.fileName, savedName, savedPath };
  await saveHashIndex(hashIndex);
  hashEntries.push(preview.bufferHash);

  // 3. Crear PdfFile en DB
  const analysis = preview.analysis as ListadoPDFResult;

  const pdfFile = await tx.pdfFile.create({
    data: {
      fileName: preview.fileName,
      bufferHash: preview.bufferHash,
      type: preview.conceptType === 'FOPID' ? 'FOPID' : 'SUELDO',
      concept: analysis.concepto || 'Aporte Sindical SIDEPP (1%)',
      peopleCount: preview.peopleCount,
      totalAmount: preview.totalAmount.toString(),
      period: { connect: { id: periodId } }
    }
  });
  console.log(`[saveAportesFile] ✓ PdfFile creado: ${pdfFile.id}`);

  // 4. Crear ContributionLines y Members
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
          console.log(`[saveAportesFile] ✓ Miembro creado: ${createdMember.id}`);
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

  console.log(`[saveAportesFile] ✓ ${contributionLineCount} ContributionLines creadas`);

  return { pdfFileId: pdfFile.id, contributionLineCount };
}

/**
 * Guarda un archivo de transferencia y crea el BankTransfer
 */
async function saveTransferenciaFile(
  preview: TransferenciaPreviewResult,
  periodId: string,
  savedFilePaths: string[],
  hashEntries: string[],
  tx: TransactionClient
): Promise<{ pdfFileId: string; bankTransferId: string }> {
  // 1. Guardar archivo físico
  const buffer = Buffer.from(preview.bufferBase64, 'base64');
  const timestamp = Date.now();
  const ext = preview.fileName.split('.').pop() || 'pdf';
  const savedName = `${timestamp}.${ext}`;
  const savedPath = join(ANALYZER_DIR, savedName);

  await writeFile(savedPath, buffer);
  savedFilePaths.push(savedPath);
  console.log(`[saveTransferenciaFile] ✓ Archivo guardado: ${savedPath}`);

  // 2. Registrar en hash-index
  const hashIndex = await loadHashIndex();
  hashIndex[preview.bufferHash] = { fileName: preview.fileName, savedName, savedPath };
  await saveHashIndex(hashIndex);
  hashEntries.push(preview.bufferHash);

  // 3. Crear PdfFile en DB
  const pdfFile = await tx.pdfFile.create({
    data: {
      fileName: preview.fileName,
      bufferHash: preview.bufferHash,
      type: 'COMPROBANTE',
      concept: 'Transferencia Bancaria',
      totalAmount: preview.transferAmount.toString(),
      period: { connect: { id: periodId } }
    }
  });
  console.log(`[saveTransferenciaFile] ✓ PdfFile creado: ${pdfFile.id}`);

  // 4. Crear BankTransfer
  const analysis = preview.analysis;

  // Extraer datos según si es simple o múltiple
  let operacion: any;
  let ordenante: any;
  let nroReferencia: string | null = null;
  let nroOperacion: string | null = null;
  let fecha: string | null = null;
  let hora: string | null = null;

  if (analysis.tipo === 'TRANSFERENCIAS_MULTIPLES') {
    // Usar datos de la primera transferencia para el registro
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

  console.log(`[saveTransferenciaFile] ✓ BankTransfer creado: ${bankTransfer.id}`);

  return { pdfFileId: pdfFile.id, bankTransferId: bankTransfer.id };
}
