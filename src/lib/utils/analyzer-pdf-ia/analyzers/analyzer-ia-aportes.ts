import {
	analyzeWithClaude,
	bufferToClaudePdf,
	type ClaudeContent
} from '../services/claude-service.js';
import { SYSTEM_PROMPT_APORTES, USER_PROMPT_APORTES } from '../prompts/prompt-aportes.js';
import type { ListadoPDFResult } from '../types/index.js';

interface ClaudeAportesResponse {
	tipo: 'LISTADO_APORTES';
	escuela: {
		nombre: string | null;
		direccion: string | null;
		cuit: string | null;
	};
	fecha: string | null;
	periodo: string | null;
	concepto: string | null;
	personas: Array<{
		nombre: string;
		totalRemunerativo: number;
		cantidadLegajos: number;
		montoConcepto: number;
	}>;
	totales: {
		cantidadPersonas: number;
		montoTotal: number;
	};
}

export interface AnalyzerIAOptions {
	model?: string;
}

/**
 * Analiza un PDF de listado de aportes usando Claude API
 * @param pdfBuffer - Buffer del archivo PDF
 * @param filename - Nombre del archivo para referencia
 * @param options - Opciones del analizador
 */
export async function analyzeAportesIA(
	pdfBuffer: Buffer,
	filename: string,
	options: AnalyzerIAOptions = {}
): Promise<ListadoPDFResult> {
	const { model = 'claude-sonnet-4-20250514' } = options;

	// Enviar el PDF como documento base64
	const content: ClaudeContent[] = [
		{ type: 'text', text: USER_PROMPT_APORTES },
		bufferToClaudePdf(pdfBuffer)
	];

	// Llamar a Claude
	const response = await analyzeWithClaude<ClaudeAportesResponse>(
		content,
		SYSTEM_PROMPT_APORTES,
		{ model, temperature: 0 }
	);

	// Mapear respuesta al tipo esperado
	const resultado: ListadoPDFResult = {
		tipo: 'LISTADO_APORTES',
		archivo: filename,
		escuela: {
			nombre: response.escuela.nombre,
			direccion: response.escuela.direccion,
			cuit: response.escuela.cuit
		},
		fecha: response.fecha,
		periodo: response.periodo,
		concepto: response.concepto,
		personas: response.personas.map((p) => ({
			nombre: p.nombre,
			totalRemunerativo: p.totalRemunerativo,
			cantidadLegajos: p.cantidadLegajos,
			montoConcepto: p.montoConcepto
		})),
		totales: {
			cantidadPersonas: response.totales.cantidadPersonas,
			montoTotal: response.totales.montoTotal
		}
	};

	return resultado;
}

/**
 * Determina si el resultado es de tipo FOPID basándose en el período
 */
export function esFOPID(resultado: ListadoPDFResult): boolean {
	return resultado.periodo === 'FOPID';
}
