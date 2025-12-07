import { extractPDFContent, extractTextWithPdfJs, detectDocumentType } from './pdf-extractor.js';
import { analyzeAportesWithAI } from './analyzer-aportes-ia.js';
import { analyzeTransferenciaWithAI, analyzeTransferenciaWithVision } from './analyzer-transferencia-ia.js';
import type { ListadoPDFResult, TransferenciaPDFResult, PDFResult } from './types/index.js';

// Re-exportar tipos
export type { ListadoPDFResult, TransferenciaPDFResult, PDFResult };

/**
 * Analiza un PDF de listado de aportes usando IA
 * Esta es la función principal que usa el API endpoint
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

  // Extraer texto del PDF
  const content = await extractPDFContent(buffer);

  if (!content.hasText) {
    // Si no hay texto, intentar con pdfjs-dist
    console.log(`[analyzeAportesIA] Intentando extracción alternativa con pdfjs-dist...`);
    const pdfJsText = await extractTextWithPdfJs(buffer);

    if (pdfJsText && pdfJsText.length > 50) {
      console.log(`[analyzeAportesIA] Texto extraído con pdfjs-dist: ${pdfJsText.length} caracteres`);
      return analyzeAportesWithAI(pdfJsText, filename);
    }

    // Si aún no hay texto, el PDF probablemente es solo imágenes
    // Para listados de aportes, esto es raro pero podría pasar
    throw new Error('No se pudo extraer texto del PDF. El documento puede ser solo imágenes.');
  }

  console.log(`[analyzeAportesIA] Texto extraído: ${content.text.length} caracteres`);
  return analyzeAportesWithAI(content.text, filename);
}

/**
 * Analiza un PDF de transferencia bancaria usando IA
 * Soporta tanto PDFs con texto como PDFs escaneados (imágenes)
 *
 * @param buffer - Buffer del archivo PDF
 * @param filename - Nombre del archivo original
 * @returns Datos estructurados de la transferencia
 */
export async function analyzeTransferenciaIA(
  buffer: Buffer,
  filename: string
): Promise<TransferenciaPDFResult> {
  console.log(`[analyzeTransferenciaIA] Procesando: ${filename}`);

  // Extraer contenido del PDF
  const content = await extractPDFContent(buffer);

  if (!content.hasText) {
    // PDF sin texto - usar Vision API
    console.log(`[analyzeTransferenciaIA] PDF sin texto, usando Vision API...`);
    return analyzeTransferenciaWithVision(content.imageBase64, filename);
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

    // Sin texto, asumir transferencia y usar Vision
    console.log(`[analyzePDF] PDF sin texto, usando Vision API para transferencia...`);
    return analyzeTransferenciaWithVision(content.imageBase64, filename);
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
export { analyzeAportesWithAI } from './analyzer-aportes-ia.js';
export { analyzeTransferenciaWithAI, analyzeTransferenciaWithVision } from './analyzer-transferencia-ia.js';
