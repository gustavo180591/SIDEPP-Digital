import { json, type RequestHandler } from '@sveltejs/kit';
import { writeFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { CONFIG } from '$lib/server/config';
// pdfParse se importa dinámicamente para evitar problemas de cliente
import { ocrPdfFirstPage } from '$lib/server/pdf/ocr';
import { extractLineData } from '$lib/server/pdf/parse-listado';
import { prisma } from '$lib/server/db';
import { createHash } from 'node:crypto';
import { readFile as fsReadFile } from 'node:fs/promises';

const { UPLOAD_DIR, MAX_FILE_SIZE } = CONFIG;
const ANALYZER_DIR = join(UPLOAD_DIR, 'analyzer');
const HASH_INDEX = join(ANALYZER_DIR, 'hash-index.json');

if (!existsSync(ANALYZER_DIR)) {
	mkdirSync(ANALYZER_DIR, { recursive: true, mode: 0o755 });
}
// Cargar/crear índice de hashes
async function loadHashIndex(): Promise<Record<string, { fileName: string; savedName: string; savedPath: string }>> {
  try {
    const buf = await fsReadFile(HASH_INDEX, 'utf8');
    return JSON.parse(buf) as Record<string, { fileName: string; savedName: string; savedPath: string }>;
  } catch {
    return {};
  }
}

async function saveHashIndex(index: Record<string, { fileName: string; savedName: string; savedPath: string }>): Promise<void> {
  await writeFile(HASH_INDEX, Buffer.from(JSON.stringify(index, null, 2), 'utf8'));
}

async function extractTextWithPdfJs(buffer: Buffer): Promise<string> {
	try {
		console.log('[extractTextWithPdfJs] ===== INICIO EXTRACCIÓN PDF.JS =====');
		console.log('[extractTextWithPdfJs] Tamaño del buffer:', buffer.length, 'bytes');
		
		// Usamos la build legacy para Node y deshabilitamos worker
		const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
		console.log('[extractTextWithPdfJs] PDF.js importado correctamente');
		
		// En entornos Node no es necesario establecer workerSrc; usamos useWorker:false
		const uint8 = new Uint8Array(buffer);
		const loadingTask = pdfjs.getDocument({ data: uint8, useWorker: false });
		const pdf = await loadingTask.promise;
		const numPages = pdf.numPages ?? 1;
		
		console.log('[extractTextWithPdfJs] PDF cargado. Número de páginas:', numPages);
		
		let allText = '';
		for (let p = 1; p <= numPages; p++) {
			console.log(`[extractTextWithPdfJs] Procesando página ${p}/${numPages}...`);
			const page = await pdf.getPage(p);
			const content = await page.getTextContent();
			const items = content.items as Array<any>;
			console.log(`[extractTextWithPdfJs] Página ${p}: ${items.length} elementos de texto encontrados`);
			
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
		
		console.log('[extractTextWithPdfJs] Texto total extraído:', allText.length, 'caracteres');
		console.log('[extractTextWithPdfJs] Primeras 500 caracteres:', allText.substring(0, 500));
		console.log('[extractTextWithPdfJs] ===== FIN EXTRACCIÓN PDF.JS =====');
		
		return allText;
	} catch (e) {
		console.error('[extractTextWithPdfJs] ERROR durante la extracción:', e);
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

// Extrae un CUIT de cabecera (institución) priorizando líneas con la palabra "cuit"
function extractInstitutionCuit(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // Aceptar formatos con guiones variables: N{1,3}-N{6,10}-N{1,3}
  // y también 11 dígitos consecutivos como fallback
  const CUIT_HYP_RE = /(\d{1,3})-(\d{6,10})-(\d{1,3})/; // no global, por línea
  const CUIT_HYP_ALL_RE = /(\d{1,3})-(\d{6,10})-(\d{1,3})/g; // global, para matchAll
  const CUIT_PLAIN_ALL_RE = /(\d{11})/g; // 11 dígitos seguidos

  // 1) Buscar con etiquetas comunes cercanas a CUIT institucional
  const labeled = lines.slice(0, 150).find((line) =>
    /(cuit\s*(?:del\s+)?(?:empleador|beneficiario|agente|instituci[oó]n)|cuit\s*:)/i.test(line)
  );
  if (labeled) {
    const m1 = labeled.match(CUIT_HYP_RE);
    if (m1) {
      const digits = `${m1[1]}${m1[2]}${m1[3]}`.replace(/\D/g, '');
      if (digits.length === 11) return digits;
    }
    const m2 = labeled.match(/(\d{11})/);
    if (m2) return m2[1];
  }

  // 2) Buscar cualquier mención a CUIT o CUIL en primeras N líneas
  for (let i = 0; i < Math.min(lines.length, 150); i++) {
    const line = lines[i];
    if (!/cuit|cuil/i.test(line)) continue;
    const m1 = line.match(CUIT_HYP_RE);
    if (m1) {
      const digits = `${m1[1]}${m1[2]}${m1[3]}`.replace(/\D/g, '');
      if (digits.length === 11) return digits;
    }
    const m2 = line.match(/(\d{11})/);
    if (m2) return m2[1];
  }

  // 3) Recolectar todos los CUIT del documento y priorizar prefijos de persona jurídica (30/33/34)
  const candidates: string[] = [];
  for (const mm of text.matchAll(CUIT_HYP_ALL_RE)) {
    const d = `${mm[1]}${mm[2]}${mm[3]}`.replace(/\D/g, '');
    if (d.length === 11) candidates.push(d);
  }
  for (const mm of text.matchAll(CUIT_PLAIN_ALL_RE)) {
    const d = mm[1];
    if (d && d.length === 11) candidates.push(d);
  }
  const allMatches = Array.from(new Set(candidates));
  if (allMatches.length) {
    console.log('[analyzer][institution] Candidatos de CUIT encontrados:', allMatches);
  }
  if (allMatches.length > 0) {
    const juridicos = allMatches.find((d) => /^(30|33|34)/.test(d));
    if (juridicos) return juridicos;
    return allMatches[0];
  }

  return null;
}

function formatCuit(cuitDigits?: string | null): string | null {
  if (!cuitDigits) return null;
  const digits = cuitDigits.replace(/\D/g, '');
  if (digits.length !== 11) return null;
  // Mostrar también con 3-8-? si prefijo tiene 3 dígitos
  const pref = digits.slice(0, 3);
  const alt = `${pref}-${digits.slice(3, 11)}-${digits.slice(11)}`; // no se usa aún, pero dejamos trazabilidad
  const standard = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  // Preferimos estándar 2-8-1
  return standard;
}

function extractInstitutionName(text: string, normalizedCuit: string | null): string | null {
  if (!normalizedCuit) return null;
  const digits = normalizedCuit.replace(/\D/g, '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const CUIT_ANY = new RegExp(digits.replace(/([.*+?^${}()|\[\]\\])/g, '\\$1'));

  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const line = lines[i];
    if (CUIT_ANY.test(line)) {
      // Quitar el CUIT y números; quedarse con letras como nombre probable
      const guess = line
        .replace(/\d[\d\-.,/ ]*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (guess && /[a-záéíóúñ]/i.test(guess)) return guess;
      // Probar con la línea anterior si es más "nominal"
      if (i > 0) {
        const prev = lines[i - 1].replace(/\d[\d\-.,/ ]*/g, '').replace(/\s{2,}/g, ' ').trim();
        if (prev && /[a-záéíóúñ]/i.test(prev)) return prev;
      }
    }
  }
  return null;
}

// Intenta extraer nombre y dirección cercanos a la línea del CUIT
function extractInstitutionNameAndAddress(text: string, normalizedCuit: string | null): { name?: string | null; address?: string | null } {
  if (!normalizedCuit) return { name: null, address: null };
  const digits = normalizedCuit.replace(/\D/g, '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const CUIT_LINE_RE = new RegExp(digits.replace(/([.*+?^${}()|\[\]\\])/g, '\\$1'));

  const idx = lines.findIndex((l) => CUIT_LINE_RE.test(l));
  if (idx === -1) return { name: null, address: null };

  const addressLine = idx > 0 ? lines[idx - 1] : null;
  const nameLine = idx > 1 ? lines[idx - 2] : null;

  const looksLikeAddress = (s?: string | null) => !!s && /\b(km|kil[oó]metro|ruta|av\.?|avenida|calle|n\.?|\d{2,})\b/i.test(s);
  const clean = (s?: string | null) => (s ? s.replace(/\s{2,}/g, ' ').trim() : null);

  let name: string | null = null;
  let address: string | null = null;

  if (looksLikeAddress(addressLine)) {
    address = clean(addressLine);
    name = clean(nameLine);
  } else if (looksLikeAddress(nameLine)) {
    address = clean(nameLine);
    name = clean(addressLine);
  } else {
    name = clean(extractInstitutionName(text, normalizedCuit));
  }

  if (address && /\d{2,3}-?\d{6,10}-?\d{1,3}/.test(address)) address = null;

  return { name, address };
}

function extractTableData(text: string): {
	personas?: number;
	totalRemunerativo?: number;
	cantidadLegajos?: number;
	montoConcepto?: number;
} {
	const result: Record<string, number> = {};
	
	const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	
	console.log('[extractTableData] Iniciando extracción de tabla...');
	
	// PRIORIDAD 1: Buscar línea "Totales:" seguida del número total
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Buscar "Totales:" con o sin el número en la misma línea
		if (/^totales?\s*:?\s*/i.test(line)) {
			console.log('[extractTableData] Línea "Totales:" encontrada:', line);

			// Extraer el número si está en la misma línea
			const sameLineMatch = line.match(/totales?\s*:?\s*([\d.]+)/i);
			if (sameLineMatch) {
				result.montoConcepto = parseFloat(sameLineMatch[1]);
				console.log('[extractTableData] Monto del Concepto (misma línea):', result.montoConcepto);
			} else if (i + 1 < lines.length) {
				// Si no está en la misma línea, buscar en la siguiente
				const nextLine = lines[i + 1];
				const nextLineMatch = nextLine.match(/^\s*([\d.]+)\s*$/);
				if (nextLineMatch) {
					result.montoConcepto = parseFloat(nextLineMatch[1]);
					console.log('[extractTableData] Monto del Concepto (línea siguiente):', result.montoConcepto);
				}
			}
		}

		// Buscar "Cantidad de Personas:"
		const personasMatch = line.match(/cantidad\s+de\s+personas\s*:?\s*(\d+)/i);
		if (personasMatch && !result.personas) {
			result.personas = parseInt(personasMatch[1]);
			console.log('[extractTableData] Personas encontradas:', result.personas);
		}
	}
	
	// PRIORIDAD 2: Si no encontramos montoConcepto en TOTALES, calcular sumando personas
	if (!result.montoConcepto) {
		console.log('[extractTableData] No se encontró Monto del Concepto en TOTALES, calculando desde personas...');
		let totalMonto = 0;
		let totalPersonas = 0;
		let totalLegajos = 0;
		let totalRemunerativo = 0;
		
		// Buscar líneas de personas en el formato UNA SOLA LÍNEA:
		// "NOMBRE APELLIDO  TOT_REMUNERATIVO  CANTIDAD_LEGAJOS  MONTO_DEL_CONCEPTO"
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Saltar encabezados
			if (/^(totales?|personas?|nombre|apellido|legajo|concepto|cantidad|tot\.?\s*rem|periodo|monto\s+del)/i.test(line)) {
				continue;
			}
			
			// Patrón mejorado: captura números con puntos como separadores de miles
			// Formato: "NOMBRE  123456.78  2  1234.56" o "NOMBRE  12.34  1  123.45"
			const personaMatch = line.match(/^([a-záéíóúñ\s]+?)\s+([\d.]+)\s+(\d+)\s+([\d.]+)$/i);

			if (personaMatch) {
				const nombre = personaMatch[1].trim();
				const totRemStr = personaMatch[2];
				const legajos = parseInt(personaMatch[3]);
				const montoStr = personaMatch[4];

				// Los números en el PDF usan punto como separador decimal (formato inglés)
				const totRemunerativo = parseFloat(totRemStr);
				const montoConcepto = parseFloat(montoStr);

				if (Number.isFinite(montoConcepto) && montoConcepto > 0) {
					totalPersonas++;
					totalMonto += montoConcepto;
					totalLegajos += legajos;
					totalRemunerativo += totRemunerativo;

					console.log(`[extractTableData] Persona: ${nombre}, TotRem: ${totRemunerativo}, Legajos: ${legajos}, Monto: ${montoConcepto}`);
				}
			}
		}
		
		// Usar los totales calculados
		if (totalPersonas > 0) {
			if (!result.personas) result.personas = totalPersonas;
			if (!result.montoConcepto) result.montoConcepto = totalMonto;
			if (!result.cantidadLegajos) result.cantidadLegajos = totalLegajos;
			if (!result.totalRemunerativo) result.totalRemunerativo = totalRemunerativo;
			
			console.log('[extractTableData] Totales calculados desde personas:', {
				personas: totalPersonas,
				montoConcepto: totalMonto,
				legajos: totalLegajos,
				totalRemunerativo: totalRemunerativo
			});
		}
	}
	
	console.log('[extractTableData] Resultado final:', result);
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
	
	console.log('[extractPersonas] Iniciando extracción de personas...');
	
	// Buscar líneas que parecen filas de datos de personas
	// Formato esperado en UNA SOLA LÍNEA:
	//  "NOMBRE APELLIDO  TOT_REMUNERATIVO  CANTIDAD_LEGAJOS  MONTO_DEL_CONCEPTO"
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Saltar líneas que son encabezados o secciones especiales
		if (/^(totales?|personas?|nombre|apellido|legajo|concepto|cantidad|tot\.?\s*rem|periodo|monto\s+del|page\s+\d)/i.test(line)) {
			continue;
		}

		// Patrón 1: TODO en una línea: "NOMBRE  TOT_REM  CANT_LEG  MONTO"
		const personaMatch1 = line.match(/^([a-záéíóúñ\s]+?)\s+([\d.]+)\s+(\d+)\s+([\d.]+)$/i);

		if (personaMatch1) {
			const nombre = personaMatch1[1].trim();
			const totRemunerativo = parseFloat(personaMatch1[2]);
			const legajos = parseInt(personaMatch1[3]);
			const montoConcepto = parseFloat(personaMatch1[4]);

			if (Number.isFinite(montoConcepto) && montoConcepto > 0 && Number.isFinite(totRemunerativo) && totRemunerativo > 0) {
				personas.push({
					nombre: nombre.toUpperCase(),
					totRemunerativo,
					cantidadLegajos: legajos,
					montoConcepto
				});
				console.log(`[extractPersonas] Persona agregada (formato 1): ${nombre}, TotRem: ${totRemunerativo}, Legajos: ${legajos}, Monto: ${montoConcepto}`);
			}
			continue;
		}

		// Patrón 2: Dos líneas - Primera línea: "NOMBRE  CANT_LEG  PARCIAL"
		//                         Segunda línea: "TOT_REM_COMPLETO"
		//                         Tercera línea potencial: solo números (ignorar si no encaja)
		// Ejemplo:
		//   "cabrera silvio victor 1 237.34"
		//   "23734.18"
		const personaMatch2 = line.match(/^([a-záéíóúñ\s]+?)\s+(\d+)\s+([\d.]+)$/i);

		if (personaMatch2 && i + 1 < lines.length) {
			const nombre = personaMatch2[1].trim();
			const legajos = parseInt(personaMatch2[2]);
			const parcial = parseFloat(personaMatch2[3]);

			const nextLine = lines[i + 1];
			// La siguiente línea debería ser solo un número (el tot remunerativo completo)
			const totRemMatch = nextLine.match(/^([\d.]+)$/);

			if (totRemMatch) {
				const totRemunerativo = parseFloat(totRemMatch[1]);

				// El monto del concepto es el parcial de la primera línea
				// O puede estar en otra parte - por ahora usamos el parcial
				const montoConcepto = parcial;

				if (Number.isFinite(montoConcepto) && montoConcepto > 0 && Number.isFinite(totRemunerativo) && totRemunerativo > 0) {
					personas.push({
						nombre: nombre.toUpperCase(),
						totRemunerativo,
						cantidadLegajos: legajos,
						montoConcepto
					});
					console.log(`[extractPersonas] Persona agregada (formato 2): ${nombre}, TotRem: ${totRemunerativo}, Legajos: ${legajos}, Monto: ${montoConcepto}`);
					i++; // Saltar la siguiente línea ya que la procesamos
				}
			}
		}
	}
	
	console.log(`[extractPersonas] Total de personas encontradas: ${personas.length}`);
	
	// Calcular y mostrar el total de montos
	if (personas.length > 0) {
		const totalMonto = personas.reduce((sum, p) => sum + p.montoConcepto, 0);
		console.log(`[extractPersonas] Suma total de Monto del Concepto: ${totalMonto}`);
	}
	
	return personas;
}

function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
    const cleaned = fullName.trim().replace(/\s+/g, ' ');
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length === 0) return { firstName: cleaned, lastName: null };
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || null;
    return { firstName, lastName };
}

// Buscar un miembro existente por nombre dentro de la institución (heurística simple)
async function findMemberByName(
    institutionId: string,
    fullName: string
): Promise<{ id: string } | null> {
	const stripDiacritics = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
	const normalize = (s: string) => stripDiacritics(s).toUpperCase().replace(/\s+/g, ' ').trim();

	const name = normalize(fullName);
    const parts = name.split(' ').filter(Boolean);
    const first = parts[0] ?? '';
    const rest = parts.slice(1).join(' ');

	try {
		// Intentos directos en DB (baratos)
        // 0) Coincidencia por fullName (case-insensitive)
        let m = await prisma.member.findFirst({ where: { institucionId: institutionId, fullName: { equals: fullName, mode: 'insensitive' } } as any });
		if (m) return { id: m.id };
        // 1) Búsqueda por tokens dentro de fullName
        if (first && rest) {
            m = await prisma.member.findFirst({
                where: {
                    institucionId: institutionId,
                    AND: [
                        { fullName: { contains: first, mode: 'insensitive' } },
                        { fullName: { contains: rest, mode: 'insensitive' } }
                    ]
                }
            });
            if (m) return { id: m.id };
        }
        m = await prisma.member.findFirst({ where: { institucionId: institutionId, fullName: { contains: fullName, mode: 'insensitive' } } });
		if (m) return { id: m.id };

		// Fallback: traer algunos miembros y matchear en memoria con normalización
        const candidates = await prisma.member.findMany({
            where: { institucionId: institutionId },
            select: { id: true, fullName: true },
            take: 500
        });
        let best: { id: string; score: number } | null = null;
        for (const c of candidates) {
            const full = normalize(c.fullName ?? '');

            let score = 0;
            if (full === name) score = 100;
            else if (full.includes(name) || name.includes(full)) score = 90;
            else {
                const tokens = new Set(parts);
                let hits = 0;
                for (const t of tokens) {
                    if (t && full.includes(t)) hits++;
                }
                score = hits * 10;
                // bonificación si primera palabra matchea el comienzo del nombre completo
                if (first && full.startsWith(first)) score += 5;
            }
            if (!best || score > best.score) best = { id: c.id, score };
        }
        if (best && best.score >= 20) return { id: best.id };
	} catch (e) {
		console.warn('[analyzer][member] Búsqueda de miembro falló:', e);
	}
	return null;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('\n\n========================================');
		console.log('🚀 [APORTES] INICIO DE PROCESAMIENTO');
		console.log('========================================\n');
		
		const contentType = request.headers.get('content-type');
		console.log('[APORTES][1] Content-Type:', contentType);
		
		if (!contentType || !contentType.includes('multipart/form-data')) {
			return json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const selectedPeriodRaw = (formData.get('selectedPeriod') as string | null) ?? null;
		const allowOCR = String(formData.get('allowOCR') ?? 'true') === 'true';
		
		console.log('[APORTES][2] Archivo recibido:', file?.name);
		console.log('[APORTES][2] Tamaño:', file?.size, 'bytes');
		console.log('[APORTES][2] Tipo:', file?.type);
		console.log('[APORTES][2] Período seleccionado:', selectedPeriodRaw);
		console.log('[APORTES][2] Permitir OCR:', allowOCR);
		
		if (!file) {
			return json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
		}

		if (file.size > MAX_FILE_SIZE) {
			return json({ error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 413 });
		}

		console.log('[APORTES][3] Convirtiendo archivo a buffer...');
		const buffer = Buffer.from(await file.arrayBuffer());
		console.log('[APORTES][3] Buffer creado:', buffer.length, 'bytes');
		
		// Calcular hash SHA-256 para deduplicación
		console.log('[APORTES][4] Calculando hash SHA-256...');
		const bufferHash = createHash('sha256').update(buffer).digest('hex');
		console.log('[APORTES][4] Hash SHA-256:', bufferHash);
		
		console.log('[APORTES][5] Verificando duplicados en índice de hashes...');
		const hashIndex = await loadHashIndex();
		if (hashIndex[bufferHash]) {
			console.warn('[APORTES][5] ⚠️ Duplicado detectado en índice:', hashIndex[bufferHash]);
			return json({
				status: 'duplicate',
				message: 'El archivo ya fue cargado anteriormente',
				bufferHash,
				previous: hashIndex[bufferHash]
			}, { status: 409 });
		}
		console.log('[APORTES][5] ✓ No es duplicado en índice');
		
		// Deduplicación en DB por hash
		console.log('[APORTES][6] Verificando duplicados en base de datos...');
		try {
			const existingPdf = await prisma.pdfFile.findUnique({ where: { bufferHash } });
			if (existingPdf) {
				console.warn('[APORTES][6] ⚠️ Duplicado en DB:', { id: existingPdf.id, fileName: existingPdf.fileName });
				return json({ status: 'duplicate', message: 'El archivo ya fue cargado (DB)', bufferHash, pdfFileId: existingPdf.id }, { status: 409 });
			}
			console.log('[APORTES][6] ✓ No es duplicado en DB');
		} catch (dbDupErr) {
			console.warn('[APORTES][6] ⚠️ Error verificando duplicado en DB:', dbDupErr);
		}

		console.log('[APORTES][7] Validando tipo de archivo...');
		const detectedFileType = await fileTypeFromBuffer(buffer);
		console.log('[APORTES][7] Tipo detectado:', detectedFileType?.mime);
		
		if (!detectedFileType || detectedFileType.mime !== 'application/pdf') {
			console.error('[APORTES][7] ❌ Tipo de archivo inválido:', detectedFileType?.mime);
			return json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
		}
		if (!buffer.slice(0, 4).equals(Buffer.from('%PDF'))) {
			console.error('[APORTES][7] ❌ El buffer no contiene un PDF válido');
			return json({ error: 'El archivo no parece ser un PDF válido' }, { status: 400 });
		}
		console.log('[APORTES][7] ✓ Archivo PDF válido');

		const timestamp = Date.now();
		const ext = file.name.split('.').pop() || 'pdf';
		const savedName = `${timestamp}.${ext}`;
		const savedPath = join(ANALYZER_DIR, savedName);

		console.log('[APORTES][8] Guardando archivo...');
		console.log('[APORTES][8] Ruta:', savedPath);
		await writeFile(savedPath, buffer);
		console.log('[APORTES][8] ✓ Archivo guardado exitosamente');
		
		// Registrar en índice de hashes
		console.log('[APORTES][9] Registrando en índice de hashes...');
		hashIndex[bufferHash] = { fileName: file.name, savedName, savedPath };
		await saveHashIndex(hashIndex);
		console.log('[APORTES][9] ✓ Registrado en índice');

		// NOTE: El PdfFile se creará más adelante una vez detectemos el tipo (FOPID/SUELDO)
		let pdfFileId: string | null = null;

		// 1) Intentar pdfjs-dist legacy (por líneas)
		console.log('[APORTES][11] Extrayendo texto del PDF con PDF.js...');
		let extractedText = await extractTextWithPdfJs(buffer);
		console.log('[APORTES][11] Texto extraído:', extractedText ? `${extractedText.length} caracteres` : 'VACÍO');
		
		
		
		

		// 2) Fallback a pdf-parse si no devolvió texto
		if (!extractedText || extractedText.trim().length === 0) {
			console.log('[APORTES][12] PDF.js no extrajo texto. Intentando con pdf-parse...');
			try {
				// Importar pdf-parse dinámicamente para evitar problemas de cliente
				const pdfParseModule = await import('pdf-parse');
				const result = await pdfParseModule.default(buffer);
				extractedText = (result.text || '');
				console.log('[APORTES][12] pdf-parse extrajo:', extractedText.length, 'caracteres');
			} catch (e) {
				console.error('[APORTES][12] ❌ Error en pdf-parse:', e);
			}
		} else {
			console.log('[APORTES][12] ✓ Usando texto de PDF.js');
		}

		console.log('[APORTES][13] Convirtiendo texto a minúsculas...');
		extractedText = extractedText.toLowerCase();
		console.log('[APORTES][13] ✓ Texto procesado:', extractedText.length, 'caracteres');
		

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
		console.log('[APORTES][17] Texto final para procesamiento:', fullText.length, 'caracteres');

		let preview: unknown = undefined;
		let checks: unknown = undefined;
		// let institution: { id: string; name: string | null; cuit: string | null; address?: string | null } | undefined = undefined; // Se declara más abajo
		let membersResult: { found: number; created: number; updated: number; names: string[] } | undefined = undefined;

		// DEBUG: mostrar primeras líneas del texto para diagnóstico
		console.log('[APORTES][18] Mostrando primeras 40 líneas del texto:');
		try {
			const firstLines = fullText.split(/\r?\n/).slice(0, 40);
			firstLines.forEach((line, idx) => {
				console.log(`  Línea ${idx + 1}: "${line}"`);
			});
		} catch (e) {
			console.error('[APORTES][18] Error mostrando líneas:', e);
		}

		console.log('[APORTES][19] Procesando líneas...');
		const rawLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
		console.log('[APORTES][19] Total de líneas no vacías:', rawLines.length);
		
		console.log('[APORTES][20] Extrayendo datos de líneas con extractLineData...');
		const rows = rawLines
			.map((line, idx) => ({ lineNumber: idx + 1, ...extractLineData(line) }))
			.filter((r) => r.cuit || r.importe || r.nombre);
		console.log('[APORTES][20] Filas extraídas con extractLineData:', rows.length);

		// Detectar institución por CUIT de cabecera
		console.log('[APORTES][21] Detectando institución por CUIT...');
		let institution: { id: string; name: string | null; cuit: string | null; address?: string | null } | undefined = undefined;
		try {
			const instCuitDigits = extractInstitutionCuit(fullText);
			console.log('[APORTES][21] CUIT extraído (crudo):', instCuitDigits);
			const instCuit = formatCuit(instCuitDigits);
			console.log('[APORTES][21] CUIT normalizado:', instCuit);
			
			if (!instCuit) {
				console.error('[APORTES][21] ❌ No se pudo determinar CUIT institucional desde el PDF');
				return json({
					status: 'error',
					message: 'No se pudo detectar el CUIT de la institución en el PDF.',
					details: { hint: 'Verifique el documento o cargue la institución manualmente.' }
				}, { status: 400 });
			}
			
			console.log('[APORTES][22] Conectando a base de datos...');
			try {
				await prisma.$connect();
				console.log('[APORTES][22] ✓ Conexión a DB OK');
			} catch (dbConnErr) {
				console.error('[APORTES][22] ❌ Error conectando a DB:', dbConnErr);
			}

			console.log('[APORTES][23] Buscando institución en DB por CUIT:', instCuit);
			try {
				const existing = await prisma.institution.findUnique({ where: { cuit: instCuit } });
				if (existing) {
					console.log('[APORTES][23] ✓ Institución encontrada:', { id: existing.id, cuit: existing.cuit, name: existing.name });
					institution = { id: existing.id, name: existing.name ?? null, cuit: existing.cuit ?? null, address: existing.address ?? null };
				} else {
					console.error('[APORTES][23] ❌ No existe institución con ese CUIT');
					return json({
						status: 'error',
						message: 'No existe una institución con ese CUIT. Debe cargarla en Instituciones.',
						details: { cuit: instCuit }
					}, { status: 404 });
				}
			} catch (dbErr) {
				console.error('[APORTES][23] ❌ Error consultando institución:', dbErr);
				throw dbErr;
			}
		} catch (e) {
			console.error('[APORTES][21] ❌ Error general en detección de institución:', e);
			throw e;
		}

		if (rows.length > 0) {
			console.log('[APORTES][24] Rows detectados con extractLineData:', rows.length);
		}

		// Extraer datos específicos de tabla
		console.log('[APORTES][25] 📊 Extrayendo datos de tabla con extractTableData...');
		const tableData = extractTableData(fullText);
		console.log('[APORTES][25] Datos de tabla extraídos:', tableData);

		// Extraer filas individuales de personas
		console.log('[APORTES][26] 👥 Extrayendo personas con extractPersonas...');
		const personas = extractPersonas(fullText);
		console.log('[APORTES][26] Total de personas extraídas:', personas.length);
		
		// Detectar tipo de PDF (FOPID o SUELDO)
		console.log('[APORTES][26.5] 🔍 Detectando tipo de PDF...');
		let pdfType: 'FOPID' | 'SUELDO' = 'SUELDO'; // default
		
		// Buscar "FOPID" o "fopid" en las primeras líneas del texto
		const firstLines = fullText.split(/\r?\n/).slice(0, 20).join('\n');
		if (/\bfopid\b/i.test(firstLines)) {
			pdfType = 'FOPID';
			console.log('[APORTES][26.5] ✓ PDF detectado como FOPID');
		} else {
			console.log('[APORTES][26.5] ✓ PDF detectado como SUELDO (default)');
		}
		
		// Crear PdfFile en DB con el tipo detectado
		console.log('[APORTES][27] 💾 Creando registro PdfFile en DB con tipo:', pdfType);
		try {
			const createdPdf = await prisma.pdfFile.create({ 
				data: { 
					fileName: file.name, 
					bufferHash,
					type: pdfType
				} 
			});
			pdfFileId = createdPdf.id;
			console.log('[APORTES][27] ✓ PdfFile creado:', { id: pdfFileId, fileName: createdPdf.fileName, type: pdfType });
		} catch (pdfDbErr) {
			console.error('[APORTES][27] ❌ Error al crear PdfFile en DB:', pdfDbErr);
			throw pdfDbErr;
		}
		
		// Persistir ContributionLine por cada persona asociada al PdfFile
		console.log('[APORTES][28] 💾 Guardando contribution lines y buscando/creando miembros...');
		try {
			if (pdfFileId && institution && personas.length > 0) {
				let membersCreated = 0;
				let membersFound = 0;
				
				for (const p of personas) {
					const nombreUpperCase = p.nombre.toUpperCase();
					console.log(`[APORTES][28] Procesando persona: ${nombreUpperCase}`);
					
					// Buscar miembro por nombre (case-insensitive) dentro de la institución
					let member = await findMemberByName(institution.id, nombreUpperCase);
					
					if (!member) {
						// Crear miembro si no existe
						console.log(`[APORTES][28]   -> Miembro no encontrado, creando nuevo: ${nombreUpperCase}`);
						try {
							const createdMember = await prisma.member.create({
								data: {
									institucion: { connect: { id: institution.id } },
									fullName: nombreUpperCase
								}
							});
							member = { id: createdMember.id };
							membersCreated++;
							console.log(`[APORTES][28]   -> ✓ Miembro creado: ${createdMember.id}`);
						} catch (cmErr) {
							console.warn(`[APORTES][28]   -> ❌ Error creando miembro:`, cmErr);
						}
					} else {
						membersFound++;
						console.log(`[APORTES][28]   -> ✓ Miembro encontrado: ${member.id}`);
					}
					
					// Crear ContributionLine
					try {
						await prisma.contributionLine.create({
							data: {
								name: nombreUpperCase,
								quantity: Number.isFinite(p.cantidadLegajos) ? p.cantidadLegajos : null,
								conceptAmount: Number.isFinite(p.montoConcepto) ? p.montoConcepto.toString() : null,
								totalRem: Number.isFinite(p.totRemunerativo) ? p.totRemunerativo.toString() : null,
								pdfFile: { connect: { id: pdfFileId } },
								...(member ? { member: { connect: { id: member.id } } } : {})
							}
						});
						console.log(`[APORTES][28]   -> ✓ ContributionLine creada para ${nombreUpperCase}`);
					} catch (clErr) {
						console.error(`[APORTES][28]   -> ❌ Error creando ContributionLine:`, clErr);
					}
				}
				
				console.log(`[APORTES][28] ✓ Resumen: ${membersFound} miembros encontrados, ${membersCreated} miembros creados, ${personas.length} contribution lines creadas`);
			}
		} catch (persistErr) {
			console.error('[APORTES][28] ❌ Error en proceso de guardado:', persistErr);
		}
		

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
					tableData,
					personas
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

		// Crear PayrollPeriod asociado a la institución y al PdfFile
		console.log('[APORTES][29] 💾 Creando PayrollPeriod...');
		try {
			if (institution && pdfFileId) {
				// Determinar período a usar: seleccionado por UI o detectado del texto
				const detected = detectPeriod(fullText);
				const selected = parseSelectedPeriod(selectedPeriodRaw);
				const useYear = selected?.year ?? detected.year ?? null;
				const useMonth = selected?.month ?? detected.month ?? null;
				
				console.log('[APORTES][29] Período detectado:', detected);
				console.log('[APORTES][29] Período seleccionado:', selected);
				console.log('[APORTES][29] Usando:', { year: useYear, month: useMonth });
				
				if (!useYear || !useMonth) {
					console.warn('[APORTES][29] ⚠️ No se pudo determinar el período. Usando valores por defecto.');
					// En lugar de fallar, usar valores por defecto
					// return json({
					// 	status: 'error',
					// 	message: 'No se pudo determinar el período (mes/año). Seleccione un período o verifique el PDF.',
					// 	preview,
					// 	institution
					// }, { status: 400 });
				}

				// Calcular personas y total
				const peopleCount = tableData.personas ?? personas.length;
				const totalAmountNumber = tableData.montoConcepto ?? personas.reduce((a, p) => a + (Number.isFinite(p.montoConcepto) ? p.montoConcepto : 0), 0);
				const totalAmount = Number.isFinite(totalAmountNumber) ? totalAmountNumber.toString() : null;

				console.log('[APORTES][29] Datos para PayrollPeriod:', {
					peopleCount,
					totalAmount,
					type: pdfType
				});

				// Extraer concepto del texto (concepto general, no el tipo de PDF)
				const conceptoMatch = fullText.match(/concepto:\s*([^\n]+)/i);
				const concept = conceptoMatch ? conceptoMatch[1].trim() : 'Aporte Sindical SIDEPP (1%)';

				// Fallback para transferId requerido
				const fallbackTransferId = bufferHash || savedName;

				// Buscar o crear PayrollPeriod usando la restricción única
				let createdPeriodId: string | null = null;

				// Función helper para buscar o crear el período con retry en caso de race condition
				const getOrCreatePeriod = async (retryCount = 0): Promise<string | null> => {
					const maxRetries = 3;

					try {
						// Primero intentar encontrar el período existente (solo por institución, mes y año)
						let period = await prisma.payrollPeriod.findFirst({
							where: {
								institutionId: institution.id,
								month: useMonth || 1,
								year: useYear || new Date().getFullYear()
							}
						});

						if (period) {
							console.log('[APORTES][29] ✓ PayrollPeriod existente encontrado:', {
								id: period.id,
								month: period.month,
								year: period.year,
								concept: period.concept,
								totalAmountActual: period.totalAmount
							});

							// Actualizar el período sumando el nuevo monto
							const currentTotal = period.totalAmount ? parseFloat(period.totalAmount.toString()) : 0;
							const newTotal = currentTotal + (totalAmountNumber || 0);

							try {
								await prisma.payrollPeriod.update({
									where: { id: period.id },
									data: {
										totalAmount: newTotal,
										peopleCount: (period.peopleCount || 0) + (peopleCount || 0)
									}
								});
								console.log('[APORTES][29] ✓ PayrollPeriod actualizado con nuevo total:', {
									totalAnterior: currentTotal,
									totalNuevo: newTotal,
									montoSumado: totalAmountNumber
								});
							} catch (updateErr) {
								console.error('[APORTES][29] ❌ Error actualizando PayrollPeriod:', updateErr);
							}

							return period.id;
						}

						// Si no existe, intentar crearlo
						try {
							period = await prisma.payrollPeriod.create({
								data: {
									institution: { connect: { id: institution.id } },
									month: useMonth || 1,
									year: useYear || new Date().getFullYear(),
									concept: concept,
									peopleCount: peopleCount ?? undefined,
									totalAmount: totalAmount,
									transferId: fallbackTransferId
								}
							});
							console.log('[APORTES][29] ✓ PayrollPeriod creado:', {
								id: period.id,
								month: period.month,
								year: period.year,
								concept: period.concept,
								totalAmount: period.totalAmount
							});
							return period.id;
						} catch (createErr: any) {
							// Si falla por constraint único (race condition), reintentar buscando
							if (createErr?.code === 'P2002' && retryCount < maxRetries) {
								console.log(`[APORTES][29] Race condition detectada, reintentando búsqueda (${retryCount + 1}/${maxRetries})...`);
								await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1))); // Backoff exponencial
								return getOrCreatePeriod(retryCount + 1);
							}
							throw createErr;
						}
					} catch (err) {
						console.error('[APORTES][29] ❌ Error al gestionar PayrollPeriod:', err);
						return null;
					}
				};

				createdPeriodId = await getOrCreatePeriod();

				// Asociar el PDF al período
				if (createdPeriodId && pdfFileId) {
					try {
						await prisma.pdfFile.update({
							where: { id: pdfFileId },
							data: { periodId: createdPeriodId }
						});
						console.log('[APORTES][29] ✓ PDF asociado al período:', { pdfFileId, periodId: createdPeriodId });
					} catch (updateErr) {
						console.error('[APORTES][29] ❌ Error asociando PDF:', updateErr);
					}
				}
			}
		} catch (ppErr) {
			console.error('[APORTES][29] ❌ Error general creando PayrollPeriod:', ppErr);
		}

		

		const responseData = {
			fileName: file.name,
			savedName,
			savedPath,
			size: file.size,
			mimeType: detectedFileType.mime,
			status: 'saved',
			classification: kind,
			needsOCR,
			preview,
			checks,
			institution,
			bufferHash,
			pdfFileId,
			members: membersResult
		};

		console.log('\n========================================');
		console.log('✅ [APORTES] PROCESAMIENTO EXITOSO');
		console.log('========================================');
		console.log('[APORTES] Resumen de respuesta:');
		console.log('  - Archivo:', responseData.fileName);
		console.log('  - Clasificación:', responseData.classification);
		console.log('  - Institución:', (institution as any)?.name || 'N/A');
		console.log('  - Personas encontradas:', personas?.length || 0);
		console.log('  - Monto del Concepto (tabla):', tableData?.montoConcepto || 'N/A');
		if (personas && personas.length > 0) {
			const totalMonto = personas.reduce((sum, p) => sum + p.montoConcepto, 0);
			console.log('  - Total Monto del Concepto (suma):', totalMonto);
		}
		console.log('========================================\n\n');

		return json(responseData, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Error desconocido';
		console.error('\n========================================');
		console.error('❌ [APORTES] ERROR EN PROCESAMIENTO');
		console.error('========================================');
		console.error('[APORTES] Error:', message);
		console.error('[APORTES] Stack:', err instanceof Error ? err.stack : 'N/A');
		console.error('========================================\n\n');
		return json({ error: 'Error al procesar el archivo', details: message }, { status: 500 });
	}
};


