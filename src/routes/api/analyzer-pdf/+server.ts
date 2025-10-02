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
	// Formato acordado:
	//  1) "nombre completo  cant_legajos  monto_concepto"
	//  2) "tot_remunerativo" (línea siguiente con solo el número)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		
		// Patrón para línea 1: nombre, cantidad de legajos, monto concepto
		const personaMatch = line.match(/^([a-záéíóúñ\s]+?)\s+(\d+)\s+(\d+(?:[\.,]\d+)?)$/i);
		
		if (personaMatch) {
			const nombre = personaMatch[1].trim();
			const legajos = parseInt(personaMatch[2]);
			const montoConcepto = parseFloat(personaMatch[3].replace(/\./g, '').replace(',', '.'));
			
			// Buscar la siguiente línea que debería tener el total remunerativo
			let totRemunerativo = 0;
			if (i + 1 < lines.length) {
				const nextLine = lines[i + 1];
				
				
				// La siguiente línea debería ser solo un número (total remunerativo)
				const remMatch = nextLine.match(/^(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?)$/);
				if (remMatch) {
					const remStr = remMatch[1].replace(/\./g, '').replace(',', '.');
					totRemunerativo = parseFloat(remStr);
				} else {
					
				}
			}
			
			personas.push({
				nombre: nombre.toUpperCase(),
				totRemunerativo,
				cantidadLegajos: legajos,
				montoConcepto: montoConcepto
			});
			
			
		} else {
			
		}
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
		// 1) Igualdad por firstName completo
		m = await prisma.member.findFirst({ where: { institucionId: institutionId, firstName: fullName } });
		if (m) return { id: m.id };
		if (first && rest) {
			m = await prisma.member.findFirst({
				where: {
					institucionId: institutionId,
					firstName: { contains: first, mode: 'insensitive' },
					lastName: { contains: rest, mode: 'insensitive' }
				}
			});
			if (m) return { id: m.id };
		}
		m = await prisma.member.findFirst({ where: { institucionId: institutionId, lastName: { contains: fullName, mode: 'insensitive' } } });
		if (m) return { id: m.id };

		// Fallback: traer algunos miembros y matchear en memoria con normalización
		const candidates = await prisma.member.findMany({
			where: { institucionId: institutionId },
			select: { id: true, firstName: true, lastName: true },
			take: 500
		});
		let best: { id: string; score: number } | null = null;
		for (const c of candidates) {
			const fn = normalize(c.firstName ?? '');
			const ln = normalize(c.lastName ?? '');
			const full = `${fn} ${ln}`.trim();

			let score = 0;
			if (full === name) score = 100;
			else if (full.includes(name) || name.includes(full)) score = 90;
			else {
				const tokens = new Set(parts);
				let hits = 0;
				for (const t of tokens) {
					if (t && (fn.includes(t) || ln.includes(t))) hits++;
				}
				score = hits * 10;
				// bonificación si primera palabra matchea el primer nombre o apellido
				if (first && (fn.startsWith(first) || ln.startsWith(first))) score += 5;
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
		// Calcular hash SHA-256 para deduplicación
		const bufferHash = createHash('sha256').update(buffer).digest('hex');
		console.log('[analyzer][hash] SHA-256:', bufferHash);
		const hashIndex = await loadHashIndex();
		if (hashIndex[bufferHash]) {
			console.warn('[analyzer][hash] Duplicado detectado, no se guarda:', hashIndex[bufferHash]);
			return json({
				status: 'duplicate',
				message: 'El archivo ya fue cargado anteriormente',
				bufferHash,
				previous: hashIndex[bufferHash]
			}, { status: 409 });
		}
		// Deduplicación en DB por hash
		try {
			const existingPdf = await prisma.pdfFile.findUnique({ where: { bufferHash } });
			if (existingPdf) {
				console.warn('[analyzer][hash][db] Duplicado en DB, no se guarda:', { id: existingPdf.id, fileName: existingPdf.fileName });
				return json({ status: 'duplicate', message: 'El archivo ya fue cargado (DB)', bufferHash, pdfFileId: existingPdf.id }, { status: 409 });
			}
		} catch (dbDupErr) {
			console.warn('[analyzer][hash][db] Error verificando duplicado:', dbDupErr);
		}

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
		// Registrar en índice de hashes
		hashIndex[bufferHash] = { fileName: file.name, savedName, savedPath };
		await saveHashIndex(hashIndex);

		// Crear PdfFile en DB temprano (sin periodId aún)
		let pdfFileId: string | null = null;
		try {
			const createdPdf = await prisma.pdfFile.create({ data: { fileName: file.name, bufferHash } });
			pdfFileId = createdPdf.id;
			console.log('[analyzer][pdfFile] Creado en DB:', { id: pdfFileId, fileName: createdPdf.fileName });
		} catch (pdfDbErr) {
			console.error('[analyzer][pdfFile] Error al crear PdfFile en DB:', pdfDbErr);
		}

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
		let institution: { id: string; name: string | null; cuit: string | null; address?: string | null } | undefined = undefined;
		let membersResult: { found: number; created: number; updated: number; names: string[] } | undefined = undefined;

		// DEBUG: mostrar primeras líneas del texto para diagnóstico
		try {
			const firstLines = fullText.split(/\r?\n/).slice(0, 40);
			console.log('[analyzer][debug] Primeras líneas del texto:', firstLines);
		} catch {}

		
		const rawLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
		
		
		
		const rows = rawLines
			.map((line, idx) => ({ lineNumber: idx + 1, ...extractLineData(line) }))
			.filter((r) => r.cuit || r.importe || r.nombre);

		
		// Detectar institución por CUIT de cabecera (solo lookup; no crear ni actualizar)
		try {
			const instCuitDigits = extractInstitutionCuit(fullText);
			console.log('[analyzer][institution] CUIT extraído (crudo):', instCuitDigits);
			const instCuit = formatCuit(instCuitDigits);
			console.log('[analyzer][institution] CUIT normalizado:', instCuit);
			if (!instCuit) {
				console.log('[analyzer][institution] No se pudo determinar CUIT institucional desde el PDF');
				return json({
					status: 'error',
					message: 'No se pudo detectar el CUIT de la institución en el PDF.',
					details: { hint: 'Verifique el documento o cargue la institución manualmente.' }
				}, { status: 400 });
			} else {
				try {
					await prisma.$connect();
					console.log('[analyzer][institution] Conexión a DB OK');
				} catch (dbConnErr) {
					console.error('[analyzer][institution] Error conectando a DB:', dbConnErr);
				}

				try {
					const existing = await prisma.institution.findUnique({ where: { cuit: instCuit } });
					if (existing) {
						console.log('[analyzer][institution] Institución encontrada por CUIT:', { id: existing.id, cuit: existing.cuit, name: existing.name, address: existing.address });
						institution = { id: existing.id, name: existing.name ?? null, cuit: existing.cuit ?? null, address: existing.address ?? null };
					} else {
						return json({
							status: 'error',
							message: 'No existe una institución con ese CUIT. Debe cargarla en Instituciones.',
							details: { cuit: instCuit }
						}, { status: 404 });
					}
				} catch (dbErr) {
					console.error('[analyzer][institution] Error consultando institución:', dbErr);
				}
			}
		} catch (e) {
			// No bloquear el análisis si falla DB
			console.warn('[analyzer] No se pudo asegurar institución por CUIT (catch exterior):', e);
		}

		if (rows.length > 0) {
			
		}

		// Extraer datos específicos de tabla
		
		const tableData = extractTableData(fullText);
		

		// Extraer filas individuales de personas
		
		const personas = extractPersonas(fullText);
		// Persistir ContributionLine por cada persona asociada al PdfFile
		try {
			if (pdfFileId && personas.length > 0) {
				for (const p of personas) {
					let memberConnect: { connect: { id: string } } | undefined = undefined;
					if (institution) {
						let maybeMember = await findMemberByName(institution.id, p.nombre);
						if (!maybeMember) {
                    // Crear miembro si no existe, usando fullName y separando nombre/apellido
							try {
                        const { firstName, lastName } = splitFullName(p.nombre);
								const createdMember = await prisma.member.create({
									data: {
										institucion: { connect: { id: institution.id } },
                                firstName,
                                lastName,
                                fullName: p.nombre
									}
								});
								maybeMember = { id: createdMember.id };
							} catch (cmErr) {
								console.warn('[analyzer][member] No se pudo crear miembro:', cmErr);
							}
						}
						if (maybeMember) memberConnect = { connect: { id: maybeMember.id } };
					}
					await prisma.contributionLine.create({
						data: {
							name: p.nombre,
							quantity: Number.isFinite(p.cantidadLegajos) ? p.cantidadLegajos : null,
							conceptAmount: Number.isFinite(p.montoConcepto) ? String(p.montoConcepto) : null,
							totalRem: Number.isFinite(p.totRemunerativo) ? String(p.totRemunerativo) : null,
							pdfFile: { connect: { id: pdfFileId } },
							...(memberConnect ? { member: memberConnect } : {})
						}
					});
				}
			}
		} catch (persistErr) {
			console.warn('[analyzer][contrib] Error creando ContributionLine:', persistErr);
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

		// Crear PayrollPeriod asociado a la institución y al PdfFile (solo si hay institución y pdfFile creado)
		try {
			if (institution && pdfFileId) {
				// Determinar período a usar: seleccionado por UI o detectado del texto
				const detected = detectPeriod(fullText);
				const selected = parseSelectedPeriod(selectedPeriodRaw);
				const useYear = selected?.year ?? detected.year ?? null;
				const useMonth = selected?.month ?? detected.month ?? null;
				if (!useYear || !useMonth) {
					return json({
						status: 'error',
						message: 'No se pudo determinar el período (mes/año). Seleccione un período o verifique el PDF.',
						preview,
						institution
					}, { status: 400 });
				}

				// Calcular personas y total
				const table = extractTableData(fullText);
				const peopleCount = table.personas ?? (Array.isArray(personas) ? personas.length : undefined) ?? null;
				const totalAmountNumber = table.montoConcepto ?? (Array.isArray(personas) ? personas.reduce((a, p) => a + (Number.isFinite(p.montoConcepto) ? p.montoConcepto : 0), 0) : 0);
				const totalAmount = Number.isFinite(totalAmountNumber) ? String(totalAmountNumber) : null;

				// Fallback para transferId requerido
				const fallbackTransferId = bufferHash || savedName;

				// Intentar crear, si ya existe por combinación única, ignorar
				let createdPeriodId: string | null = null;
				try {
					const created = await prisma.payrollPeriod.create({
						data: {
							institution: { connect: { id: institution.id } },
							month: useMonth,
							year: useYear,
							concept: null,
							peopleCount: peopleCount ?? undefined,
							totalAmount: totalAmount,
							pdfFile: { connect: { id: pdfFileId } },
							transferId: fallbackTransferId
						}
					});
					createdPeriodId = created.id;
					console.log('[analyzer][period] PayrollPeriod creado:', { id: createdPeriodId, month: created.month, year: created.year });
				} catch (perr) {
					console.warn('[analyzer][period] No se pudo crear PayrollPeriod (puede existir):', perr);
					// Intentar encontrar existente por índice único si aplica
					try {
						const existing = await prisma.payrollPeriod.findFirst({
							where: {
								institutionId: institution.id,
								month: useMonth,
								year: useYear
							}
						});
						if (existing) createdPeriodId = existing.id;
					} catch {}
				}
				// No necesario forzar relación inversa si el FK está en PayrollPeriod
			}
		} catch (ppErr) {
			console.warn('[analyzer][period] Error general creando PayrollPeriod:', ppErr);
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
			checks,
			institution,
			bufferHash,
			pdfFileId,
			members: membersResult
		}, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Error desconocido';
		console.error('[analyzer] error:', message);
		return json({ error: 'Error al procesar el archivo', details: message }, { status: 500 });
	}
};


