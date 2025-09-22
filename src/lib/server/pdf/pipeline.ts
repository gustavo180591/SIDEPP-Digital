import { prisma } from '$lib/server/db';
import { classify } from './classify';
import { parseListado } from './parse-listado';
import { parseTransfer } from './parse-transfer';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { PdfMetadata } from './utils';
import { extractPdfMetadata } from './utils';
import { withRetry, isRetryableError } from '../utils/retry';

// Logger mejorado
interface LogMeta {
  [key: string]: string | number | boolean | null | undefined;
}

const logger = {
  info: (message: string, meta?: LogMeta) => console.log(`[INFO] ${message}`, meta || ''),
  error: (message: string, error?: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] ${message}`, errorMessage);
  },
  debug: (message: string, meta?: LogMeta) => console.debug(`[DEBUG] ${message}`, meta || ''),
  warn: (message: string, meta?: LogMeta) => console.warn(`[WARN] ${message}`, meta || ''),
};

// Importar configuración centralizada
import { CONFIG } from '$lib/server/config';

// Usar la configuración centralizada
const UPLOAD_DIR = CONFIG.UPLOAD_DIR;

// Verificar que el directorio existe (ya debería estar creado por la configuración)
if (!existsSync(UPLOAD_DIR)) {
  logger.error(`❌ El directorio de subidas no existe: ${UPLOAD_DIR}`);
  throw new Error(`El directorio de subidas no existe: ${UPLOAD_DIR}. Verifique los permisos.`);
}

logger.info(`📁 Usando directorio de subidas: ${UPLOAD_DIR}`);

/**
 * Procesa un archivo PDF recién cargado
 */
export async function processPdf(file: File, formData: Record<string, string>) {
  try {
    logger.info(`Iniciando procesamiento de archivo: ${file.name}`);
    
    // Validar tipo de archivo
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('El archivo debe ser un PDF');
    }

    // Guardar el archivo en el sistema de archivos
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = join(UPLOAD_DIR, fileName);
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await writeFile(filePath, buffer);
    logger.debug(`Archivo guardado en: ${filePath}`, { size: file.size });

    // Determinar el tipo de archivo
    const kind = classify(file.name);
    
    // Extraer metadatos básicos
    const fileSize = file.size;
    const mimeType = file.type;
    
    // Crear el registro en la base de datos
    const pdfFile = await prisma.pdfFile.create({
      data: {
        fileName: file.name,
        storagePath: filePath,
        kind,
        size: fileSize,
        mimeType: mimeType || 'application/pdf',
        parsed: false,
        institutionId: formData.institutionId || null,
        periodId: formData.periodId || null,
      },
    });

    logger.info(`Registro de PDF creado con ID: ${pdfFile.id}`);

    // Procesar en segundo plano
    setTimeout(() => processPdfInBackground(pdfFile.id, buffer, filePath).catch(error => {
      logger.error(`Error en procesamiento en segundo plano para ${pdfFile.id}`, error);
    }), 0);

    return pdfFile;
  } catch (error) {
    logger.error(`Error al procesar el archivo ${file.name}`, error);
    throw error; // Re-lanzar para manejo de errores en la ruta de la API
  }
}

/**
 * Procesa un archivo PDF existente por su ID
 */
export async function processPdfById(pdfId: string): Promise<void> {
  const pdf = await prisma.pdfFile.findUnique({ where: { id: pdfId } });
  if (!pdf) throw new Error('PdfFile no encontrado');

  const buf = await readFile(pdf.storagePath);
  // Si ya guardaste kind al crear el registro, lo respetamos; sino, lo inferimos por nombre
  const kind = (pdf.kind as 'LISTADO' | 'TRANSFER') ?? (classify(pdf.fileName) as 'LISTADO' | 'TRANSFER');
  const pdfData = {
    id: pdf.id,
    fileName: pdf.fileName,
    storagePath: pdf.storagePath,
    kind: pdf.kind as 'LISTADO' | 'TRANSFER',
    institutionId: pdf.institutionId,
    periodId: pdf.periodId,
    createdAt: pdf.createdAt,
    updatedAt: pdf.updatedAt,
    parsed: pdf.parsed,
    parseErrors: pdf.parseErrors,
    size: pdf.size ?? null,
    mimeType: pdf.mimeType ?? null,
    uploadedBy: pdf.uploadedBy ?? null,
    transferId: pdf.transferId ?? null
  };

  try {
    if (kind === 'LISTADO') {
      await parseListado(buf, pdfData);
    } else {
      await parseTransfer(buf, pdfData);
    }

    await prisma.pdfFile.update({
      where: { id: pdfId },
      data: { 
        parsed: true,
        parseErrors: null
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    await prisma.pdfFile.update({
      where: { id: pdfId },
      data: { 
        parsed: false,
        parseErrors: errorMessage
      }
    });
    throw error;
  }
}

/**
 * Procesa un archivo PDF en segundo plano
 */
async function processPdfInBackground(pdfId: string, fileBuffer: Buffer, filePath: string) {
  logger.info(`Iniciando procesamiento en segundo plano para PDF ID: ${pdfId}`);
  
  const pdf = await prisma.pdfFile.findUnique({ 
    where: { id: pdfId },
    include: { institution: true, period: true }
  });
  
  if (!pdf) {
    const error = new Error(`PdfFile con ID ${pdfId} no encontrado`);
    logger.error(error.message);
    throw error;
  }

  try {
    // 1. Extraer metadatos del PDF con reintentos
    let metadata: Partial<PdfMetadata> = {};
    try {
      metadata = await withRetry(
        () => extractPdfMetadata(filePath),
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          shouldRetry: (error) => isRetryableError(error) || String(error).includes('Failed to extract metadata')
        }
      );
      
      logger.debug('Metadatos extraídos del PDF', { 
        pdfId: pdf.id,
        pageCount: metadata.pageCount,
        isEncrypted: metadata.isEncrypted
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.warn('No se pudieron extraer metadatos del PDF después de varios intentos', { 
        pdfId: pdf.id,
        error: errorMessage
      });
    }

    // 2. Determinar el tipo de archivo
    const kind = pdf.kind || classify(pdf.fileName);
    let result;

    // 3. Procesar según el tipo de archivo con reintentos
    logger.debug(`Procesando archivo como tipo: ${kind}`, { pdfId: pdf.id });
    
    if (kind === 'LISTADO') {
      result = await withRetry(
        () => parseListado(fileBuffer, pdf),
        {
          maxRetries: 3,
          initialDelayMs: 2000,
          shouldRetry: (error) => {
            const errorMessage = String(error).toLowerCase();
            // No reintentar para errores de validación o datos inválidos
            if (errorMessage.includes('validación') || 
                errorMessage.includes('invalido') || 
                errorMessage.includes('formato incorrecto')) {
              return false;
            }
            return isRetryableError(error);
          }
        }
      );
    } else {
      // Para transferencias, envolvemos el resultado en un objeto ParseResult
      const transferResult = await withRetry(
        () => parseTransfer(fileBuffer, pdf),
        {
          maxRetries: 3,
          initialDelayMs: 2000,
          shouldRetry: (error) => {
            const errorMessage = String(error).toLowerCase();
            if (errorMessage.includes('validación') || 
                errorMessage.includes('invalido') || 
                errorMessage.includes('formato incorrecto')) {
              return false;
            }
            return isRetryableError(error);
          }
        }
      );
      
      // Aseguramos que el resultado tenga el formato esperado
      result = {
        success: true,
        data: transferResult,
        warnings: []
      };
    }

    // 4. Actualizar el estado del PDF con reintentos
    await withRetry(
      () => prisma.pdfFile.update({
        where: { id: pdf.id },
        data: { 
          parsed: true, 
          parseErrors: null,
          ...(kind === 'LISTADO' && pdf.periodId ? {
            period: { connect: { id: pdf.periodId } }
          } : {})
        }
      }),
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        shouldRetry: (error) => {
          // No reintentar para errores de base de datos que no sean de concurrencia
          const errorMessage = String(error).toLowerCase();
          return isRetryableError(error) || 
                 errorMessage.includes('prisma') ||
                 errorMessage.includes('database');
        }
      }
    );

    logger.info(`Procesamiento completado exitosamente para PDF ID: ${pdf.id}`);
    return result;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar PDF';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`Error procesando PDF ${pdf.id}: ${errorMessage}`, { 
      stack: errorStack,
      pdfId: pdf.id 
    });
    
    // Actualizar con el error
    await prisma.pdfFile.update({
      where: { id: pdf.id },
      data: { 
        parsed: false, 
        parseErrors: errorMessage
      },
    });
    
    // No relanzar el error para no interrumpir el flujo
    return { success: false, error: errorMessage };
  }
}
