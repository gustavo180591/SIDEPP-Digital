/**
 * Tipos e interfaces para el analyzer de PDFs con IA
 */

// ========================================
// Interfaces para Listado de Aportes
// ========================================

export interface Escuela {
  nombre: string | null;
  direccion: string | null;
  cuit: string | null;
}

export interface PersonaAporte {
  nombre: string;
  totalRemunerativo: number;
  cantidadLegajos: number;
  montoConcepto: number;
}

export interface Totales {
  cantidadPersonas: number;
  montoTotal: number;
}

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

// ========================================
// Interfaces para Transferencias
// ========================================

export interface OrdenanteNuevo {
  cuit: string | null;
  nombre: string | null;
  domicilio: string | null;
}

export interface Operacion {
  cuentaOrigen: string | null;
  importe: number | null;
  cbuDestino: string | null;
  banco: string | null;
  titular: string | null;
  cuit: string | null;
  tipoOperacion: string | null;
  importeATransferir: number | null;
  importeTotal: number | null;
}

export interface TransferenciaItem {
  titulo: string;
  nroReferencia: string | null;
  nroOperacion: string | null;
  fecha: string | null;
  hora: string | null;
  ordenante: OrdenanteNuevo;
  operacion: Operacion;
}

export interface TransferenciaPDFResult {
  tipo: 'TRANSFERENCIA';
  archivo: string;
  titulo: string;
  nroReferencia: string | null;
  nroOperacion: string | null;
  fecha: string | null;
  hora: string | null;
  ordenante: OrdenanteNuevo;
  operacion: Operacion;
}

/**
 * Resultado de análisis de PDF con múltiples transferencias
 * Soporta PDFs que contienen más de un comprobante de transferencia
 */
export interface MultiTransferenciaPDFResult {
  tipo: 'TRANSFERENCIAS_MULTIPLES';
  archivo: string;
  transferencias: TransferenciaItem[];
  resumen: {
    cantidadTransferencias: number;
    importeTotal: number;
    /** Número total de páginas que se intentaron analizar */
    paginasAnalizadas?: number;
    /** Número de páginas que fallaron el análisis */
    paginasConError?: number;
  };
}

// ========================================
// Tipo union para resultados
// ========================================

export type PDFResult = ListadoPDFResult | TransferenciaPDFResult | MultiTransferenciaPDFResult;
