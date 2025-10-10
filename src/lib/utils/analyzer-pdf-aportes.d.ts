export interface EmpresaData {
  nombre: string | null;
  direccion: string | null;
  cuit: string | null;
}

export interface PersonaData {
  nombre: string;
  cantidadLegajos: number;
  montoConcepto: number;
  totalRemunerativo: number;
}

export interface TotalesData {
  cantidadPersonas: number;
  montoTotal: number;
}

export interface PaginaData {
  numero: number;
  fecha: string | null;
  personas: PersonaData[];
  totales: TotalesData;
}

export interface MetadataData {
  creator: string;
  creationDate: string;
  totalPaginas: number;
}

export interface TotalesGeneralesData {
  cantidadPersonas: number;
  montoTotal: number;
  totalRegistros: number;
}

export interface ListadoPDFResult {
  tipo: 'LISTADO_APORTES';
  metadata: MetadataData;
  empresa: EmpresaData;
  concepto: string | null;
  periodo: string | null;
  paginas: PaginaData[];
  totalesGenerales: TotalesGeneralesData;
}

export interface ListadoPDFSimple {
  tipo: 'LISTADO_APORTES';
  archivo: string;
  fecha: string | null;
  pagina: number | null;
  empresa: EmpresaData;
  concepto: string | null;
  periodo: string | null;
  personas: PersonaData[];
  totales: TotalesData;
}

export function parseListadoPDF(text: string, filename: string): ListadoPDFSimple;
export function parseListadoPDFCompleto(pdfPath: string): Promise<ListadoPDFResult>;
