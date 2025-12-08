import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export const MODEL_CONFIG = {
  model: 'gpt-4o-mini' as const,
  temperature: 0,
  max_tokens: 2000, // Optimizado: reducido de 4096 (suficiente para JSONs de respuesta)
};
