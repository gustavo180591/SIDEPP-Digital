import { json, type RequestHandler } from '@sveltejs/kit';
import { fileTypeFromBuffer } from 'file-type';
import { CONFIG } from '$lib/server/config';
import { requireAuth } from '$lib/server/auth/middleware';
import { extractLineData } from '$lib/server/pdf/parse-listado';
import { prisma } from '$lib/server/db';
import { createHash } from 'node:crypto';
// Importar analyzer de PDFs con IA (Claude)
import { analyzeAportesIA } from '$lib/utils/analyzer-pdf-ia/index.js';
// Importar utilidades de CUIT centralizadas
import { normalizeCuit as normalizeCuitUtil, formatCuit as formatCuitUtil } from '$lib/utils/cuit-utils.js';
// Librería para manejo preciso de montos monetarios
import currency from 'currency.js';
// Storage centralizado
import { saveAnalyzerFile, deleteFile, ANALYZER_DIR } from '$lib/server/storage';

// ============================================================================
// ROLLBACK DE SESIÓN: Interface y tipos para tracking de datos creados
// ============================================================================
interface SessionCleanupData {
  periodId: string | null;           // PayrollPeriod creado/usado
  periodWasCreated: boolean;         // true si fue CREADO en esta sesión
  pdfFileIds: string[];              // PdfFiles creados
  contributionLineIds: string[];     // ContributionLines creadas
  memberIdsCreated: string[];        // Members NUEVOS (no los encontrados)
  savedFilePaths: string[];          // Rutas de archivos físicos guardados
}

// Configuración de currency.js para pesos argentinos (ARS)
// Formato: 1.234,56 (punto como separador de miles, coma como decimal)
const ARS = (value: number | string) => currency(value, {
	symbol: '$',
	separator: '.',
	decimal: ',',
	precision: 2
});

// Función para parsear montos en formato argentino a número usando currency.js
function parseMoneyARS(s?: string | null): number {
	if (!s) return 0;
	// Limpiar el string: remover espacios y símbolo $
	const cleaned = s.replace(/\s/g, '').replace(/\$/g, '');
	// currency.js espera formato americano internamente, así que convertimos
	// formato argentino (1.234,56) a formato americano (1234.56)
	const normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
	const result = currency(normalized, { precision: 2 });
	return result.value;
}

// Función para sumar montos usando currency.js (evita errores de punto flotante)
function sumMoneyARS(amounts: number[]): number {
	return amounts.reduce((acc, val) => currency(acc).add(val).value, 0);
}

const { MAX_FILE_SIZE } = CONFIG;

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
	// Buscar formato MM/YYYY pero EXCLUIR si hay otro número antes (evita DD/MM/YYYY o MM/DD/YYYY)
	// Negative lookbehind: no debe haber dígito+separador antes del mes
	const m1 = text.match(/(?<!\d[\/\-])\b(0?[1-9]|1[0-2])[\/\-](\d{4})\b/);
	if (m1) {
		return { month: Number(m1[1]), year: Number(m1[2]), raw: m1[0] };
	}
	const monthsAlt = MONTHS_ES.join('|');
	const re2 = new RegExp(`(?:^|[^a-záéíóúñ])(?:periodo|período)?\\s*:?\\s*(${monthsAlt})\\s*[\\-–—\\/]?\\s*(\\d{4})(?=$|[^0-9])`, 'i');
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
  }
  if (allMatches.length > 0) {
    const juridicos = allMatches.find((d) => /^(30|33|34)/.test(d));
    if (juridicos) return juridicos;
    return allMatches[0];
  }

  return null;
}

