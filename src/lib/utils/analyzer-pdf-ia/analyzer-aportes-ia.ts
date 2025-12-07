import { z } from 'zod';
import { openai, MODEL_CONFIG } from './openai-config.js';
import { cleanTextForAI } from './pdf-extractor.js';
import type { ListadoPDFResult } from './types/index.js';

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
3. Los numeros deben ser tipo number (sin comillas), usando punto como separador decimal
4. Los nombres de personas vienen en formato "APELLIDO  NOMBRE" (con doble espacio)
5. El CUIT tiene formato XX-XXXXXXXX-X
6. El periodo puede ser "MM/YYYY" o "FOPID" si es Fondo Fopid

CAMPOS A EXTRAER:
- escuela: nombre (en MAYUSCULAS), direccion (buscar "Ruta" o similar), cuit (formato XX-XXXXXXXX-X)
- fecha: formato MM/DD/YYYY (como viene en el PDF)
- periodo: formato MM/YYYY o "FOPID"
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
 * Analiza un PDF de listado de aportes usando OpenAI
 */
export async function analyzeAportesWithAI(
  pdfText: string,
  filename: string
): Promise<ListadoPDFResult> {
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
    const validated = ListadoAportesSchema.parse(parsed);
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
