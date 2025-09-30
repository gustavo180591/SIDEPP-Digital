import { json, type RequestHandler } from '@sveltejs/kit';
import { writeFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { CONFIG } from '$lib/server/config';
// pdfParse se importa dinámicamente para evitar problemas de cliente
import { ocrPdfFirstPage } from '$lib/server/pdf/ocr';
import { extractLineData } from '$lib/server/pdf/parse-listado';

const { UPLOAD_DIR, MAX_FILE_SIZE } = CONFIG;
const ANALYZER_DIR = join(UPLOAD_DIR, 'analyzer');

if (!existsSync(ANALYZER_DIR)) {
	mkdirSync(ANALYZER_DIR, { recursive: true, mode: 0o755 });
}

async function extractTextWithPdfJs(buffer: Buffer): Promise<string> {
	try {
		// Usamos la build legacy para Node y deshabilitamos worker
		const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
		// En entornos Node no es necesario establecer workerSrc; usamos useWorker:false
		const uint8 = new Uint8Array(buffer);
		const loadingTask = pdfjs.getDocument({ data: uint8, useWorker: false });
		const pdf = await loadingTask.promise;
		const numPages = pdf.numPages ?? 1;
		let allText = '';
		for (let p = 1; p <= numPages; p++) {
			const page = await pdf.getPage(p);
			const content = await page.getTextContent();
			const items = content.items as Array<any>;
			const linesMap = new Map<number, Array<{ x: number; str: string }>>();
			for (const it of items) {
				const tx = it.transform; // [a,b,c,d,e,f]
				const y = Math.round(tx[5]);
				const x = Math.round(tx[4]);
				const str = String(it.str || '').trim();
				if (!str) continue;
				if (!linesMap.has(y)) linesMap.set(y, []);
				linesMap.get(y)!.push({ x, str });
			}
			const orderedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
			for (const y of orderedY) {
				const parts = linesMap.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.str);
				const line = parts.join(' ').replace(/\s{2,}/g, ' ').trim();
				if (line) allText += line + '\n';
			}
		}
		return allText;
	} catch (e) {
		
		return '';
	}
}

function parseMoneyToNumber(s?: string | null): number | null {
	if (!s) return null;
	const cleaned = s
		.replace(/\s/g, '')
		.replace(/\$/g, '')
		.replace(/\./g, '')
		.replace(/,/g, '.');
	const n = Number.parseFloat(cleaned);
	return Number.isFinite(n) ? n : null;
}

function detectDeclaredTotal(text: string): number | null {
	const lines = text.split(/\r?\n/);
	let candidate: number | null = null;
	for (const line of lines) {
		if (/total/i.test(line)) {
			const m = line.match(/([-$\s\d\.,]+)/g);
			if (m) {
				for (const piece of m) {
					const val = parseMoneyToNumber(piece);
					if (val !== null) candidate = val;
				}
			}
		}
	}
	return candidate;
}

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','setiembre','octubre','noviembre','diciembre'];

function detectPeriod(text: string): { month?: number | null; year?: number | null; raw?: string | null } {
	const m1 = text.match(/\b(0?[1-9]|1[0-2])[\/\-](\d{4})\b/);
	if (m1) {
		return { month: Number(m1[1]), year: Number(m1[2]), raw: m1[0] };
	}
	const monthsAlt = MONTHS_ES.join('|');
	const re2 = new RegExp(`(?:^|[^a-záéíóúñ])(?:periodo|período)?\s*:?\s*(${monthsAlt})\s*[\-–—\/]?\s*(\\d{4})(?=$|[^0-9])`, 'i');
	const m2 = text.match(re2);
	if (m2) {
		const monthName = m2[1].toLowerCase();
		const idx = MONTHS_ES.indexOf(monthName);
		return { month: idx >= 0 ? idx + 1 : null, year: Number(m2[2]), raw: m2[0] };
	}
	return { month: null, year: null, raw: null };
}

function parseSelectedPeriod(input?: string | null): { month?: number | null; year?: number | null } | null {
	if (!input) return null;
	const m = input.match(/^(\d{4})-(\d{2})$/);
	if (!m) return null;
	return { year: Number(m[1]), month: Number(m[2]) };
}

