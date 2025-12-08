import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

const openai = new OpenAI({
	apiKey: OPENAI_API_KEY
});

export interface OpenAIAnalysisOptions {
	model?: string;
	maxTokens?: number;
	temperature?: number;
}

export interface OpenAITextContent {
	type: 'text';
	text: string;
}

export interface OpenAIPdfContent {
	type: 'pdf';
	buffer: Buffer;
}

export type OpenAIContent = OpenAITextContent | OpenAIPdfContent;

/**
 * Extrae texto de un buffer PDF usando pdf-parse (importación dinámica)
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
	// Importar dinámicamente para evitar problemas con el shim de Vite
	const pdfParseModule = await import('pdf-parse');
	const pdfParse = pdfParseModule.default;
	const data = await pdfParse(buffer);
	return data.text;
}

/**
 * Convierte un buffer de PDF a contenido de texto extraído
 */
export function bufferToOpenAIPdf(buffer: Buffer): OpenAIPdfContent {
	return {
		type: 'pdf',
		buffer
	};
}

/**
 * Analiza contenido usando OpenAI API y devuelve un resultado tipado
 * @param content - Contenido a analizar (PDFs o texto)
 * @param systemPrompt - Instrucciones del sistema
 * @param options - Opciones adicionales
 */
export async function analyzeWithOpenAI<T>(
	content: OpenAIContent[],
	systemPrompt: string,
	options: OpenAIAnalysisOptions = {}
): Promise<T> {
	const { model = 'gpt-4o', maxTokens = 4096, temperature = 0 } = options;

	// Procesar el contenido: extraer texto de PDFs
	const messages: string[] = [];

	for (const item of content) {
		if (item.type === 'text') {
			messages.push(item.text);
		} else if (item.type === 'pdf') {
			const pdfText = await extractTextFromPdf(item.buffer);
			messages.push(`--- CONTENIDO DEL PDF ---\n${pdfText}\n--- FIN DEL PDF ---`);
		}
	}

	const userMessage = messages.join('\n\n');

	const response = await openai.chat.completions.create({
		model,
		max_tokens: maxTokens,
		temperature,
		messages: [
			{
				role: 'system',
				content: systemPrompt
			},
			{
				role: 'user',
				content: userMessage
			}
		],
		response_format: { type: 'json_object' }
	});

	// Extraer el texto de la respuesta
	const textContent = response.choices[0]?.message?.content;
	if (!textContent) {
		throw new Error('No se recibió respuesta de texto de OpenAI');
	}

	// Parsear JSON de la respuesta (puede venir con o sin bloques de código)
	const jsonMatch = textContent.match(/```json\n?([\s\S]*?)\n?```/);
	const jsonString = jsonMatch ? jsonMatch[1] : textContent;

	try {
		return JSON.parse(jsonString.trim()) as T;
	} catch {
		throw new Error(`Error al parsear respuesta JSON de OpenAI: ${textContent}`);
	}
}
