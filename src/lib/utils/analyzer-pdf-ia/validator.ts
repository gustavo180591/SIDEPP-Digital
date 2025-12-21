/**
 * Validaciones post-OpenAI para datos extraídos de PDFs
 *
 * Estas validaciones se ejecutan DESPUÉS de que OpenAI retorna los datos,
 * para asegurar que los valores son razonables y consistentes.
 */

import { sumarMontos, diferenciaMonto } from '$lib/utils/currency.js';

// ============================================================================
// TIPOS
// ============================================================================

export interface PersonaAporte {
	nombre: string;
	totalRemunerativo: number;
	cantidadLegajos: number;
	montoConcepto: number;
}

export interface ValidationWarning {
	tipo: 'warning';
	mensaje: string;
	campo?: string;
	valor?: number | string;
}

export interface ValidationError {
	tipo: 'error';
	mensaje: string;
	campo?: string;
	valor?: number | string;
}

export type ValidationResult = ValidationWarning | ValidationError;

// ============================================================================
// CONSTANTES DE VALIDACIÓN
// ============================================================================

/** Monto mínimo razonable para una transferencia ($100) */
const MONTO_MINIMO_TRANSFERENCIA = 100;

/** Monto máximo razonable para una transferencia ($100 millones) */
const MONTO_MAXIMO_TRANSFERENCIA = 100_000_000;

/** Monto mínimo razonable para un aporte individual ($10) */
const MONTO_MINIMO_APORTE = 10;

/** Monto máximo razonable para un aporte individual ($10 millones) */
const MONTO_MAXIMO_APORTE = 10_000_000;

/** Tolerancia para validación de totales ($1) */
const TOLERANCIA_TOTALES = 1;

/** Porcentaje mínimo esperado de montoConcepto vs totalRemunerativo (0.5%) */
const PORCENTAJE_CONCEPTO_MIN = 0.005;

/** Porcentaje máximo esperado de montoConcepto vs totalRemunerativo (3%) */
const PORCENTAJE_CONCEPTO_MAX = 0.03;

// ============================================================================
// VALIDACIONES DE TRANSFERENCIAS
// ============================================================================

/**
 * Valida el monto de una transferencia bancaria
 * @throws Error si el monto es claramente inválido
 * @returns Array de warnings si el monto es sospechoso pero podría ser válido
 */
export function validateTransferenciaAmount(
	amount: number | null | undefined,
	context: string
): ValidationResult[] {
	const results: ValidationResult[] = [];

	if (amount === null || amount === undefined) {
		results.push({
			tipo: 'error',
			mensaje: `Monto de transferencia no encontrado en ${context}`,
			campo: 'importe',
			valor: undefined
		});
		return results;
	}

	if (typeof amount !== 'number' || isNaN(amount)) {
		results.push({
			tipo: 'error',
			mensaje: `Monto de transferencia no es un número válido en ${context}: ${amount}`,
			campo: 'importe',
			valor: amount
		});
		return results;
	}

	if (amount <= 0) {
		results.push({
			tipo: 'error',
			mensaje: `Monto de transferencia debe ser positivo en ${context}: $${amount}`,
			campo: 'importe',
			valor: amount
		});
		return results;
	}

	if (amount < MONTO_MINIMO_TRANSFERENCIA) {
		results.push({
			tipo: 'warning',
			mensaje: `Monto de transferencia sospechosamente bajo en ${context}: $${amount.toFixed(2)} (mínimo esperado: $${MONTO_MINIMO_TRANSFERENCIA})`,
			campo: 'importe',
			valor: amount
		});
	}

	if (amount > MONTO_MAXIMO_TRANSFERENCIA) {
		results.push({
			tipo: 'error',
			mensaje: `Monto de transferencia excede límite razonable en ${context}: $${amount.toFixed(2)} (máximo: $${MONTO_MAXIMO_TRANSFERENCIA.toLocaleString()})`,
			campo: 'importe',
			valor: amount
		});
	}

	return results;
}

/**
 * Valida la consistencia entre importe, importeATransferir e importeTotal
 */
export function validateTransferenciaConsistency(
	importe: number | null | undefined,
	importeATransferir: number | null | undefined,
	importeTotal: number | null | undefined,
	context: string
): ValidationResult[] {
	const results: ValidationResult[] = [];

	// Si todos están presentes, deberían ser iguales o muy cercanos
	const valores = [importe, importeATransferir, importeTotal].filter(
		(v): v is number => v !== null && v !== undefined && !isNaN(v)
	);

	if (valores.length >= 2) {
		const max = Math.max(...valores);
		const min = Math.min(...valores);
		const diferencia = diferenciaMonto(max, min);

		if (diferencia > 1) {
			results.push({
				tipo: 'warning',
				mensaje: `Inconsistencia en montos de transferencia en ${context}: importe=$${importe}, importeATransferir=$${importeATransferir}, importeTotal=$${importeTotal}`,
				campo: 'importe',
				valor: diferencia
			});
		}
	}

	return results;
}

