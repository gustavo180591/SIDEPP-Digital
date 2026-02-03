import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

if (!env.OPENAI_API_KEY) {
  console.error('[openai-config] OPENAI_API_KEY no esta configurada. El analizador de PDF no funcionara.');
}

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const MODEL_CONFIG = {
  model: 'gpt-4o-mini' as const,
  temperature: 0,
  max_tokens: 2000, // Optimizado: reducido de 4096 (suficiente para JSONs de respuesta)
};
