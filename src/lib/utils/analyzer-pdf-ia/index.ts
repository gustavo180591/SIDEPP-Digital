import { extractPDFContent, extractTextWithPdfJs, detectDocumentType } from './pdf-extractor.js';
import { analyzeAportesWithAI, analyzeAportesWithVision, analyzeMultipleAportesWithVision } from './analyzer-aportes-ia.js';
import { analyzeTransferenciaWithAI, analyzeTransferenciaWithVision, analyzeMultipleTransferenciasWithVision } from './analyzer-transferencia-ia.js';
import type { ListadoPDFResult, TransferenciaPDFResult, MultiTransferenciaPDFResult, PDFResult } from './types/index.js';

// Re-exportar tipos
export type { ListadoPDFResult, TransferenciaPDFResult, MultiTransferenciaPDFResult, PDFResult };

/**
 * Analiza un PDF de listado de aportes usando IA
 * Esta es la función principal que usa el API endpoint
 * Soporta tanto PDFs con texto como PDFs escaneados (imágenes)
 *
 * @param buffer - Buffer del archivo PDF
 * @param filename - Nombre del archivo original
 * @returns Datos estructurados del listado de aportes
 */
export async function analyzeAportesIA(
  buffer: Buffer,
  filename: string
): Promise<ListadoPDFResult> {
  console.log(`[analyzeAportesIA] Procesando: ${filename}`);

  // Extraer contenido del PDF
  const content = await extractPDFContent(buffer);

  if (!content.hasText) {
    // PDF sin texto - usar Vision API para analizar las imágenes
    console.log(`[analyzeAportesIA] PDF sin texto, usando Vision API para ${content.imagesBase64.length} página(s)...`);

    if (content.imagesBase64.length === 1) {
      // Una sola página
      return analyzeAportesWithVision(content.imagesBase64[0], filename);
    } else {
      // Múltiples páginas - combinar resultados
      return analyzeMultipleAportesWithVision(content.imagesBase64, filename);
    }
  }

  console.log(`[analyzeAportesIA] Texto extraído: ${content.text.length} caracteres`);
  return analyzeAportesWithAI(content.text, filename);
}

/**
 * Analiza un PDF de transferencia bancaria usando IA
 * Soporta tanto PDFs con texto como PDFs escaneados (imágenes)
 * Soporta múltiples transferencias en el mismo PDF
 *
 * @param buffer - Buffer del archivo PDF
 * @param filename - Nombre del archivo original
 * @returns Datos estructurados de la(s) transferencia(s)
 */
export async function analyzeTransferenciaIA(
  buffer: Buffer,
  filename: string
): Promise<TransferenciaPDFResult | MultiTransferenciaPDFResult> {
  console.log(`[analyzeTransferenciaIA] Procesando: ${filename}`);

  // Extraer contenido del PDF
  const content = await extractPDFContent(buffer);

  if (!content.hasText) {
    // PDF sin texto - usar Vision API para todas las páginas
    console.log(`[analyzeTransferenciaIA] PDF sin texto, usando Vision API para ${content.imagesBase64.length} página(s)...`);
    return analyzeMultipleTransferenciasWithVision(content.imagesBase64, filename);
  }

  console.log(`[analyzeTransferenciaIA] Texto extraído: ${content.text.length} caracteres`);
  return analyzeTransferenciaWithAI(content.text, filename);
}

/**
 * Analiza automáticamente un PDF detectando su tipo
 *
 * @param buffer - Buffer del archivo PDF
 * @param filename - Nombre del archivo original
 * @returns Datos estructurados según el tipo de documento
 */
export async function analyzePDF(
  buffer: Buffer,
  filename: string
): Promise<PDFResult> {
  console.log(`[analyzePDF] Procesando: ${filename}`);

  // Extraer contenido
  const content = await extractPDFContent(buffer);

  // Si no hay texto, intentar con Vision para transferencias (común en comprobantes escaneados)
  if (!content.hasText) {
    // Intentar extracción alternativa primero
    const pdfJsText = await extractTextWithPdfJs(buffer);

    if (pdfJsText && pdfJsText.length > 50) {
      const tipo = detectDocumentType(pdfJsText);

      if (tipo === 'LISTADO_APORTES') {
        return analyzeAportesWithAI(pdfJsText, filename);
      } else if (tipo === 'TRANSFERENCIA') {
        return analyzeTransferenciaWithAI(pdfJsText, filename);
      }
    }

    // Sin texto, asumir transferencia y usar Vision para todas las páginas
    console.log(`[analyzePDF] PDF sin texto, usando Vision API para ${content.imagesBase64.length} página(s)...`);
    return analyzeMultipleTransferenciasWithVision(content.imagesBase64, filename);
  }

  // Detectar tipo de documento
  const tipo = detectDocumentType(content.text);

  switch (tipo) {
    case 'LISTADO_APORTES':
      console.log(`[analyzePDF] Tipo detectado: Listado de Aportes`);
      return analyzeAportesWithAI(content.text, filename);

    case 'TRANSFERENCIA':
      console.log(`[analyzePDF] Tipo detectado: Transferencia Bancaria`);
      return analyzeTransferenciaWithAI(content.text, filename);

    default:
      throw new Error(`Tipo de documento no reconocido: ${filename}`);
  }
}

// Exportar funciones auxiliares por si se necesitan
export { extractPDFContent, extractTextWithPdfJs, detectDocumentType, cleanTextForAI } from './pdf-extractor.js';
export { analyzeAportesWithAI, analyzeAportesWithVision, analyzeMultipleAportesWithVision } from './analyzer-aportes-ia.js';
export { analyzeTransferenciaWithAI, analyzeTransferenciaWithVision, analyzeMultipleTransferenciasWithVision } from './analyzer-transferencia-ia.js';