function extractTableData(text: string): {
	personas?: number;
	totalRemunerativo?: number;
	cantidadLegajos?: number;
	montoConcepto?: number;
} {
	const result: Record<string, number> = {};
	
	
	
	// Patrones para datos específicos de tabla - mejorados para el formato del documento
	const PATTERNS = {
		// Buscar "Cantidad de Personas: X" en la sección de totales
		PERSONAS: /(?:cantidad de personas|cantidad personas)[\s:]*(\d+)/i,
		// Buscar totales en la sección de resumen
		TOTAL_REMUNERATIVO: /(?:total|tot)[\s]*(?:remunerativo|rem)[\s:]*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i,
		// Buscar cantidad de legajos en totales
		CANTIDAD_LEGAJOS: /(?:cantidad|legajos?)[\s:]*(\d+)/i,
		// Buscar el monto total del concepto (último número en la sección de totales)
		MONTO_CONCEPTO: /(?:monto|concepto)[\s:]*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i,
		// Patrón para extraer datos de filas de la tabla
		TABLE_ROW: /^([A-ZÁÉÍÓÚÑ\s]+?)\s+(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s+(\d+)\s+(\d{1,3}(?:\.\d{3})*(?:,\d+)?)$/m
	};
	
	// Buscar Personas
	const personasMatch = text.match(PATTERNS.PERSONAS);
	if (personasMatch) {
		result.personas = parseInt(personasMatch[1]);
	}
	
	// Buscar Total Remunerativo
	const totalRemMatch = text.match(PATTERNS.TOTAL_REMUNERATIVO);
	if (totalRemMatch) {
		const amount = totalRemMatch[1].replace(/\./g, '').replace(',', '.');
		result.totalRemunerativo = parseFloat(amount);
		
	}
	
	// Buscar Cantidad Legajos
	const legajosMatch = text.match(PATTERNS.CANTIDAD_LEGAJOS);
	if (legajosMatch) {
		result.cantidadLegajos = parseInt(legajosMatch[1]);
		
	}
	
	// Buscar Monto del Concepto
	const montoMatch = text.match(PATTERNS.MONTO_CONCEPTO);
	if (montoMatch) {
		const amount = montoMatch[1].replace(/\./g, '').replace(',', '.');
		result.montoConcepto = parseFloat(amount);
		
	}
	
	// Buscar también en las líneas individuales para extraer datos de la tabla
	
	const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	
	// Buscar la sección de totales
	const totalesIndex = lines.findIndex(line => /totales?/i.test(line));
	if (totalesIndex !== -1) {
		
		
		// Buscar "Cantidad de Personas: X" en las líneas siguientes
		for (let i = totalesIndex; i < Math.min(totalesIndex + 5, lines.length); i++) {
			const line = lines[i];
			
			
			// Buscar cantidad de personas
			const personasMatch = line.match(/(?:cantidad de personas|cantidad personas)[\s:]*(\d+)/i);
			if (personasMatch && !result.personas) {
				result.personas = parseInt(personasMatch[1]);
				
			}
			
			// Buscar el monto total (último número en la línea)
			const montoMatch = line.match(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*$/);
			if (montoMatch && !result.montoConcepto) {
				const amount = montoMatch[1].replace(/\./g, '').replace(',', '.');
				result.montoConcepto = parseFloat(amount);
				
			}
		}
	}
	
	// Calcular totales de la tabla si no se encontraron en la sección de totales
	if (!result.personas || !result.montoConcepto) {
		
		let totalPersonas = 0;
		let totalMonto = 0;
		let totalLegajos = 0;
		let totalRemunerativo = 0;
		
		// Buscar líneas que parecen filas de datos
		// El formato parece ser: NOMBRE APELLIDO CANTIDAD_LEGAJOS TOT_REMUNERATIVO
		// seguido de la siguiente línea con el MONTO_CONCEPTO
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Patrón para línea de persona: NOMBRE APELLIDO CANTIDAD_LEGAJOS TOT_REMUNERATIVO
			const personaMatch = line.match(/^([a-záéíóúñ\s]+?)\s+(\d+)\s+(\d+(?:\.\d+)?)$/);
			
			if (personaMatch) {
				const nombre = personaMatch[1].trim();
				const legajos = parseInt(personaMatch[2]);
				const remunerativo = parseFloat(personaMatch[3]);
				
				// Buscar la siguiente línea que debería tener el monto del concepto
				let montoConcepto = 0;
				if (i + 1 < lines.length) {
					const nextLine = lines[i + 1];
					
					// La siguiente línea debería ser solo un número (monto del concepto)
					const montoMatch = nextLine.match(/^(\d+(?:\.\d+)?)$/);
					if (montoMatch) {
						montoConcepto = parseFloat(montoMatch[1]);
					}
				}
				
				totalPersonas++;
				totalRemunerativo += remunerativo;
				totalLegajos += legajos;
				totalMonto += montoConcepto;
				
				
			}
		}
		
		// Usar los totales calculados si no se encontraron en la sección de totales
		if (totalPersonas > 0) {
			if (!result.personas) result.personas = totalPersonas;
			if (!result.totalRemunerativo) result.totalRemunerativo = totalRemunerativo;
			if (!result.cantidadLegajos) result.cantidadLegajos = totalLegajos;
			if (!result.montoConcepto) result.montoConcepto = totalMonto;
			

		}
	}
	
	
	return result;
}

