// Re-exportar tipos
export * from './types/index.js';

// Exportar servicios
export {
	analyzeWithClaude,
	bufferToClaudeImage,
	bufferToClaudePdf,
	type ClaudeContent,
	type ClaudeImageContent,
	type ClaudeDocumentContent,
	type ClaudeTextContent,
	type ClaudeAnalysisOptions
} from './services/claude-service.js';

// Exportar analizadores
export { analyzeTransferenciaIA } from './analyzers/analyzer-ia-transferencia.js';
export { analyzeAportesIA, esFOPID } from './analyzers/analyzer-ia-aportes.js';

// Exportar prompts (para personalización si es necesario)
export {
	SYSTEM_PROMPT_TRANSFERENCIA,
	USER_PROMPT_TRANSFERENCIA
} from './prompts/prompt-transferencia.js';
export { SYSTEM_PROMPT_APORTES, USER_PROMPT_APORTES } from './prompts/prompt-aportes.js';
