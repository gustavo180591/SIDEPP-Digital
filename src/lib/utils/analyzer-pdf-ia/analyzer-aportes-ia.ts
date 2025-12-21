import { z } from 'zod';
import { openai, MODEL_CONFIG } from './openai-config.js';
import { cleanTextForAI } from './pdf-extractor.js';
import type { ListadoPDFResult } from './types/index.js';
import { withRetry } from '$lib/server/utils/retry.js';
import {
	validateAportesTotales,
	validateAporteConceptoPorcentaje,
	validateAporteAmount,
	getErrors,
	getWarnings,
	formatValidationResults,
	type ValidationResult,
	type PersonaAporte
} from './validator.js';

// Schema de validacion con Zod
const PersonaAporteSchema = z.object({
  nombre: z.string(),
  totalRemunerativo: z.number(),
  cantidadLegajos: z.number().int(),
  montoConcepto: z.number(),
});

const EscuelaSchema = z.object({
  nombre: z.string().nullable(),
  direccion: z.string().nullable(),
  cuit: z.string().nullable(),
});

const TotalesSchema = z.object({
  cantidadPersonas: z.number().int(),
  montoTotal: z.number(),
});

const ListadoAportesSchema = z.object({
  tipo: z.literal('LISTADO_APORTES'),
  escuela: EscuelaSchema,
  fecha: z.string().nullable(),
  periodo: z.string().nullable(),
  concepto: z.string().nullable(),
  personas: z.array(PersonaAporteSchema),
  totales: TotalesSchema,
});

const SYSTEM_PROMPT = `Eres un asistente especializado en extraer datos estructurados de listados de aportes sindicales de escuelas argentinas.

INSTRUCCIONES:
1. Analiza el texto del PDF que contiene un listado de aportes sindicales SIDEPP
2. Extrae TODA la informacion siguiendo el esquema JSON exacto
3. FORMATO DE MONEDA ARGENTINA (MUY IMPORTANTE):
   - En Argentina, el PUNTO es separador de MILES (no decimal)
   - En Argentina, la COMA es separador DECIMAL
   - Ejemplo: "$2.285.254,37" significa DOS MILLONES doscientos ochenta y cinco mil...
   - En JSON debes retornar: 2285254.37 (usando punto como decimal, SIN separador de miles)
   - Otro ejemplo: "$54.755,35" en JSON es: 54755.35
   - NUNCA confundas el punto de miles con un decimal
4. Los nombres de personas vienen en formato "APELLIDO  NOMBRE" (con doble espacio)
5. El CUIT tiene formato XX-XXXXXXXX-X
6. El periodo puede ser "MM/YYYY" o "FOPID" si es Fondo Fopid

CAMPOS A EXTRAER:
- escuela: nombre (en MAYUSCULAS), direccion (buscar "Ruta" o similar), cuit (formato XX-XXXXXXXX-X)
- fecha: formato MM/DD/YYYY (como viene en el PDF)
- periodo: formato MM/YYYY o "FOPID" - IMPORTANTE: el periodo es el MES de la fecha (ejemplo: si fecha es "11/07/2024", el periodo es "11/2024")
- concepto: descripcion del concepto (ej: "Apte. Sindical SIDEPP (1%)")
- personas: array con cada persona y sus datos
- totales: cantidad de personas y monto total

ESTRUCTURA DE LA TABLA DE PERSONAS (MUY IMPORTANTE):
Las columnas en el PDF son en este orden:
1. NOMBRE (texto)
2. CANTIDAD LEGAJOS (numero entero pequeno, 1-5)
3. MONTO DEL CONCEPTO (numero decimal, es el aporte sindical ~1% del total)
4. TOT. REMUNERATIVO (numero decimal GRANDE, es el salario total)

REGLA CRITICA DE VALORES:
- totalRemunerativo es SIEMPRE el valor MAS GRANDE (salario total, ej: 2,285,254.37)
- montoConcepto es SIEMPRE el valor MAS PEQUENO (~1% del total, ej: 22,852.54)
- El montoConcepto es aproximadamente el 1% del totalRemunerativo
- Si ves dos numeros, el mayor es totalRemunerativo y el menor es montoConcepto

FORMATO JSON REQUERIDO:
{
  "tipo": "LISTADO_APORTES",
  "escuela": {
    "nombre": "string en MAYUSCULAS",
    "direccion": "string",
    "cuit": "XX-XXXXXXXX-X"
  },
  "fecha": "MM/DD/YYYY",
  "periodo": "MM/YYYY o FOPID",
  "concepto": "string",
  "personas": [
    {
      "nombre": "APELLIDO  NOMBRE",
      "totalRemunerativo": number,
      "cantidadLegajos": number,
      "montoConcepto": number
    }
  ],
  "totales": {
    "cantidadPersonas": number,
    "montoTotal": number
  }
}

REGLAS IMPORTANTES:
- Si un campo no se encuentra, usa null
- Los montos deben ser numeros decimales exactos (no redondear)
- Preserva los espacios dobles en nombres (APELLIDO  NOMBRE)
- El nombre de la escuela debe estar en MAYUSCULAS
- NO incluyas el campo "archivo" en la respuesta, se agrega automaticamente
- RECUERDA: totalRemunerativo > montoConcepto SIEMPRE`;

