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

// ========================================
// Tipo union para resultados
// ========================================

export type PDFResult = ListadoPDFResult | TransferenciaPDFResult;
