/**
 * Utilidades para manejo preciso de moneda usando currency.js
 *
 * JavaScript tiene problemas de precisión con números decimales:
 * - 0.1 + 0.2 = 0.30000000000000004
 * - 54755.35 - 53916.71 = 838.6399999999994
 *
 * currency.js resuelve estos problemas usando aritmética de enteros internamente.
 */

import currency from 'currency.js';

/**
 * Suma múltiples montos con precisión decimal
 * @example sumarMontos(100.10, 200.20, 300.30) // 600.60 (no 600.6000000000001)
 */
export function sumarMontos(...montos: number[]): number {
	return montos.reduce((acc, monto) => currency(acc).add(monto).value, 0);
}

/**
 * Resta dos montos con precisión decimal
 * @example restarMontos(54755.35, 53916.71) // 838.64 (no 838.6399999999994)
 */
export function restarMontos(a: number, b: number): number {
	return currency(a).subtract(b).value;
}

/**
 * Multiplica un monto por un factor
 * @example multiplicarMonto(100.50, 1.21) // 121.61
 */
export function multiplicarMonto(monto: number, factor: number): number {
	return currency(monto).multiply(factor).value;
}

/**
 * Divide un monto por un divisor
 * @example dividirMonto(100, 3) // 33.33
 */
export function dividirMonto(monto: number, divisor: number): number {
	return currency(monto).divide(divisor).value;
}

/**
 * Calcula la diferencia absoluta entre dos montos
 * @example diferenciaMonto(100.50, 99.30) // 1.20
 */
export function diferenciaMonto(a: number, b: number): number {
	return Math.abs(currency(a).subtract(b).value);
}

/**
 * Compara si dos montos son iguales dentro de una tolerancia
 * @param tolerancia - Diferencia máxima permitida (default: $0.01)
 * @example compararMontos(100.00, 100.01, 0.02) // true
 */
export function compararMontos(a: number, b: number, tolerancia = 0.01): boolean {
	const diferencia = diferenciaMonto(a, b);
	return diferencia <= tolerancia;
}

/**
 * Calcula tolerancia escalable basada en el monto
 * Para montos grandes, permite mayor tolerancia absoluta pero menor porcentual
 * @param monto - El monto base para calcular tolerancia
 * @param porcentaje - Porcentaje de tolerancia (default: 0.001 = 0.1%)
 * @param minimo - Tolerancia mínima absoluta (default: $1)
 * @returns La tolerancia calculada
 * @example calcularTolerancia(100000) // 100 (0.1% de 100000)
 * @example calcularTolerancia(100) // 1 (mínimo)
 */
export function calcularTolerancia(
	monto: number,
	porcentaje = 0.001,
	minimo = 1
): number {
	const toleranciaPorcentual = currency(monto).multiply(porcentaje).value;
	return Math.max(minimo, toleranciaPorcentual);
}

/**
 * Formatea un número como moneda argentina (ARS)
 * @example formatearMontoARS(54755.35) // "$ 54.755,35"
 */
export function formatearMontoARS(monto: number): string {
	return currency(monto, {
		symbol: '$ ',
		separator: '.',
		decimal: ',',
		precision: 2
	}).format();
}

/**
 * Formatea un número como moneda sin símbolo
 * @example formatearMonto(54755.35) // "54.755,35"
 */
export function formatearMonto(monto: number): string {
	return currency(monto, {
		symbol: '',
		separator: '.',
		decimal: ',',
		precision: 2
	}).format();
}

/**
 * Redondea un monto a 2 decimales
 * @example redondearMonto(100.456) // 100.46
 */
export function redondearMonto(monto: number): number {
	return currency(monto).value;
}

/**
 * Calcula el porcentaje de un monto respecto a otro
 * @example porcentajeMonto(10, 100) // 10
 */
export function porcentajeMonto(parte: number, total: number): number {
	if (total === 0) return 0;
	return currency(parte).divide(total).multiply(100).value;
}

/**
 * Verifica si un monto está dentro de un rango
 * @example montoEnRango(50, 0, 100) // true
 */
export function montoEnRango(monto: number, min: number, max: number): boolean {
	return monto >= min && monto <= max;
}
