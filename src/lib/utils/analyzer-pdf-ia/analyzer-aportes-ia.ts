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

// Schema de validacion con Zod - más flexible para variaciones de OpenAI
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

// Normalizar el tipo a mayúsculas y aceptar variaciones comunes
const tipoAportesSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const normalized = val.toUpperCase().replace(/[_\s-]+/g, '_');
      // Aceptar variaciones comunes
      if (normalized.includes('LISTADO') || normalized.includes('APORTE')) {
        return 'LISTADO_APORTES';
      }
    }
    return val;
  },
  z.literal('LISTADO_APORTES')
);

const ListadoAportesSchema = z.object({
  tipo: tipoAportesSchema,
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

	// Si hay advertencias, ignorarlas en producción (solo retornarlas)
	getWarnings(validations);

	// Si hay errores críticos, lanzar excepción
	const errors = getErrors(validations);
	if (errors.length > 0) {
		throw new Error(`Validación fallida para ${filename}:\n${formatValidationResults(errors)}`);
	}

	return validations;
}

// Prompt específico para Vision API (imágenes)
const VISION_SYSTEM_PROMPT = `Eres un asistente especializado en extraer datos estructurados de IMÁGENES de listados de aportes sindicales de escuelas argentinas.

INSTRUCCIONES:
1. Analiza la IMAGEN del PDF que contiene un listado de aportes sindicales SIDEPP
2. Extrae TODA la informacion visible siguiendo el esquema JSON exacto
3. FORMATO DE MONEDA ARGENTINA (MUY IMPORTANTE):
   - En Argentina, el PUNTO es separador de MILES (no decimal)
   - En Argentina, la COMA es separador DECIMAL
   - Ejemplo: "$2.285.254,37" significa DOS MILLONES doscientos ochenta y cinco mil...
   - En JSON debes retornar: 2285254.37 (usando punto como decimal, SIN separador de miles)
   - NUNCA confundas el punto de miles con un decimal
4. Los nombres de personas vienen en formato "APELLIDO  NOMBRE" (con doble espacio)
5. El CUIT tiene formato XX-XXXXXXXX-X

ESTRUCTURA DE LA TABLA DE PERSONAS (MUY IMPORTANTE):
Las columnas en el PDF son en este orden:
1. NOMBRE (texto)
2. CANTIDAD LEGAJOS (numero entero pequeno, 1-5)
3. MONTO DEL CONCEPTO (numero decimal, es el aporte sindical ~1% del total)
4. TOT. REMUNERATIVO (numero decimal GRANDE, es el salario total)

REGLA CRITICA DE VALORES:
- totalRemunerativo es SIEMPRE el valor MAS GRANDE (salario total)
- montoConcepto es SIEMPRE el valor MAS PEQUEÑO (~1% del total)
- Si ves dos numeros, el mayor es totalRemunerativo y el menor es montoConcepto

FORMATO JSON REQUERIDO:
{
  "tipo": "LISTADO_APORTES",
  "escuela": {
    "nombre": "string en MAYUSCULAS",
    "direccion": "string o null",
    "cuit": "XX-XXXXXXXX-X"
  },
  "fecha": "MM/DD/YYYY o null",
  "periodo": "MM/YYYY o FOPID o null",
  "concepto": "string o null",
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
- Si un campo no es visible o no se encuentra, usa null
- Los montos deben ser numeros decimales exactos (no redondear)
- Lee TODAS las filas de la tabla de personas visibles en la imagen
- RECUERDA: totalRemunerativo > montoConcepto SIEMPRE`;

/**
 * Analiza un PDF de listado de aportes usando OpenAI (texto)
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
      console.error(`[analyzeAportesWithAI] Errores de validacion Zod para ${filename}:`, err.issues);
      // Crear mensaje de error más descriptivo
      const errorDetails = err.issues.map(issue => {
        const path = issue.path.join('.');
        return `Campo "${path || 'raíz'}": ${issue.message}`;
      }).join('; ');
      throw new Error(`Error de formato en respuesta de IA: ${errorDetails}`);
    }
    if (err instanceof SyntaxError) {
      console.error(`[analyzeAportesWithAI] Error de JSON para ${filename}:`, err.message);
      throw new Error(`La IA no retornó JSON válido: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Analiza un PDF de listado de aportes usando OpenAI Vision (imagen base64)
 * Para PDFs escaneados o basados en imágenes
 * Incluye retry logic y validaciones post-OpenAI
 */
export async function analyzeAportesWithVision(
  imageBase64: string,
  filename: string
): Promise<ListadoPDFResult> {
  // Usar retry logic para llamadas a OpenAI
  const response = await withRetry(
    () => openai.chat.completions.create({
      model: MODEL_CONFIG.model,
      temperature: MODEL_CONFIG.temperature,
      max_tokens: MODEL_CONFIG.max_tokens,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analiza la siguiente imagen de un listado de aportes sindicales y extrae la informacion estructurada en formato JSON:',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
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
    throw new Error('OpenAI Vision no retorno contenido');
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
      console.error(`[analyzeAportesWithVision] Errores de validacion Zod para ${filename}:`, err.issues);
      const errorDetails = err.issues.map(issue => {
        const path = issue.path.join('.');
        return `Campo "${path || 'raíz'}": ${issue.message}`;
      }).join('; ');
      throw new Error(`Error de formato en respuesta de IA Vision: ${errorDetails}`);
    }
    if (err instanceof SyntaxError) {
      console.error(`[analyzeAportesWithVision] Error de JSON para ${filename}:`, err.message);
      throw new Error(`La IA Vision no retornó JSON válido: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Analiza MÚLTIPLES páginas de un PDF de aportes usando Vision API
 * Combina los resultados de todas las páginas en un solo listado
 */
export async function analyzeMultipleAportesWithVision(
  imagesBase64: string[],
  filename: string
): Promise<ListadoPDFResult> {

  // Para listados de aportes, generalmente todas las páginas son parte del mismo listado
  // Analizamos cada página y combinamos los resultados

  let escuela: ListadoPDFResult['escuela'] | null = null;
  let fecha: string | null = null;
  let periodo: string | null = null;
  let concepto: string | null = null;
  const todasLasPersonas: ListadoPDFResult['personas'] = [];
  let paginasConError = 0;

  for (let i = 0; i < imagesBase64.length; i++) {
    const imageBase64 = imagesBase64[i];

    try {
      const response = await withRetry(
        () => openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 4000,
          messages: [
            { role: 'system', content: VISION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analiza la siguiente imagen (página ${i + 1} de ${imagesBase64.length}) de un listado de aportes sindicales y extrae la informacion estructurada en formato JSON:`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
        }),
        {
          maxRetries: 2,
          initialDelayMs: 500,
          shouldRetry: isOpenAIRetryableError
        }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        paginasConError++;
        continue;
      }

      const parsed = JSON.parse(content);
      const validated = ListadoAportesSchema.parse(parsed);

      // Tomar datos de escuela de la primera página que los tenga
      if (!escuela && validated.escuela) {
        escuela = validated.escuela;
      }
      if (!fecha && validated.fecha) {
        fecha = validated.fecha;
      }
      if (!periodo && validated.periodo) {
        periodo = validated.periodo;
      }
      if (!concepto && validated.concepto) {
        concepto = validated.concepto;
      }

      // Agregar personas de esta página
      todasLasPersonas.push(...validated.personas);
    } catch {
      paginasConError++;
    }
  }

  if (todasLasPersonas.length === 0) {
    throw new Error(`No se pudo extraer ninguna persona del PDF. ${paginasConError} página(s) fallaron.`);
  }

  // Calcular totales combinados
  const montoTotal = todasLasPersonas.reduce((sum, p) => sum + (p.montoConcepto || 0), 0);

  const result: ListadoPDFResult = {
    tipo: 'LISTADO_APORTES',
    archivo: filename,
    escuela: escuela || { nombre: null, direccion: null, cuit: null },
    fecha,
    periodo,
    concepto,
    personas: todasLasPersonas,
    totales: {
      cantidadPersonas: todasLasPersonas.length,
      montoTotal: Math.round(montoTotal * 100) / 100,
    },
  };

  // Validar resultado combinado
  validateAportesResult(result, filename);

  return result;
}
