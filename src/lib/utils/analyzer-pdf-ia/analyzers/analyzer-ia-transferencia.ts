import {
	analyzeWithClaude,
	bufferToClaudePdf,
	type ClaudeContent
} from '../services/claude-service.js';
import {
	SYSTEM_PROMPT_TRANSFERENCIA,
	USER_PROMPT_TRANSFERENCIA
} from '../prompts/prompt-transferencia.js';
import type { TransferenciaPDFResult } from '../types/index.js';

interface ClaudeTransferenciaResponse {
	tipo: 'TRANSFERENCIA';
	nroReferencia: string | null;
	nroOperacion: string | null;
	fecha: string | null;
	hora: string | null;
	ordenante: {
		cuit: string | null;
		nombre: string | null;
		domicilio: string | null;
	};
	operacion: {
		cuentaOrigen: string | null;
		importe: number | null;
		cbuDestino: string | null;
		banco: string | null;
		titular: string | null;
		cuit: string | null;
		tipoOperacion: string | null;
		importeATransferir: number | null;
		importeTotal: number | null;
	};
}

export interface AnalyzerIAOptions {
	model?: string;
}

/**
 * Analiza un PDF de transferencia bancaria usando Claude API
 * @param pdfBuffer - Buffer del archivo PDF
 * @param filename - Nombre del archivo para referencia
 * @param options - Opciones del analizador
 */
export async function analyzeTransferenciaIA(
	pdfBuffer: Buffer,
	filename: string,
	options: AnalyzerIAOptions = {}
): Promise<TransferenciaPDFResult> {
	const { model = 'claude-sonnet-4-20250514' } = options;

	// Enviar el PDF como documento base64
	const content: ClaudeContent[] = [
		{ type: 'text', text: USER_PROMPT_TRANSFERENCIA },
		bufferToClaudePdf(pdfBuffer)
	];

	// Llamar a Claude
	const response = await analyzeWithClaude<ClaudeTransferenciaResponse>(
		content,
		SYSTEM_PROMPT_TRANSFERENCIA,
		{ model, temperature: 0 }
	);

	// Mapear respuesta al tipo esperado
	const resultado: TransferenciaPDFResult = {
		tipo: 'TRANSFERENCIA',
		archivo: filename,
		titulo: 'Transferencia a terceros banco Macro',
		nroReferencia: response.nroReferencia,
		nroOperacion: response.nroOperacion,
		fecha: response.fecha,
		hora: response.hora,
		ordenante: {
			cuit: response.ordenante.cuit,
			nombre: response.ordenante.nombre,
			domicilio: response.ordenante.domicilio
		},
		operacion: {
			cuentaOrigen: response.operacion.cuentaOrigen,
			importe: response.operacion.importe,
			cbuDestino: response.operacion.cbuDestino,
			banco: response.operacion.banco,
			titular: response.operacion.titular,
			cuit: response.operacion.cuit,
			tipoOperacion: response.operacion.tipoOperacion,
			importeATransferir: response.operacion.importeATransferir ?? response.operacion.importe,
			importeTotal: response.operacion.importeTotal ?? response.operacion.importe
		}
	};

	return resultado;
}
