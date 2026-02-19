import { z } from 'zod';
import { openai, MODEL_CONFIG } from './openai-config.js';
import { cleanTextForAI } from './pdf-extractor.js';
import type { TransferenciaPDFResult, MultiTransferenciaPDFResult, TransferenciaItem } from './types/index.js';
import { withRetry } from '$lib/server/utils/retry.js';
import { sumarMontos, redondearMonto } from '$lib/utils/currency.js';
import {
	validateTransferenciaAmount,
	validateTransferenciaConsistency,
	getErrors,
	getWarnings,
	formatValidationResults,
	hasErrors,
	type ValidationResult
} from './validator.js';

// Schema de validacion con Zod - más flexible para variaciones de OpenAI
const OrdenanteSchema = z.object({
  cuit: z.string().nullable(),
  nombre: z.string().nullable(),
  domicilio: z.string().nullable(),
});

const OperacionSchema = z.object({
  cuentaOrigen: z.string().nullable(),
  importe: z.number().nullable(),
  cbuDestino: z.string().nullable(),
  banco: z.string().nullable(),
  titular: z.string().nullable(),
  cuit: z.string().nullable(),
  tipoOperacion: z.string().nullable(),
  importeATransferir: z.number().nullable(),
  importeTotal: z.number().nullable(),
});

// Normalizar el tipo a mayúsculas y aceptar variaciones comunes
const tipoTransferenciaSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const normalized = val.toUpperCase().replace(/[_\s-]+/g, '_');
      // Aceptar variaciones comunes
      if (normalized.includes('TRANSFER')) {
        return 'TRANSFERENCIA';
      }
    }
    return val;
  },
  z.literal('TRANSFERENCIA')
);

const TransferenciaSchema = z.object({
  tipo: tipoTransferenciaSchema,
  titulo: z.string(),
  nroReferencia: z.string().nullable(),
  nroOperacion: z.string().nullable(),
  fecha: z.string().nullable(),
  hora: z.string().nullable(),
  ordenante: OrdenanteSchema,
  operacion: OperacionSchema,
});