// formatCuit se usa desde cuit-utils.js (importado como formatCuitUtil)

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
	
	// PRIORIDAD 1: Buscar línea "Totales:" seguida del número total
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Buscar "Totales:" con o sin el número en la misma línea
		if (/^totales?\s*:?\s*/i.test(line)) {

			// Extraer el número si está en la misma línea
			const sameLineMatch = line.match(/totales?\s*:?\s*([\d.]+)/i);
			if (sameLineMatch) {
				result.montoConcepto = parseFloat(sameLineMatch[1]);
			} else if (i + 1 < lines.length) {
				// Si no está en la misma línea, buscar en la siguiente
				const nextLine = lines[i + 1];
				const nextLineMatch = nextLine.match(/^\s*([\d.]+)\s*$/);
				if (nextLineMatch) {
					result.montoConcepto = parseFloat(nextLineMatch[1]);
				}
			}
		}

		// Buscar "Cantidad de Personas:"
		const personasMatch = line.match(/cantidad\s+de\s+personas\s*:?\s*(\d+)/i);
		if (personasMatch && !result.personas) {
			result.personas = parseInt(personasMatch[1]);
		}
	}
	
	// PRIORIDAD 2: Si no encontramos montoConcepto en TOTALES, calcular sumando personas
	if (!result.montoConcepto) {
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

				}
			}
		}
		
		// Usar los totales calculados
		if (totalPersonas > 0) {
			if (!result.personas) result.personas = totalPersonas;
			if (!result.montoConcepto) result.montoConcepto = totalMonto;
			if (!result.cantidadLegajos) result.cantidadLegajos = totalLegajos;
			if (!result.totalRemunerativo) result.totalRemunerativo = totalRemunerativo;
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
					i++; // Saltar la siguiente línea ya que la procesamos
				}
			}
		}
	}
	
	// Calcular y mostrar el total de montos
	if (personas.length > 0) {
		const totalMonto = personas.reduce((sum, p) => sum + p.montoConcepto, 0);
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

// Buscar un miembro existente por nombre dentro de la institución
async function findMemberByName(
    institutionId: string,
    fullName: string
): Promise<{ id: string } | null> {
	try {
		// Búsqueda exacta por fullName (case-insensitive)
		// Esto previene duplicados cuando el nombre es exactamente igual
        const m = await prisma.member.findFirst({
			where: {
				institucionId: institutionId,
				fullName: { equals: fullName, mode: 'insensitive' }
			}
		});

		if (m) {
			return { id: m.id };
		}

		return null;
	} catch (e) {
		return null;
	}
}

/**
 * Función de limpieza/rollback de SESIÓN que elimina SOLO los datos creados en esta sesión:
 * - Archivos físicos específicos de esta sesión
 * - Registros de la DB creados en esta sesión (ContributionLine, Member, PdfFile, PayrollPeriod)
 *
 * Esta función implementa "borrón y cuenta nueva" - si falla cualquier archivo,
 * se limpia TODO lo creado en la sesión actual.
 */
async function performSessionCleanup(data: SessionCleanupData): Promise<{
	contributionLinesDeleted: number;
	membersDeleted: number;
	pdfFilesDeleted: number;
	periodDeleted: boolean;
	filesDeleted: number;
	errors: string[];
}> {
	const results = {
		contributionLinesDeleted: 0,
		membersDeleted: 0,
		pdfFilesDeleted: 0,
		periodDeleted: false,
		filesDeleted: 0,
		errors: [] as string[]
	};

	// ORDEN: Respetar foreign keys (de más dependiente a menos dependiente)

	// 1. Eliminar ContributionLines específicas de esta sesión
	if (data.contributionLineIds.length > 0) {
		try {
			const deleted = await prisma.contributionLine.deleteMany({
				where: { id: { in: data.contributionLineIds } }
			});
			results.contributionLinesDeleted = deleted.count;
		} catch (e) {
			const msg = `ContributionLines: ${e instanceof Error ? e.message : e}`;
			results.errors.push(msg);
			console.error('[SESSION_CLEANUP][1] ❌', msg);
		}
	}

	// 2. Eliminar Members NUEVOS (creados en esta sesión, no los que ya existían)
	if (data.memberIdsCreated.length > 0) {
		try {
			const deleted = await prisma.member.deleteMany({
				where: { id: { in: data.memberIdsCreated } }
			});
			results.membersDeleted = deleted.count;
		} catch (e) {
			const msg = `Members: ${e instanceof Error ? e.message : e}`;
			results.errors.push(msg);
			console.error('[SESSION_CLEANUP][2] ❌', msg);
		}
	}

	// 3. Eliminar PdfFiles de esta sesión
	if (data.pdfFileIds.length > 0) {
		try {
			const deleted = await prisma.pdfFile.deleteMany({
				where: { id: { in: data.pdfFileIds } }
			});
			results.pdfFilesDeleted = deleted.count;
		} catch (e) {
			const msg = `PdfFiles: ${e instanceof Error ? e.message : e}`;
			results.errors.push(msg);
			console.error('[SESSION_CLEANUP][3] ❌', msg);
		}
	}

	// 4. Eliminar PayrollPeriod SOLO si fue CREADO en esta sesión (no si ya existía)
	if (data.periodId && data.periodWasCreated) {
		try {
			// Verificar que no tenga otros PDFs asociados (por si algo quedó)
			const period = await prisma.payrollPeriod.findUnique({
				where: { id: data.periodId },
				include: { pdfFiles: true }
			});

			if (period && period.pdfFiles.length === 0) {
				await prisma.payrollPeriod.delete({ where: { id: data.periodId } });
				results.periodDeleted = true;
			} else if (period) {
			}
		} catch (e) {
			const msg = `PayrollPeriod: ${e instanceof Error ? e.message : e}`;
			results.errors.push(msg);
			console.error('[SESSION_CLEANUP][4] ❌', msg);
		}
	}

	// 5. Eliminar archivos físicos de esta sesión
	if (data.savedFilePaths.length > 0) {
		for (const filePath of data.savedFilePaths) {
			const deleted = await deleteFile(filePath);
			if (deleted) {
				results.filesDeleted++;
			}
		}
	}

	return results;
}

export const POST: RequestHandler = async (event) => {
	// Requerir autenticación
	const auth = await requireAuth(event);
	if (auth.error) {
		return json({ error: auth.error }, { status: auth.status || 401 });
	}

	// ============================================================================
	// ROLLBACK DE SESIÓN: Inicializar tracking de datos creados
	// ============================================================================
	const sessionData: SessionCleanupData = {
		periodId: null,
		periodWasCreated: false,
		pdfFileIds: [],
		contributionLineIds: [],
		memberIdsCreated: [],
		savedFilePaths: []
	};

	try {
		
		const contentType = event.request.headers.get('content-type');
		
		if (!contentType || !contentType.includes('multipart/form-data')) {
			return json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
		}

		const formData = await event.request.formData();
		const file = formData.get('file') as File | null;
		const selectedPeriodRaw = (formData.get('selectedPeriod') as string | null) ?? null;

		if (!file) {
			return json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
		}

		// Validar que se haya proporcionado el período
		if (!selectedPeriodRaw || selectedPeriodRaw.trim() === '') {
			return json({
				error: 'Debe seleccionar el mes y año del período antes de subir el archivo',
				message: 'Período requerido'
			}, { status: 400 });
		}

		if (file.size > MAX_FILE_SIZE) {
			return json({ error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 413 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		
		// Calcular hash SHA-256 para deduplicación
		const bufferHash = createHash('sha256').update(buffer).digest('hex');
		
		// Deduplicación en DB por hash (fuente de verdad)
		try {
			const existingPdf = await prisma.pdfFile.findUnique({
				where: { bufferHash },
				include: {
					contributionLine: true,
					period: {
						include: {
							institution: true
						}
					}
				}
			});
			if (existingPdf) {

				// Devolver datos del PDF existente para que el frontend pueda mostrarlos
				const peopleCount = existingPdf.peopleCount ?? existingPdf.contributionLine.length;
				const totalAmount = existingPdf.totalAmount ? parseFloat(existingPdf.totalAmount.toString()) : 0;

				return json({
					status: 'duplicate',
					message: 'El archivo ya fue cargado anteriormente',
					bufferHash,
					pdfFileId: existingPdf.id,
					fileName: existingPdf.fileName,
					// Datos del PDF existente
					existingData: {
						type: existingPdf.type,
						concept: existingPdf.concept,
						peopleCount,
						totalAmount,
						period: existingPdf.period ? {
							month: existingPdf.period.month,
							year: existingPdf.period.year
						} : null,
						institution: existingPdf.period?.institution ? {
							id: existingPdf.period.institution.id,
							name: existingPdf.period.institution.name,
							cuit: existingPdf.period.institution.cuit
						} : null
					}
				}, { status: 409 });
			}
		} catch (dbDupErr) {
			console.error('[APORTES][6] ❌ Error verificando duplicado en DB:', dbDupErr);
			// Si hay error verificando, es mejor fallar que continuar y crear duplicado
			throw dbDupErr;
		}

		const detectedFileType = await fileTypeFromBuffer(buffer);
		
		if (!detectedFileType || detectedFileType.mime !== 'application/pdf') {
			console.error('[APORTES][7] ❌ Tipo de archivo inválido:', detectedFileType?.mime);
			return json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
		}
		if (!buffer.slice(0, 4).equals(Buffer.from('%PDF'))) {
			console.error('[APORTES][7] ❌ El buffer no contiene un PDF válido');
			return json({ error: 'El archivo no parece ser un PDF válido' }, { status: 400 });
		}

		const savedPath = await saveAnalyzerFile(buffer, file.name);
		// ROLLBACK: Registrar archivo físico guardado
		sessionData.savedFilePaths.push(savedPath);

		// NOTE: El PdfFile se creará más adelante una vez detectemos el tipo (FOPID/SUELDO)
		let pdfFileId: string | null = null;

		// ============================================================================
		// NUEVO: Usar analyzer con IA (Claude API)
		// ============================================================================
		let analyzerResult: any = null;
		try {
			analyzerResult = await analyzeAportesIA(buffer, file.name);
		} catch (analyzerErr) {
			console.error('[APORTES][10] ❌ Error en analyzer IA:', analyzerErr);
			// El analyzer IA es crítico, si falla retornamos error
			return json({
				status: 'error',
				message: 'Error al analizar el PDF con IA. Verifique que el archivo sea un listado de aportes válido.',
				details: analyzerErr instanceof Error ? analyzerErr.message : 'Error desconocido'
			}, { status: 400 });
		}
		// ============================================================================

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
				console.error('[APORTES][12] ❌ Error en pdf-parse:', e);
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

		const fullText = extractedText;

		let preview: unknown = undefined;
		let checks: unknown = undefined;
		// let institution: { id: string; name: string | null; cuit: string | null; address?: string | null } | undefined = undefined; // Se declara más abajo
		let membersResult: { found: number; created: number; updated: number; names: string[] } | undefined = undefined;

		// DEBUG: mostrar primeras líneas del texto para diagnóstico
		try {
			const firstLines = fullText.split(/\r?\n/).slice(0, 40);
			firstLines.forEach((line, idx) => {
			});
		} catch (e) {
			console.error('[APORTES][18] Error mostrando líneas:', e);
		}

		const rawLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
		
		const rows = rawLines
			.map((line, idx) => ({ lineNumber: idx + 1, ...extractLineData(line) }))
			.filter((r) => r.cuit || r.importe || r.nombre);

		// Detectar institución por CUIT de cabecera
		let institution: { id: string; name: string | null; cuit: string | null; address?: string | null } | undefined = undefined;
		try {
			// Priorizar datos del analyzer IA si están disponibles
			let instCuitDigits: string | null = null;
			if (analyzerResult && analyzerResult.escuela && analyzerResult.escuela.cuit) {
				instCuitDigits = analyzerResult.escuela.cuit.replace(/\D/g, '');
			} else {
				instCuitDigits = extractInstitutionCuit(fullText);
			}
			const instCuit = formatCuitUtil(instCuitDigits);
			
			if (!instCuit) {
				console.error('[APORTES][21] ❌ No se pudo determinar CUIT institucional desde el PDF');
				return json({
					status: 'error',
					message: 'No se pudo detectar el CUIT de la institución en el PDF.',
					details: { hint: 'Verifique el documento o cargue la institución manualmente.' }
				}, { status: 400 });
			}
			
			try {
				await prisma.$connect();
			} catch (dbConnErr) {
				console.error('[APORTES][22] ❌ Error conectando a DB:', dbConnErr);
			}

			try {
				const existing = await prisma.institution.findUnique({ where: { cuit: instCuit } });
				if (existing) {
					institution = { id: existing.id, name: existing.name ?? null, cuit: existing.cuit ?? null, address: existing.address ?? null };

					// Validar que usuarios LIQUIDADOR solo puedan subir PDFs de sus instituciones asignadas
					if (auth.user?.role === 'LIQUIDADOR') {
						const userInstitutionIds = auth.user.institutions?.map((i: { id: string }) => i.id) || [];
						if (userInstitutionIds.length === 0) {
							console.error('[APORTES][23] ❌ Usuario LIQUIDADOR sin instituciones asignadas');
							return json({
								status: 'error',
								message: 'Usuario sin institución asignada',
								details: {}
							}, { status: 403 });
						}
						if (!userInstitutionIds.includes(institution.id)) {
							console.error('[APORTES][23] ❌ Usuario intenta subir PDF de institución no autorizada:', {
								userInstitutionIds,
								pdfInstitutionId: institution.id
							});
							return json({
								status: 'error',
								message: 'No tiene permiso para subir archivos para esta institución',
								details: {
									institutionName: institution.name,
									institutionCuit: institution.cuit
								}
							}, { status: 403 });
						}
					}
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
		}

		// Extraer datos específicos de tabla (solo si el analyzer falló)
		let tableData: any = {};
		if (!analyzerResult || !analyzerResult.totales) {
			tableData = extractTableData(fullText);
		} else {
		}

		// Extraer filas individuales de personas

		// Priorizar datos del analyzer IA si están disponibles
		let personas: Array<{
			nombre: string;
			totRemunerativo: number;
			cantidadLegajos: number;
			montoConcepto: number;
		}> = [];

		if (analyzerResult && analyzerResult.personas && analyzerResult.personas.length > 0) {
			// El analyzer IA ya devuelve personas en formato plano
			personas = analyzerResult.personas.map((p: any) => ({
				nombre: p.nombre,
				totRemunerativo: p.totalRemunerativo,
				cantidadLegajos: p.cantidadLegajos,
				montoConcepto: p.montoConcepto
			}));
		} else {
			personas = extractPersonas(fullText);
		}
		
		// Detectar tipo de PDF (FOPID o SUELDO) - priorizar analyzer IA
		let pdfType: 'FOPID' | 'SUELDO' = 'SUELDO'; // default

		// El analyzer IA devuelve periodo = "FOPID" si es FOPID
		if (analyzerResult && analyzerResult.periodo === 'FOPID') {
			pdfType = 'FOPID';
		} else {
			// Fallback: buscar en texto
			const firstLines = fullText.split(/\r?\n/).slice(0, 20).join('\n');
			if (/\bfopid\b/i.test(firstLines)) {
				pdfType = 'FOPID';
			} else {
			}
		}

		// Calcular datos de tabla para el PDF

		let peopleCountForPdf: number | null = null;
		let totalAmountForPdf: number | null = null;

		// Prioridad 1: Usar datos del analyzer IA si están disponibles
		if (analyzerResult && analyzerResult.totales) {
			peopleCountForPdf = analyzerResult.totales.cantidadPersonas;
			totalAmountForPdf = analyzerResult.totales.montoTotal;
		} else {
			// Fallback: Método legacy
			const tableDataPreview = extractTableData(fullText);
			const personasPreview = extractPersonas(fullText);
			peopleCountForPdf = tableDataPreview.personas ?? personasPreview.length;
			totalAmountForPdf = tableDataPreview.montoConcepto ?? personasPreview.reduce((a, p) => a + (Number.isFinite(p.montoConcepto) ? p.montoConcepto : 0), 0);
		}

		// Extraer concepto del texto - priorizar analyzer IA
		let conceptForPdf = 'Aporte Sindical SIDEPP (1%)'; // default
		if (analyzerResult && analyzerResult.concepto) {
			conceptForPdf = analyzerResult.concepto;
		} else {
			const conceptoMatch = fullText.match(/concepto:\s*([^\n]+)/i);
			conceptForPdf = conceptoMatch ? conceptoMatch[1].trim() : 'Aporte Sindical SIDEPP (1%)';
		}

		// Crear PdfFile en DB con el tipo detectado y los datos calculados
		try {
			// El analyzer IA no devuelve metadata de pdf2json, así que no la guardamos
			const pdfMetadata: any = null;

			const createdPdf = await prisma.pdfFile.create({
				data: {
					fileName: file.name,
					bufferHash,
					storagePath: savedPath,
					type: pdfType,
					concept: conceptForPdf,
					peopleCount: peopleCountForPdf || null,
					totalAmount: Number.isFinite(totalAmountForPdf) ? totalAmountForPdf.toString() : null,
					metadata: pdfMetadata
				}
			});
			pdfFileId = createdPdf.id;
			// ROLLBACK: Registrar PdfFile creado
			sessionData.pdfFileIds.push(createdPdf.id);
		} catch (pdfDbErr) {
			console.error('[APORTES][27] ❌ Error al crear PdfFile en DB:', pdfDbErr);
			throw pdfDbErr;
		}
		
		// Persistir ContributionLine por cada persona asociada al PdfFile
		try {
			if (pdfFileId && institution && personas.length > 0) {
				let membersCreated = 0;
				let membersFound = 0;
				
				for (const p of personas) {
					const nombreUpperCase = p.nombre.toUpperCase();

					// Buscar miembro por nombre (case-insensitive) dentro de la institución
					let member = await findMemberByName(institution.id, nombreUpperCase);

					if (!member) {
						// Crear miembro si no existe

						// Intentar crear hasta 3 veces para manejar race conditions
						let createAttempts = 0;
						const maxCreateAttempts = 3;

						while (!member && createAttempts < maxCreateAttempts) {
							createAttempts++;
							try {
								const createdMember = await prisma.member.create({
									data: {
										institucion: { connect: { id: institution.id } },
										fullName: nombreUpperCase
									}
								});
								member = { id: createdMember.id };
								membersCreated++;
								// ROLLBACK: Registrar Member NUEVO creado
								sessionData.memberIdsCreated.push(createdMember.id);
							} catch (cmErr: any) {
								// Manejar race condition (unique constraint violation)
								if (cmErr?.code === 'P2002') {

									// Esperar un poco antes de reintentar buscar
									await new Promise(resolve => setTimeout(resolve, 50 * createAttempts));

									// Buscar nuevamente el miembro que otro proceso pudo haber creado
									member = await findMemberByName(institution.id, nombreUpperCase);

									if (member) {
										membersFound++;
										break; // Salir del loop, miembro encontrado
									} else if (createAttempts >= maxCreateAttempts) {
										console.error(`[APORTES][28]   -> ❌ No se pudo crear ni encontrar miembro tras ${maxCreateAttempts} intentos: ${nombreUpperCase}`);
										throw cmErr;
									}
								} else {
									// Otro tipo de error, no reintentar
									console.error(`[APORTES][28]   -> ❌ Error creando miembro:`, cmErr);
									throw cmErr;
								}
							}
						}
					} else {
						membersFound++;
					}
					
					// Crear ContributionLine (con verificación de duplicados)
					try {
						// Verificar si ya existe una ContributionLine para este miembro en este PDF
						const existingContribution = await prisma.contributionLine.findFirst({
							where: {
								pdfFileId: pdfFileId,
								memberId: member?.id
							}
						});

						if (existingContribution) {
						} else {
							// Crear ContributionLine solo si NO existe
							const createdContributionLine = await prisma.contributionLine.create({
								data: {
									name: nombreUpperCase,
									quantity: p.cantidadLegajos != null ?
											(typeof p.cantidadLegajos === 'number' ? p.cantidadLegajos : parseInt(String(p.cantidadLegajos)))
											: null,
									conceptAmount: p.montoConcepto != null ? String(p.montoConcepto) : null,
									totalRem: p.totRemunerativo != null ? String(p.totRemunerativo) : null,
									pdfFile: { connect: { id: pdfFileId } },
									...(member ? { member: { connect: { id: member.id } } } : {})
								}
							});
							// ROLLBACK: Registrar ContributionLine creada
							sessionData.contributionLineIds.push(createdContributionLine.id);
						}
					} catch (clErr) {
						console.error(`[APORTES][28]   -> ❌ Error creando ContributionLine:`, clErr);
					}
				}
				
				// Validar totales: comparar suma de ContributionLines vs totales del analyzer
				if (analyzerResult && analyzerResult.totales && personas.length > 0) {

					const totalCalculado = personas.reduce((sum, p) => {
						return sum + (Number.isFinite(p.montoConcepto) ? p.montoConcepto : 0);
					}, 0);

					const totalAnalyzer = analyzerResult.totales.montoTotal;
					const diferencia = Math.abs(totalCalculado - totalAnalyzer);
					const porcentajeDiferencia = (diferencia / totalAnalyzer) * 100;

					if (diferencia > 0.5) {
						if (porcentajeDiferencia > 1) {
						} else {
						}
					} else {
					}
				}
			}
		} catch (persistErr) {
			console.error('[APORTES][28] ❌ Error en proceso de guardado:', persistErr);
		}

		if (rows.length > 0) {
			// PRIORIZAR analyzer IA sobre método legacy para el cálculo de totales
			// Usando currency.js para precisión en cálculos monetarios
			let sumTotal: number;
			if (analyzerResult?.totales?.montoTotal) {
				// Usar currency.js para asegurar precisión del monto del analyzer IA
				sumTotal = currency(analyzerResult.totales.montoTotal, { precision: 2 }).value;
			} else {
				// Fallback al método legacy usando currency.js para sumar
				const amounts = rows.map(r => parseMoneyARS(r.importe));
				sumTotal = sumMoneyARS(amounts);
			}
			const declaredTotal = analyzerResult?.totales?.montoTotal
				? currency(analyzerResult.totales.montoTotal, { precision: 2 }).value
				: detectDeclaredTotal(fullText);
			// Comparar con currency.js para evitar errores de punto flotante
			const totalMatches = declaredTotal != null
				? currency(sumTotal).subtract(declaredTotal).value === 0
				: false;
			
			// Priorizar período del analyzer IA sobre el método legacy
			let detectedPeriod: { month?: number | null; year?: number | null; raw?: string | null } = detectPeriod(fullText);

			// Si el analyzer IA tiene período, usarlo
			if (analyzerResult && analyzerResult.periodo && analyzerResult.periodo !== 'FOPID') {
				const mmYyyyMatch = analyzerResult.periodo.match(/^(\d{1,2})\/(\d{4})$/);
				if (mmYyyyMatch) {
					detectedPeriod = {
						month: parseInt(mmYyyyMatch[1]),
						year: parseInt(mmYyyyMatch[2]),
						raw: analyzerResult.periodo
					};
				}
			}
			// Fallback: si no hay período pero hay fecha, extraer mes de la fecha (formato MM/DD/YYYY)
			else if (analyzerResult && analyzerResult.fecha && (!detectedPeriod.month || !detectedPeriod.year)) {
				const fechaMatch = analyzerResult.fecha.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
				if (fechaMatch) {
					detectedPeriod = {
						month: parseInt(fechaMatch[1]),
						year: parseInt(fechaMatch[2]),
						raw: `${fechaMatch[1]}/${fechaMatch[2]}`
					};
				}
			}

			const selectedPeriod = parseSelectedPeriod(selectedPeriodRaw);
			const periodMatches = selectedPeriod && detectedPeriod.year && detectedPeriod.month
				? (selectedPeriod.year === detectedPeriod.year && selectedPeriod.month === detectedPeriod.month)
				: null;

			// Validar que el período del PDF coincida con el seleccionado
			if (periodMatches === false) {
				console.error('[APORTES] ❌ El período del PDF no coincide con el seleccionado:', {
					detectedPeriod: `${detectedPeriod.month}/${detectedPeriod.year}`,
					selectedPeriod: `${selectedPeriod?.month}/${selectedPeriod?.year}`
				});
				await performSessionCleanup(sessionData);
				return json({
					status: 'error',
					message: `El período detectado en el PDF (${detectedPeriod.month}/${detectedPeriod.year}) no coincide con el período seleccionado (${selectedPeriod?.month}/${selectedPeriod?.year})`,
					details: {
						detectedPeriod,
						selectedPeriod
					}
				}, { status: 400 });
			}

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
			// No hay rows de extractLineData, pero aún podemos tener datos del analyzer IA

			// Priorizar período del analyzer IA sobre el método legacy
			let detectedPeriod: { month?: number | null; year?: number | null; raw?: string | null } = detectPeriod(fullText);

			// Si el analyzer IA tiene período, usarlo
			if (analyzerResult && analyzerResult.periodo && analyzerResult.periodo !== 'FOPID') {
				const mmYyyyMatch = analyzerResult.periodo.match(/^(\d{1,2})\/(\d{4})$/);
				if (mmYyyyMatch) {
					detectedPeriod = {
						month: parseInt(mmYyyyMatch[1]),
						year: parseInt(mmYyyyMatch[2]),
						raw: analyzerResult.periodo
					};
				}
			}
			// Fallback: si no hay período pero hay fecha, extraer mes de la fecha (formato MM/DD/YYYY)
			else if (analyzerResult && analyzerResult.fecha && (!detectedPeriod.month || !detectedPeriod.year)) {
				const fechaMatch = analyzerResult.fecha.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
				if (fechaMatch) {
					detectedPeriod = {
						month: parseInt(fechaMatch[1]),
						year: parseInt(fechaMatch[2]),
						raw: `${fechaMatch[1]}/${fechaMatch[2]}`
					};
				}
			}

			const selectedPeriod = parseSelectedPeriod(selectedPeriodRaw);
			const periodMatches = selectedPeriod && detectedPeriod.year && detectedPeriod.month
				? (selectedPeriod.year === detectedPeriod.year && selectedPeriod.month === detectedPeriod.month)
				: null;

			// Validar que el período del PDF coincida con el seleccionado
			if (periodMatches === false) {
				console.error('[APORTES] ❌ El período del PDF no coincide con el seleccionado:', {
					detectedPeriod: `${detectedPeriod.month}/${detectedPeriod.year}`,
					selectedPeriod: `${selectedPeriod?.month}/${selectedPeriod?.year}`
				});
				await performSessionCleanup(sessionData);
				return json({
					status: 'error',
					message: `El período detectado en el PDF (${detectedPeriod.month}/${detectedPeriod.year}) no coincide con el período seleccionado (${selectedPeriod?.month}/${selectedPeriod?.year})`,
					details: {
						detectedPeriod,
						selectedPeriod
					}
				}, { status: 400 });
			}

			// Usar totales del analyzer IA si están disponibles (con currency.js)
			const sumTotal = analyzerResult?.totales?.montoTotal
				? currency(analyzerResult.totales.montoTotal, { precision: 2 }).value
				: 0;
			const declaredTotal = analyzerResult?.totales?.montoTotal
				? currency(analyzerResult.totales.montoTotal, { precision: 2 }).value
				: null;
			const totalMatches = declaredTotal != null;

			checks = { sumTotal, declaredTotal, totalMatches, detectedPeriod, selectedPeriod, periodMatches };

			// Aún así, incluir datos de tabla si se encontraron
			if (Object.keys(tableData).length > 0 || personas.length > 0) {
				preview = {
					listado: {
						count: personas.length,
						total: sumTotal,
						rows: [],
						tableData,
						personas
					}
				};
			}
		}

		// Crear PayrollPeriod asociado a la institución y al PdfFile
		try {
			if (institution && pdfFileId) {
				// Determinar período a usar: seleccionado por UI, del analyzer mejorado, o detectado del texto
				const detected = detectPeriod(fullText);
				const selected = parseSelectedPeriod(selectedPeriodRaw);

				// Intentar extraer período del analyzer mejorado
				let analyzerPeriod: { month: number | null; year: number | null } = { month: null, year: null };
				if (analyzerResult && analyzerResult.periodo) {

					// El analyzer puede retornar:
					// 1. Formato "MM/YYYY" (ej: "11/2024")
					// 2. Formato "FOPID" (periodo especial)
					// 3. Formato "Noviembre 2024" (legacy, menos común)

					if (analyzerResult.periodo === 'FOPID') {
						// FOPID no tiene mes/año específico, dejar null para que use detected o selected
					} else {
						// Intentar formato MM/YYYY primero
						const mmYyyyMatch = analyzerResult.periodo.match(/^(\d{1,2})\/(\d{4})$/);
						if (mmYyyyMatch) {
							analyzerPeriod = {
								month: parseInt(mmYyyyMatch[1]),
								year: parseInt(mmYyyyMatch[2])
							};
						} else {
							// Fallback: intentar formato "Noviembre 2024"
							const periodoMatch = analyzerResult.periodo.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/i);
							if (periodoMatch) {
								const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
								const mesNombre = periodoMatch[1].toLowerCase();
								const mesIdx = meses.indexOf(mesNombre);
								analyzerPeriod = {
									month: mesIdx >= 0 ? mesIdx + 1 : null,
									year: parseInt(periodoMatch[2])
								};
							} else {
							}
						}
					}
				}

				// Prioridad: seleccionado > analyzer > detectado
				const useYear = selected?.year ?? analyzerPeriod.year ?? detected.year ?? null;
				const useMonth = selected?.month ?? analyzerPeriod.month ?? detected.month ?? null;

				if (!useYear || !useMonth) {
					const errorMsg = `No se pudo determinar el período (mes/año).
						Período seleccionado: ${selected ? `${selected.month}/${selected.year}` : 'ninguno'}
						Período detectado en PDF: ${detected.year && detected.month ? `${detected.month}/${detected.year}` : 'ninguno'}
						Por favor, seleccione el mes y año en el formulario.`;
					console.error('[APORTES][29] ❌', errorMsg);
					throw new Error(errorMsg);
				}

				// Fallback para transferId requerido
				const fallbackTransferId = bufferHash || `aportes-${Date.now()}`;

				// Buscar o crear PayrollPeriod usando la restricción única
				let createdPeriodId: string | null = null;
				let periodWasCreated = false; // ROLLBACK: Flag para saber si fue creado en esta sesión

				// Función helper para buscar o crear el período con retry en caso de race condition
				const getOrCreatePeriod = async (retryCount = 0): Promise<{ id: string; wasCreated: boolean } | null> => {
					const maxRetries = 3;

					try {
						// Primero intentar encontrar el período existente (solo por institución, mes y año)
						let period = await prisma.payrollPeriod.findFirst({
							where: {
								institutionId: institution.id,
								month: useMonth,
								year: useYear
							}
						});

						if (period) {
							return { id: period.id, wasCreated: false };
						}

						// Si no existe, intentar crearlo
						try {
							period = await prisma.payrollPeriod.create({
								data: {
									institution: { connect: { id: institution.id } },
									month: useMonth,
									year: useYear,
									transferId: fallbackTransferId
								}
							});
							return { id: period.id, wasCreated: true };
						} catch (createErr: any) {
							// Si falla por constraint único (race condition), reintentar buscando
							if (createErr?.code === 'P2002' && retryCount < maxRetries) {
								await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1))); // Backoff exponencial
								return getOrCreatePeriod(retryCount + 1);
							}
							console.error('[APORTES][29] ❌ Error creando PayrollPeriod:', createErr);
							throw createErr; // Relanzar para que el error se propague
						}
					} catch (err) {
						console.error('[APORTES][29] ❌ Error al gestionar PayrollPeriod:', err);
						throw err; // Relanzar para que el error se propague
					}
				};

				const periodResult = await getOrCreatePeriod();
				if (periodResult) {
					createdPeriodId = periodResult.id;
					periodWasCreated = periodResult.wasCreated;
					// ROLLBACK: Registrar período
					sessionData.periodId = createdPeriodId;
					sessionData.periodWasCreated = periodWasCreated;
				}

				// Asociar el PDF al período
				if (createdPeriodId && pdfFileId) {
					try {
						await prisma.pdfFile.update({
							where: { id: pdfFileId },
							data: { periodId: createdPeriodId }
						});
					} catch (updateErr) {
						console.error('[APORTES][29] ❌ Error asociando PDF:', updateErr);
						throw updateErr; // Relanzar para que el error se propague
					}
				} else {
					const errorMsg = 'No se pudo crear o encontrar el PayrollPeriod';
					console.error('[APORTES][29] ❌', errorMsg);
					throw new Error(errorMsg);
				}
			} else {
				const errorMsg = 'Falta institución o pdfFileId para crear PayrollPeriod';
				console.error('[APORTES][29] ❌', errorMsg);
				throw new Error(errorMsg);
			}
		} catch (ppErr) {
			console.error('[APORTES][29] ❌ Error general creando PayrollPeriod:', ppErr);
			throw ppErr; // Relanzar para que el error llegue al catch principal y devuelva un 500
		}

		const responseData = {
			fileName: file.name,
			storagePath: savedPath,
			size: file.size,
			mimeType: detectedFileType.mime,
			status: 'saved',
			classification: kind,
			preview,
			checks,
			institution,
			bufferHash,
			pdfFileId,
			members: membersResult
		};

		if (personas && personas.length > 0) {
			const totalMonto = personas.reduce((sum, p) => sum + p.montoConcepto, 0);
		}

		return json(responseData, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Error desconocido';
		console.error('\n========================================');
		console.error('❌ [APORTES] ERROR EN PROCESAMIENTO');
		console.error('========================================');
		console.error('[APORTES] Error:', message);
		console.error('[APORTES] Stack:', err instanceof Error ? err.stack : 'N/A');
		console.error('========================================');

		// ROLLBACK DE SESIÓN: Limpiar solo los datos creados en esta sesión
		try {
			const cleanupResults = await performSessionCleanup(sessionData);
		} catch (cleanupErr) {
			console.error('🧹 [APORTES] Error durante rollback de sesión:', cleanupErr);
		}
		console.error('========================================\n\n');

		return json({
			error: 'Error al procesar el archivo',
			details: message,
			rollback: true,
			message: 'Se ejecutó limpieza de sesión. Puede reintentar la carga.'
		}, { status: 500 });
	}
};

/**
 * DELETE /api/analyzer-pdf-aportes
 * Limpia TODOS los datos de análisis: archivos físicos y registros de DB
 * ADVERTENCIA: Esta es una limpieza completa, no por sesión
 * Útil para reintentar después de un error grave - solo para ADMIN
 */
export const DELETE: RequestHandler = async (event) => {
	// Requerir autenticación
	const auth = await requireAuth(event);
	if (auth.error) {
		return json({ error: auth.error }, { status: auth.status || 401 });
	}

	// Solo ADMIN puede hacer limpieza completa
	if (auth.user?.role !== 'ADMIN') {
		return json({ error: 'Solo administradores pueden ejecutar limpieza completa' }, { status: 403 });
	}

	const results = {
		filesDeleted: 0,
		pdfFilesDeleted: 0,
		contributionLinesDeleted: 0,
		membersDeleted: 0,
		payrollPeriodsDeleted: 0,
		errors: [] as string[]
	};

	try {
		// 1. Eliminar archivos físicos de la carpeta analyzer
		try {
			const { readdir } = await import('node:fs/promises');
			const { join } = await import('node:path');
			const files = await readdir(ANALYZER_DIR);
			for (const file of files) {
				const filePath = join(ANALYZER_DIR, file);
				const deleted = await deleteFile(filePath);
				if (deleted) results.filesDeleted++;
			}
		} catch (e) {
			results.errors.push(`Directorio: ${e}`);
		}

		// 2. Eliminar ContributionLines de la DB
		try {
			const deleteResult = await prisma.contributionLine.deleteMany({});
			results.contributionLinesDeleted = deleteResult.count;
		} catch (e) {
			results.errors.push(`ContributionLines: ${e}`);
		}

		// 3. Eliminar PdfFiles de la DB
		try {
			const deleteResult = await prisma.pdfFile.deleteMany({});
			results.pdfFilesDeleted = deleteResult.count;
		} catch (e) {
			results.errors.push(`PdfFiles: ${e}`);
		}

		// 4. Eliminar PayrollPeriods huérfanos de la DB
		try {
			const deleteResult = await prisma.payrollPeriod.deleteMany({
				where: {
					pdfFiles: {
						none: {}
					}
				}
			});
			results.payrollPeriodsDeleted = deleteResult.count;
		} catch (e) {
			results.errors.push(`PayrollPeriods: ${e}`);
		}

		return json({
			status: 'success',
			message: 'Limpieza completa ejecutada',
			results
		});

	} catch (err) {
		const message = err instanceof Error ? err.message : 'Error desconocido';
		console.error('[CLEANUP] ❌ Error general:', message);
		return json({
			status: 'error',
			message: 'Error durante la limpieza',
			details: message,
			partialResults: results
		}, { status: 500 });
	}
};
