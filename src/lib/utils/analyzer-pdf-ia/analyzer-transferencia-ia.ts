import { z } from 'zod';
import { openai, MODEL_CONFIG } from './openai-config.js';
import { cleanTextForAI } from './pdf-extractor.js';
import type { TransferenciaPDFResult } from './types/index.js';

// Schema de validacion con Zod
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

const TransferenciaSchema = z.object({
  tipo: z.literal('TRANSFERENCIA'),
  titulo: z.string(),
  nroReferencia: z.string().nullable(),
  nroOperacion: z.string().nullable(),
  fecha: z.string().nullable(),
  hora: z.string().nullable(),
  ordenante: OrdenanteSchema,
  operacion: OperacionSchema,
});

const SYSTEM_PROMPT = `Eres un asistente especializado en extraer datos de comprobantes de transferencias bancarias del Banco Macro de Argentina.

INSTRUCCIONES:
1. Analiza el texto del PDF de transferencia bancaria
2. Extrae TODA la informacion siguiendo el esquema JSON exacto
3. Los importes son numeros decimales (usar punto como separador decimal)
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
    "importe": number,
    "cbuDestino": "string 22 digitos",
    "banco": "Macro",
    "titular": "string - BENEFICIARIO DE LA TRANSFERENCIA",
    "cuit": "XX-XXXXXXXX-X",
    "tipoOperacion": "string",
    "importeATransferir": number,
    "importeTotal": number
  }
}

REGLAS IMPORTANTES:
- El ORDENANTE es la ESCUELA que hace la transferencia, NO el Banco Macro
- Buscar los datos del ordenante despues de "Ordenante" y cerca de "IIBB"
- El CUIT del ordenante va SIN guiones (solo 11 numeros)
- El CUIT del beneficiario/titular (en operacion) va CON guiones (XX-XXXXXXXX-X)
- Si importeATransferir o importeTotal no se encuentran, usar el valor de importe
- Si un campo no se encuentra, usar null
- NO incluyas el campo "archivo" en la respuesta, se agrega automaticamente`;

/**
 * Analiza un PDF de transferencia bancaria usando OpenAI (texto)
 */
export async function analyzeTransferenciaWithAI(
  pdfText: string,
  filename: string
): Promise<TransferenciaPDFResult> {
  const response = await openai.chat.completions.create({
    ...MODEL_CONFIG,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analiza el siguiente texto extraido de un PDF y extrae la informacion estructurada:\n\n${cleanTextForAI(pdfText)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI no retorno contenido');
  }

  try {
    const parsed = JSON.parse(content);
    const validated = TransferenciaSchema.parse(parsed);
    return {
      ...validated,
      archivo: filename,
    };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      console.error('Errores de validacion:', err.issues);
      throw new Error(`Validacion fallida: ${JSON.stringify(err.issues)}`);
    }
    throw err;
  }
}

/**
 * Analiza un PDF de transferencia bancaria usando OpenAI Vision (imagen base64)
 */
export async function analyzeTransferenciaWithVision(
  imageBase64: string,
  filename: string
): Promise<TransferenciaPDFResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // gpt-4o-mini soporta imagenes
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
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI Vision no retorno contenido');
  }

  try {
    const parsed = JSON.parse(content);
    const validated = TransferenciaSchema.parse(parsed);
    return {
      ...validated,
      archivo: filename,
    };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      console.error('Errores de validacion Vision:', err.issues);
      throw new Error(`Validacion Vision fallida: ${JSON.stringify(err.issues)}`);
    }
    throw err;
  }
}
