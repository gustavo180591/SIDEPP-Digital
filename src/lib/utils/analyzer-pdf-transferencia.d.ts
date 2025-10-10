export interface TransferenciaData {
  titular: string | null;
  cbu: string | null;
  numeroOperacion: string | null;
  fechaHora: string | null;
  importe: string | null;
  cuentaOrigen: string | null;
  banco: string | null;
  tipoOperacion: string | null;
  referencia: string | null;
}

export interface BeneficiarioData {
  nombre: string | null;
  cuit: string | null;
  domicilio: string | null;
  condicionIVA: string | null;
}

export interface OrdenanteData {
  nombre: string | null;
  domicilio: string | null;
  cuit: string | null;
  iibb: string | null;
}

export interface MetadataTransferenciaData {
  creator: string;
  creationDate: string;
  totalPaginas: number;
}

export interface TransferenciaPDFResult {
  tipo: 'TRANSFERENCIA';
  metadata: MetadataTransferenciaData;
  transferencia: TransferenciaData;
  beneficiario: BeneficiarioData;
  ordenante: OrdenanteData;
}

export interface TransferenciaPDFSimple {
  tipo: 'TRANSFERENCIA';
  archivo: string;
  transferencia: TransferenciaData;
  beneficiario: BeneficiarioData;
  ordenante: OrdenanteData;
}

export function parseTransferenciaPDF(text: string, filename: string): TransferenciaPDFSimple;
export function parseTransferenciaPDFCompleto(pdfPath: string): Promise<TransferenciaPDFResult>;