/**
 * Verifica si un error de OpenAI es recuperable (se puede reintentar)
 */
function isOpenAIRetryableError(error: unknown): boolean {
	if (error && typeof error === 'object' && 'status' in error) {
		const status = (error as { status: number }).status;
		// Rate limit (429) o errores del servidor (5xx)
		return status === 429 || status >= 500;
	}
	// Errores de red también son recuperables
	const message = String(error).toLowerCase();
	return message.includes('timeout') || message.includes('network') || message.includes('econnreset');
}

/**
 * Valida el resultado de un listado de aportes y registra advertencias
 */
function validateAportesResult(
	result: ListadoPDFResult,
	filename: string
): ValidationResult[] {
	const validations: ValidationResult[] = [];

	// Validar que la suma de personas coincida con el total reportado
	const personas: PersonaAporte[] = result.personas.map(p => ({
		nombre: p.nombre,
		totalRemunerativo: p.totalRemunerativo,
		cantidadLegajos: p.cantidadLegajos,
		montoConcepto: p.montoConcepto
	}));

	validations.push(
		...validateAportesTotales(personas, result.totales.montoTotal, filename)
	);

	// Validar montos individuales y porcentajes de concepto
	for (const persona of result.personas) {
		// Validar que montoConcepto sea razonable
		validations.push(
			...validateAporteAmount(persona.montoConcepto, 'montoConcepto', `${filename} - ${persona.nombre}`)
		);

		// Validar que totalRemunerativo sea razonable
		validations.push(
			...validateAporteAmount(persona.totalRemunerativo, 'totalRemunerativo', `${filename} - ${persona.nombre}`)
		);

		// Validar porcentaje (montoConcepto debería ser ~1% de totalRemunerativo)
		validations.push(
			...validateAporteConceptoPorcentaje(
				{
					nombre: persona.nombre,
					totalRemunerativo: persona.totalRemunerativo,
					cantidadLegajos: persona.cantidadLegajos,
					montoConcepto: persona.montoConcepto
				},
				filename
			)
		);
	}

	// Loguear warnings
	const warnings = getWarnings(validations);
	if (warnings.length > 0) {
		console.warn(`[analyzeAportesWithAI] Warnings para ${filename}:\n${formatValidationResults(warnings)}`);
	}

	// Si hay errores críticos, lanzar excepción
	const errors = getErrors(validations);
	if (errors.length > 0) {
		throw new Error(`Validación fallida para ${filename}:\n${formatValidationResults(errors)}`);
	}

	return validations;
}

/**
 * Analiza un PDF de listado de aportes usando OpenAI
 * Incluye retry logic y validaciones post-OpenAI
 */
export async function analyzeAportesWithAI(
  pdfText: string,
  filename: string
): Promise<ListadoPDFResult> {
  // Usar retry logic para llamadas a OpenAI
  const response = await withRetry(
    () => openai.chat.completions.create({
      ...MODEL_CONFIG,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analiza el siguiente texto extraido de un PDF y extrae la informacion estructurada:\n\n${cleanTextForAI(pdfText)}`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      shouldRetry: isOpenAIRetryableError
    }
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI no retorno contenido');
  }

  try {
    const parsed = JSON.parse(content);
    const validated = ListadoAportesSchema.parse(parsed);
    const result: ListadoPDFResult = {
      ...validated,
      archivo: filename,
    };

    // Validar el resultado antes de retornarlo
    validateAportesResult(result, filename);

    return result;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      console.error(`[analyzeAportesWithAI] Errores de validacion para ${filename}:`, err.issues);
      throw new Error(`Validacion fallida: ${JSON.stringify(err.issues)}`);
    }
    throw err;
  }
}