function extractPersonas(text: string): Array<{
	nombre: string;
	totRemunerativo: number;
	cantidadLegajos: number;
	montoConcepto: number;
}> {
	const personas: Array<{
		nombre: string;
		totRemunerativo: number;
		cantidadLegajos: number;
		montoConcepto: number;
	}> = [];
	
	
	const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	
	
	
	
	// Buscar líneas que parecen filas de datos de personas
	// El formato parece ser: NOMBRE APELLIDO CANTIDAD_LEGAJOS TOT_REMUNERATIVO
	// seguido de la siguiente línea con el MONTO_CONCEPTO
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		
		// Patrón para línea de persona: NOMBRE APELLIDO CANTIDAD_LEGAJOS TOT_REMUNERATIVO
		const personaMatch = line.match(/^([a-záéíóúñ\s]+?)\s+(\d+)\s+(\d+(?:\.\d+)?)$/);
		
		if (personaMatch) {
			const nombre = personaMatch[1].trim();
			const legajos = parseInt(personaMatch[2]);
			const remunerativo = parseFloat(personaMatch[3]);
			
			// Buscar la siguiente línea que debería tener el monto del concepto
			let montoConcepto = 0;
			if (i + 1 < lines.length) {
				const nextLine = lines[i + 1];
				
				
				// La siguiente línea debería ser solo un número (monto del concepto)
				const montoMatch = nextLine.match(/^(\d+(?:\.\d+)?)$/);
				if (montoMatch) {
					montoConcepto = parseFloat(montoMatch[1]);
					
				} else {
					
				}
			}
			
			personas.push({
				nombre: nombre.toUpperCase(),
				totRemunerativo: remunerativo,
				cantidadLegajos: legajos,
				montoConcepto: montoConcepto
			});
			

		} else {
			
		}
	}
	
	
	
	return personas;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentType = request.headers.get('content-type');
		if (!contentType || !contentType.includes('multipart/form-data')) {
			return json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const selectedPeriodRaw = (formData.get('selectedPeriod') as string | null) ?? null;
		const allowOCR = String(formData.get('allowOCR') ?? 'true') === 'true';
		if (!file) {
			return json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
		}

		if (file.size > MAX_FILE_SIZE) {
			return json({ error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 413 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const detected = await fileTypeFromBuffer(buffer);
		if (!detected || detected.mime !== 'application/pdf') {
			return json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
		}
		if (!buffer.slice(0, 4).equals(Buffer.from('%PDF'))) {
			return json({ error: 'El archivo no parece ser un PDF válido' }, { status: 400 });
		}

		const timestamp = Date.now();
		const ext = file.name.split('.').pop() || 'pdf';
		const savedName = `${timestamp}.${ext}`;
		const savedPath = join(ANALYZER_DIR, savedName);

		await writeFile(savedPath, buffer);

		// 1) Intentar pdfjs-dist legacy (por líneas)
		
		let extractedText = await extractTextWithPdfJs(buffer);
		
		
		
		

		// 2) Fallback a pdf-parse si no devolvió texto
		if (!extractedText || extractedText.trim().length === 0) {
			
			try {
				// Importar pdf-parse dinámicamente para evitar problemas de cliente
				const pdfParseModule = await import('pdf-parse');
				const result = await pdfParseModule.default(buffer);
				extractedText = (result.text || '');
				
				
				
				
			} catch (e) {
				
			}
		} else {
			
		}

		extractedText = extractedText.toLowerCase();
		

		let kind: 'comprobante' | 'listado' | 'desconocido' = 'desconocido';
		if (extractedText) {
			
			const isComprobante = /(comprobante|transferencia|operaci[oó]n|cbu|importe|referencia)/i.test(extractedText);
			const isListado = /(listado|detalle de aportes|aportes|cuil|cuit|legajo|n[oº]\.\?\s*orden)/i.test(extractedText);
			
			
			
			
			
			if (isComprobante && !isListado) {
				kind = 'comprobante';
				
			} else if (isListado && !isComprobante) {
				kind = 'listado';
				
			} else if (isComprobante && isListado) {
				kind = 'desconocido';
				
			} else {
				
			}
		} else {
			
		}

		let needsOCR = extractedText.trim().length === 0;
		let ocrText: string | null = null;
		
		
		
		
		if (needsOCR && allowOCR) {
			
			try {
				const ocr = await ocrPdfFirstPage(buffer);
				if (ocr && ocr.text.trim()) {
					const t = ocr.text.toLowerCase();
					ocrText = t;
					
					
					
					
					const isComprobante = /(comprobante|transferencia|operaci[oó]n|cbu|importe|referencia)/i.test(t);
					const isListado = /(listado|detalle de aportes|aportes|cuil|cuit|legajo|n[oº]\.\?\s*orden)/i.test(t);
					
					
					
					
					if (isComprobante && !isListado) {
						kind = 'comprobante';
						
					} else if (isListado && !isComprobante) {
						kind = 'listado';
						
					} else {
						kind = 'desconocido';
						
					}
					needsOCR = false;
				} else {
					
				}
			} catch (e) {
				
			}
		} else if (needsOCR && !allowOCR) {
			
		} else {
			
		}

		const fullText = (extractedText && extractedText.trim().length > 0) ? extractedText : (ocrText || '');
		
		
		
		

		let preview: unknown = undefined;
		let checks: unknown = undefined;

		
		const rawLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
		
		
		
		const rows = rawLines
			.map((line, idx) => ({ lineNumber: idx + 1, ...extractLineData(line) }))
			.filter((r) => r.cuit || r.importe || r.nombre);

		
		if (rows.length > 0) {
			
		}

		// Extraer datos específicos de tabla
		
		const tableData = extractTableData(fullText);
		

		// Extraer filas individuales de personas
		
		const personas = extractPersonas(fullText);
		

		if (rows.length > 0) {
			
			
			
			const sumTotal = rows.reduce((acc, r) => acc + (parseMoneyToNumber(r.importe) ?? 0), 0);
			const declaredTotal = detectDeclaredTotal(fullText);
			const totalMatches = declaredTotal != null ? Math.abs(sumTotal - declaredTotal) < 0.5 : false;
			
			
			
			
			

			const detectedPeriod = detectPeriod(fullText);
			const selectedPeriod = parseSelectedPeriod(selectedPeriodRaw);
			const periodMatches = selectedPeriod && detectedPeriod.year && detectedPeriod.month
				? (selectedPeriod.year === detectedPeriod.year && selectedPeriod.month === detectedPeriod.month)
				: null;
			


			preview = { 
				listado: { 
					count: rows.length, 
					total: sumTotal, 
					rows,
					tableData, // Incluir datos específicos de tabla
					personas // Incluir filas individuales de personas
				} 
			};
			checks = { sumTotal, declaredTotal, totalMatches, detectedPeriod, selectedPeriod, periodMatches };

			if (kind === 'desconocido') {
				kind = 'listado';
				
			}
		} else {
			
			
			
			
			// Aún así, incluir datos de tabla si se encontraron
			if (Object.keys(tableData).length > 0 || personas.length > 0) {
				preview = { 
					listado: { 
						count: 0, 
						total: 0, 
						rows: [],
						tableData,
						personas
					} 
				};
			}
		}

		

		return json({
			fileName: file.name,
			savedName,
			savedPath,
			size: file.size,
			mimeType: detected.mime,
			status: 'saved',
			classification: kind,
			needsOCR,
			preview,
			checks
		}, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Error desconocido';
		console.error('[analyzer] error:', message);
		return json({ error: 'Error al procesar el archivo', details: message }, { status: 500 });
	}
};