// ============================================================================
// VALIDACIONES DE APORTES
// ============================================================================

/**
 * Valida que la suma de montos de personas coincida con el total reportado
 */
export function validateAportesTotales(
	personas: PersonaAporte[],
	totalesReportados: number,
	context: string
): ValidationResult[] {
	const results: ValidationResult[] = [];

	if (!personas || personas.length === 0) {
		results.push({
			tipo: 'error',
			mensaje: `No se encontraron personas en el listado de aportes (${context})`,
			campo: 'personas'
		});
		return results;
	}

	const montosConcepto = personas.map((p) => p.montoConcepto || 0);
	const sumCalculada = sumarMontos(...montosConcepto);
	const diferencia = diferenciaMonto(sumCalculada, totalesReportados);

	if (diferencia > TOLERANCIA_TOTALES) {
		results.push({
			tipo: 'warning',
			mensaje: `Inconsistencia en totales (${context}): suma calculada ($${sumCalculada.toFixed(2)}) no coincide con total reportado ($${totalesReportados.toFixed(2)}). Diferencia: $${diferencia.toFixed(2)}`,
			campo: 'totales.montoTotal',
			valor: diferencia
		});
	}

	return results;
}

/**
 * Valida que el montoConcepto sea aproximadamente 1% del totalRemunerativo
 */
export function validateAporteConceptoPorcentaje(
	persona: PersonaAporte,
	context: string
): ValidationResult[] {
	const results: ValidationResult[] = [];

	if (!persona.totalRemunerativo || persona.totalRemunerativo <= 0) {
		return results; // No se puede validar sin totalRemunerativo
	}

	if (!persona.montoConcepto || persona.montoConcepto <= 0) {
		results.push({
			tipo: 'warning',
			mensaje: `Monto de concepto inválido para ${persona.nombre} en ${context}: $${persona.montoConcepto}`,
			campo: 'montoConcepto',
			valor: persona.montoConcepto
		});
		return results;
	}

	const porcentaje = persona.montoConcepto / persona.totalRemunerativo;

	if (porcentaje < PORCENTAJE_CONCEPTO_MIN) {
		results.push({
			tipo: 'warning',
			mensaje: `Porcentaje de concepto muy bajo para ${persona.nombre} en ${context}: ${(porcentaje * 100).toFixed(2)}% (esperado: ~1%)`,
			campo: 'montoConcepto',
			valor: porcentaje
		});
	}

	if (porcentaje > PORCENTAJE_CONCEPTO_MAX) {
		results.push({
			tipo: 'warning',
			mensaje: `Porcentaje de concepto muy alto para ${persona.nombre} en ${context}: ${(porcentaje * 100).toFixed(2)}% (esperado: ~1%)`,
			campo: 'montoConcepto',
			valor: porcentaje
		});
	}

	return results;
}

/**
 * Valida un monto individual de aporte
 */
export function validateAporteAmount(
	amount: number | null | undefined,
	campo: string,
	context: string
): ValidationResult[] {
	const results: ValidationResult[] = [];

	if (amount === null || amount === undefined) {
		return results; // Campos opcionales pueden ser null
	}

	if (typeof amount !== 'number' || isNaN(amount)) {
		results.push({
			tipo: 'error',
			mensaje: `${campo} no es un número válido en ${context}: ${amount}`,
			campo,
			valor: amount
		});
		return results;
	}

	if (amount < 0) {
		results.push({
			tipo: 'error',
			mensaje: `${campo} no puede ser negativo en ${context}: $${amount}`,
			campo,
			valor: amount
		});
	}

	if (amount > MONTO_MAXIMO_APORTE) {
		results.push({
			tipo: 'warning',
			mensaje: `${campo} excede límite esperado en ${context}: $${amount.toFixed(2)}`,
			campo,
			valor: amount
		});
	}

	return results;
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Filtra solo los errores de un array de resultados
 */
export function getErrors(results: ValidationResult[]): ValidationError[] {
	return results.filter((r): r is ValidationError => r.tipo === 'error');
}

/**
 * Filtra solo los warnings de un array de resultados
 */
export function getWarnings(results: ValidationResult[]): ValidationWarning[] {
	return results.filter((r): r is ValidationWarning => r.tipo === 'warning');
}

/**
 * Verifica si hay errores críticos en los resultados
 */
export function hasErrors(results: ValidationResult[]): boolean {
	return results.some((r) => r.tipo === 'error');
}

/**
 * Formatea los resultados de validación para logging
 */
export function formatValidationResults(results: ValidationResult[]): string {
	if (results.length === 0) return 'Sin problemas de validación';

	return results
		.map((r) => {
			const prefix = r.tipo === 'error' ? '❌ ERROR' : '⚠️ WARNING';
			return `${prefix}: ${r.mensaje}`;
		})
		.join('\n');
}
