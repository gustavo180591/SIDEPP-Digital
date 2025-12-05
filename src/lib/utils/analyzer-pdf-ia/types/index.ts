/**
 * Tipos para los analizadores de PDF
 * Define las estructuras de datos retornadas por los parsers de PDFs
 */

// ============================================================================
// TIPOS BASE COMPARTIDOS
// ============================================================================

/**
 * Metadata del PDF extraída por pdf2json
 */
export interface PDFMetadataInfo {
  creator: string;
  creationDate: string;
  totalPaginas: number;
}

/**
 * Estructura de un item de texto en el PDF (pdf2json)
 */
export interface PDFTextItem {
  x: number;
  y: number;
  w?: number;
  sw?: number;
  clr?: number;
  A?: string;
  R: Array<{
    T: string;
    S?: number;
    TS?: number[];
  }>;
}

/**
 * Estructura de una página del PDF (pdf2json)
 */
export interface PDFPage {
  Width: number;
  Height: number;
  HLines?: any[];
  VLines?: any[];
  Fills?: any[];
  Texts: PDFTextItem[];
  Fields?: any[];
  Boxsets?: any[];
}

/**
 * Estructura completa del PDF parseado (pdf2json)
 */
export interface PDFData {
  Meta: {
    Creator: string;
    CreationDate: string;
    [key: string]: any;
  };
  Pages: PDFPage[];
  [key: string]: any;
}

// ============================================================================
// TIPOS PARA LISTADO DE APORTES
// ============================================================================

/**
 * Información de la escuela/institución
 */
export interface Escuela {
  nombre: string | null;
  direccion: string | null;
  cuit: string | null;
}

/**
 * Datos de una persona con aportes
 */
export interface PersonaAporte {
  nombre: string;
  totalRemunerativo: number;
  cantidadLegajos: number;
  montoConcepto: number;
}

/**
 * Totales por página o generales
 */
export interface Totales {
  cantidadPersonas: number;
  montoTotal: number;
}

/**
 * Totales generales con información adicional
 */
export interface TotalesGenerales extends Totales {
  totalRegistros: number;
}

/**
 * Datos de una página individual del PDF de aportes
 */
export interface PaginaData {
  numero: number;
  fecha: string | null;
  personas: PersonaAporte[];
  totales: Totales;
}

/**
 * Resultado simple del parser de listado de aportes (texto plano)
 */
export interface ListadoPDFResult {
  tipo: 'LISTADO_APORTES';
  archivo: string;
  escuela: Escuela;
  fecha: string | null;
  periodo: string | null;
  concepto: string | null;
  personas: PersonaAporte[];
  totales: Totales;
}

/**
 * Resultado completo del parser de listado de aportes (pdf2json)
 */
export interface ListadoPDFCompletoResult {
  tipo: 'LISTADO_APORTES';
  metadata: PDFMetadataInfo;
  escuela: Escuela;
  concepto: string | null;
  periodo: string | null;
  paginas: PaginaData[];
  totalesGenerales: TotalesGenerales;
}

// ============================================================================
// TIPOS PARA TRANSFERENCIA BANCARIA
// ============================================================================

/**
 * Información del ordenante de la transferencia
 */
export interface Ordenante {
  cuit: string | null;
  nombre: string | null;
  domicilio: string | null;
}

/**
 * Información del beneficiario de la transferencia
 */
export interface Beneficiario {
  cuit: string | null;
  nombre: string | null;
}

/**
 * Detalles de la operación bancaria
 */
export interface OperacionBancaria {
  cuentaOrigen: string | null;
  importe: number | null;
  cbuDestino: string | null;
  banco: string | null;
  titular: string | null;
  cuit: string | null; // CUIT del beneficiario
  tipoOperacion: string | null;
  importeATransferir: number | null;
  importeTotal: number | null;
}

/**
 * Resultado simple del parser de transferencia (texto plano)
 */
export interface TransferenciaPDFResult {
  tipo: 'TRANSFERENCIA';
  archivo: string;
  titulo: string;
  nroReferencia: string | null;
  nroOperacion: string | null;
  fecha: string | null;
  hora: string | null;
  ordenante: Ordenante;
  operacion: OperacionBancaria;
}

/**
 * Resultado completo del parser de transferencia (pdf2json)
 */
export interface TransferenciaPDFCompletoResult {
  tipo: 'TRANSFERENCIA';
  metadata: PDFMetadataInfo;
  archivo: string;
  titulo: string;
  nroReferencia: string | null;
  nroOperacion: string | null;
  fecha: string | null;
  hora: string | null;
  ordenante: Ordenante;
  operacion: OperacionBancaria;
}

// ============================================================================
// TIPOS AUXILIARES
// ============================================================================

/**
 * Tipo unión de todos los resultados posibles
 */
export type PDFAnalyzerResult =
  | ListadoPDFResult
  | ListadoPDFCompletoResult
  | TransferenciaPDFResult
  | TransferenciaPDFCompletoResult;

/**
 * Tipo discriminado por el campo 'tipo'
 */
export type PDFResultType = 'LISTADO_APORTES' | 'TRANSFERENCIA';
