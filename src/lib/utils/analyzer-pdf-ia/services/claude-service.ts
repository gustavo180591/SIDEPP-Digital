import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({
	apiKey: ANTHROPIC_API_KEY
});

export interface ClaudeAnalysisOptions {
	model?: string;
	maxTokens?: number;
	temperature?: number;
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface ClaudeImageContent {
	type: 'image';
	source: {
		type: 'base64';
		media_type: ImageMediaType;
		data: string;
	};
}

export interface ClaudeDocumentContent {
	type: 'document';
	source: {
		type: 'base64';
		media_type: 'application/pdf';
		data: string;
	};
}

export interface ClaudeTextContent {
	type: 'text';
	text: string;
}

export type ClaudeContent = ClaudeImageContent | ClaudeTextContent | ClaudeDocumentContent;

/**
 * Convierte un buffer de imagen a formato de contenido de Claude
 */
export function bufferToClaudeImage(
	buffer: Buffer,
	mediaType: ImageMediaType = 'image/png'
): ClaudeImageContent {
	return {
		type: 'image',
		source: {
			type: 'base64',
			media_type: mediaType,
			data: buffer.toString('base64')
		}
	};
}

/**
 * Convierte un buffer de PDF a formato de documento de Claude
 */
export function bufferToClaudePdf(buffer: Buffer): ClaudeDocumentContent {
	return {
		type: 'document',
		source: {
			type: 'base64',
			media_type: 'application/pdf',
			data: buffer.toString('base64')
		}
	};
}

/**
 * Analiza contenido usando Claude API y devuelve un resultado tipado
 * @param content - Contenido a analizar (imágenes o texto)
 * @param systemPrompt - Instrucciones del sistema
 * @param options - Opciones adicionales
 */
export async function analyzeWithClaude<T>(
	content: ClaudeContent[],
	systemPrompt: string,
	options: ClaudeAnalysisOptions = {}
): Promise<T> {
	const { model = 'claude-sonnet-4-20250514', maxTokens = 4096, temperature = 0 } = options;

	const response = await anthropic.messages.create({
		model,
		max_tokens: maxTokens,
		temperature,
		system: systemPrompt,
		messages: [
			{
				role: 'user',
				content: content
			}
		]
	});

	// Extraer el texto de la respuesta
	const textContent = response.content.find((c) => c.type === 'text');
	if (!textContent || textContent.type !== 'text') {
		throw new Error('No se recibió respuesta de texto de Claude');
	}

	// Parsear JSON de la respuesta (puede venir con o sin bloques de código)
	const jsonMatch = textContent.text.match(/```json\n?([\s\S]*?)\n?```/);
	const jsonString = jsonMatch ? jsonMatch[1] : textContent.text;

	try {
		return JSON.parse(jsonString.trim()) as T;
	} catch {
		throw new Error(`Error al parsear respuesta JSON de Claude: ${textContent.text}`);
	}
}