const SYSTEM_PROMPT = `Eres un asistente especializado en extraer datos de comprobantes de transferencias bancarias de Argentina (Banco Macro, Banco Nacion, Banco Provincia, y otros).

INSTRUCCIONES:
1. Analiza el texto del PDF de transferencia bancaria
2. Extrae TODA la informacion siguiendo el esquema JSON exacto
3. FORMATO DE MONEDA ARGENTINA (MUY IMPORTANTE):
   - En Argentina, el PUNTO es separador de MILES (no decimal)
   - En Argentina, la COMA es separador DECIMAL
   - Ejemplo: "$54.755,35" significa CINCUENTA Y CUATRO MIL setecientos cincuenta y cinco pesos con 35 centavos
   - En JSON debes retornar: 54755.35 (usando punto como decimal, SIN separador de miles)
   - Otro ejemplo: "$1.234.567,89" en JSON es: 1234567.89
   - NUNCA confundas el punto de miles con un decimal
4. El CBU tiene 22 digitos
5. El CUIT puede venir con o sin guiones

ESTRUCTURA DEL DOCUMENTO (MUY IMPORTANTE):
El PDF tiene varias secciones. DEBES distinguir correctamente entre:

1. DATOS DEL BANCO EMISOR (NO es el ordenante):
   - "Banco Macro S.A." con CUIT 30-50001008-4
   - Domicilio: "Av. Eduardo Madero 1182..."
   - ESTO ES EL BANCO, NO EL ORDENANTE. IGNORAR ESTOS DATOS PARA EL ORDENANTE.

2. DATOS DEL ORDENANTE (QUIEN HACE LA TRANSFERENCIA):
   - Aparece despues de la seccion "Ordenante"
   - Es una ESCUELA o EMPRESA (ej: "ESCUELA DE LA FAMILIA AGRICOLA...")
   - Tiene IIBB (Ingresos Brutos) mencionado
   - Su domicilio suele ser una direccion de escuela (ej: "RN 14 1200 CP:3364...")
   - Su CUIT empieza con 30 o 33 (persona juridica)

3. DATOS DEL BENEFICIARIO/TITULAR:
   - Es quien RECIBE la transferencia
   - Aparece en "Datos de la Operacion" como "Titular"
   - Ejemplo: "SINDICATO DE DOCENTES DE EDUCACION PUBLICA"

CAMPOS A EXTRAER:
- titulo: siempre "Transferencia a terceros banco Macro"
- nroReferencia: numero de referencia de la operacion
- nroOperacion: numero de operacion (9 digitos)
- fecha: formato DD/MM/YYYY
- hora: formato HH:MM AM/PM
- ordenante: datos de la ESCUELA/EMPRESA que hace la transferencia (NO del banco)
- operacion: datos de la operacion bancaria

FORMATO JSON REQUERIDO:
{
  "tipo": "TRANSFERENCIA",
  "titulo": "Transferencia a terceros banco Macro",
  "nroReferencia": "string",
  "nroOperacion": "string",
  "fecha": "DD/MM/YYYY",
  "hora": "HH:MM AM/PM",
  "ordenante": {
    "cuit": "string sin guiones (11 digitos)",
    "nombre": "string - NOMBRE DE LA ESCUELA/EMPRESA",
    "domicilio": "string - DIRECCION DE LA ESCUELA"
  },
  "operacion": {
    "cuentaOrigen": "CC $XXXXXXX",
    "importe": number (ej: si PDF dice "$54.755,35" retornar 54755.35),
    "cbuDestino": "string 22 digitos",
    "banco": "Macro",
    "titular": "string - BENEFICIARIO DE LA TRANSFERENCIA",
    "cuit": "XX-XXXXXXXX-X",
    "tipoOperacion": "string",
    "importeATransferir": number (mismo formato que importe),
    "importeTotal": number (mismo formato que importe)
  }
}

REGLAS IMPORTANTES:
- El ORDENANTE es la ESCUELA/EMPRESA que hace la transferencia, NO el banco emisor
- Buscar los datos del ordenante despues de "Ordenante" y cerca de "IIBB"
- El CUIT del ordenante va SIN guiones (solo 11 numeros)
- El CUIT del beneficiario/titular (en operacion) va CON guiones (XX-XXXXXXXX-X)
- Si importeATransferir o importeTotal no se encuentran, usar el valor de importe
- Si un campo no se encuentra, usar null
- NO incluyas el campo "archivo" en la respuesta, se agrega automaticamente
- El campo "banco" debe indicar el nombre del banco emisor detectado del documento

EJEMPLO DE ENTRADA Y SALIDA:

Texto de entrada:
"Banco Macro S.A. CUIT: 30-50001008-4
Transferencia a terceros
Nro. Referencia: 123456789 Nro. Operacion: 987654321
Fecha: 15/03/2024 Hora: 10:30 AM
Ordenante: ESCUELA SAN JOSE CUIT: 30123456789 IIBB
Cuenta Origen: CC $1234567
Importe: $54.755,35
CBU Destino: 2850590940090418135201
Titular: SINDICATO DOCENTES EDUCACION PUBLICA CUIT: 30-71234567-8"

Salida esperada:
{
  "tipo": "TRANSFERENCIA",
  "titulo": "Transferencia a terceros banco Macro",
  "nroReferencia": "123456789",
  "nroOperacion": "987654321",
  "fecha": "15/03/2024",
  "hora": "10:30 AM",
  "ordenante": {"cuit": "30123456789", "nombre": "ESCUELA SAN JOSE", "domicilio": null},
  "operacion": {
    "cuentaOrigen": "CC $1234567",
    "importe": 54755.35,
    "cbuDestino": "2850590940090418135201",
    "banco": "Macro",
    "titular": "SINDICATO DOCENTES EDUCACION PUBLICA",
    "cuit": "30-71234567-8",
    "tipoOperacion": "Transferencia a terceros",
    "importeATransferir": 54755.35,
    "importeTotal": 54755.35
  }
}`;

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
 * Valida el resultado de una transferencia y registra advertencias
 */
function validateTransferenciaResult(
	result: TransferenciaPDFResult,
	filename: string
): ValidationResult[] {
	const validations: ValidationResult[] = [];

	// Validar monto principal
	validations.push(
		...validateTransferenciaAmount(result.operacion.importe, filename)
	);

	// Validar consistencia entre importes
	validations.push(
		...validateTransferenciaConsistency(
			result.operacion.importe,
			result.operacion.importeATransferir,
			result.operacion.importeTotal,
			filename
		)
	);

	// Si hay advertencias, ignorarlas en producción
	getWarnings(validations);

	// Si hay errores críticos, lanzar excepción
	const errors = getErrors(validations);
	if (errors.length > 0) {
		throw new Error(`Validación fallida para ${filename}:\n${formatValidationResults(errors)}`);
	}

	return validations;
}

/**
 * Analiza un PDF de transferencia bancaria usando OpenAI (texto)
 * Incluye retry logic y validaciones post-OpenAI
 */
export async function analyzeTransferenciaWithAI(
  pdfText: string,
  filename: string
): Promise<TransferenciaPDFResult> {
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
    const validated = TransferenciaSchema.parse(parsed);
    const result: TransferenciaPDFResult = {
      ...validated,
      archivo: filename,
    };

    // Validar el resultado antes de retornarlo
    validateTransferenciaResult(result, filename);

    return result;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const errorDetails = err.issues.map(issue => {
        const path = issue.path.join('.');
        return `Campo "${path || 'raíz'}": ${issue.message} (código: ${issue.code})`;
      }).join('; ');
      throw new Error(`Error de validación Zod (AI texto): ${errorDetails}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`La IA no retornó JSON válido: ${err.message}`);
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Error en análisis AI de transferencia: ${errorMsg}`);
  }
}

/**
 * Analiza un PDF de transferencia bancaria usando OpenAI Vision (imagen base64)
 * Incluye retry logic y validaciones post-OpenAI
 */
