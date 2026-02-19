import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

if (!env.OPENAI_API_KEY) {
  console.error('[openai-config] OPENAI_API_KEY no esta configurada. El analizador de PDF no funcionara.');
}

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const MODEL_CONFIG = {
  model: (env.OPENAI_MODEL || 'gpt-4o-mini') as string,
  temperature: 0,
  max_tokens: 4096,
};
