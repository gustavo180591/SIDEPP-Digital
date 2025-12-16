/**
 * Módulo de Análisis de PDFs
 *
 * Este módulo provee funcionalidades para:
 * - Analizar PDFs sin guardarlos (preview)
 * - Guardar datos de forma atómica (save)
 *
 * Uso:
 * 1. Frontend envía archivos a /api/analyzer-pdf-preview
 * 2. Backend analiza con IA y retorna preview
 * 3. Usuario revisa y confirma
 * 4. Frontend envía datos a /api/analyzer-pdf-confirm
 * 5. Backend guarda todo en transacción atómica
 */

export {
  analyzeAportesPreview,
  analyzeTransferenciaPreview,
  analyzeBatchPreview,
  type FilePreviewInput,
  type AportesPreviewResult,
  type TransferenciaPreviewResult,
  type PreviewError,
  type PreviewResult,
  type BatchPreviewResult
} from './preview';

export {
  saveBatchAtomic,
  type SaveAportesInput,
  type SaveTransferenciaInput,
  type BatchSaveInput,
  type SaveResult,
  type BatchSaveResult
} from './save';