export async function analyzeTransferenciaWithVision(
  imageBase64: string,
  filename: string
): Promise<TransferenciaPDFResult> {
  // Usar retry logic para llamadas a OpenAI
  const response = await withRetry(
    () => openai.chat.completions.create({
      model: MODEL_CONFIG.model,
      temperature: MODEL_CONFIG.temperature,
      max_tokens: MODEL_CONFIG.max_tokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analiza la siguiente imagen de un comprobante de transferencia bancaria y extrae la informacion estructurada en formato JSON:',
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
    const validated = TransferenciaSchema.parse(parsed);
    const result: TransferenciaPDFResult = {
      ...validated,
      archivo: filename,
    };

    // Validar el resultado antes de retornarlo
    validateTransferenciaResult(result, filename);

    return result;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const errorDetails = err.issues.map(issue => {
        const path = issue.path.join('.');
        return `Campo "${path || 'raíz'}": ${issue.message} (código: ${issue.code})`;
      }).join('; ');
      throw new Error(`Error de validación Zod (Vision): ${errorDetails}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`La IA Vision no retornó JSON válido: ${err.message}`);
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Error en análisis Vision de transferencia: ${errorMsg}`);
  }
}

/**
 * Analiza MÚLTIPLES páginas de un PDF usando Vision API
 * Cada página se analiza por separado y luego se combinan los resultados
 * Retorna MultiTransferenciaPDFResult si hay más de 1 transferencia, o TransferenciaPDFResult si hay solo 1
 * Incluye retry logic, validaciones y tracking de errores por página
 */
export async function analyzeMultipleTransferenciasWithVision(
  imagesBase64: string[],
  filename: string
): Promise<TransferenciaPDFResult | MultiTransferenciaPDFResult> {
  const transferencias: TransferenciaItem[] = [];
  let paginasConError = 0;
  const erroresPorPagina: string[] = [];

  // Analizar cada página por separado
  for (let i = 0; i < imagesBase64.length; i++) {
    const imageBase64 = imagesBase64[i];

    try {
      // Usar retry logic para cada página
      const response = await withRetry(
        () => openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analiza la siguiente imagen de un comprobante de transferencia bancaria y extrae la informacion estructurada en formato JSON:',
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
          maxRetries: 2, // Menos reintentos por página para no demorar mucho
          initialDelayMs: 500,
          shouldRetry: isOpenAIRetryableError
        }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        paginasConError++;
        erroresPorPagina.push(`Página ${i + 1}: Sin contenido de OpenAI`);
        continue;
      }

      const parsed = JSON.parse(content);
      const validated = TransferenciaSchema.parse(parsed);

      // Validar monto de esta transferencia
      const validaciones = validateTransferenciaAmount(validated.operacion.importe, `página ${i + 1}`);
      if (hasErrors(validaciones)) {
        paginasConError++;
        erroresPorPagina.push(`Página ${i + 1}: ${formatValidationResults(validaciones)}`);
        continue;
      }

      // Agregar como TransferenciaItem (sin tipo ni archivo)
      transferencias.push({
        titulo: validated.titulo,
        nroReferencia: validated.nroReferencia,
        nroOperacion: validated.nroOperacion,
        fecha: validated.fecha,
        hora: validated.hora,
        ordenante: validated.ordenante,
        operacion: validated.operacion,
      });
    } catch (err) {
      paginasConError++;
      let errorMsg = 'Error desconocido';
      if (err instanceof z.ZodError) {
        errorMsg = err.issues.map(issue => `${issue.path.join('.')}: ${issue.message} (${issue.code})`).join('; ');
      } else if (err instanceof SyntaxError) {
        errorMsg = `JSON inválido: ${err.message}`;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      erroresPorPagina.push(`Página ${i + 1}: ${errorMsg}`);
      // Continuar con las demás páginas
    }
  }

  if (transferencias.length === 0) {
    throw new Error(`No se pudo extraer ninguna transferencia del PDF. Errores: ${erroresPorPagina.join('; ')}`);
  }

  // Si solo hay 1 transferencia, retornar formato simple
  if (transferencias.length === 1) {
    const t = transferencias[0];
    const result: TransferenciaPDFResult = {
      tipo: 'TRANSFERENCIA',
      archivo: filename,
      titulo: t.titulo,
      nroReferencia: t.nroReferencia,
      nroOperacion: t.nroOperacion,
      fecha: t.fecha,
      hora: t.hora,
      ordenante: t.ordenante,
      operacion: t.operacion,
    };

    // Validar resultado final
    validateTransferenciaResult(result, filename);

    return result;
  }

  // Múltiples transferencias - calcular total usando currency.js para precisión
  const montos = transferencias.map(t => t.operacion.importe ?? 0);
  const importeTotal = sumarMontos(...montos);

  return {
    tipo: 'TRANSFERENCIAS_MULTIPLES',
    archivo: filename,
    transferencias,
    resumen: {
      cantidadTransferencias: transferencias.length,
      importeTotal: redondearMonto(importeTotal),
      paginasAnalizadas: imagesBase64.length,
      paginasConError,
    },
  };
}
