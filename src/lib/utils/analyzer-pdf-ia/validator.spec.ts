import { describe, it, expect } from 'vitest';
import {
	validateTransferenciaAmount,
	validateTransferenciaConsistency,
	validateAportesTotales,
	validateAporteConceptoPorcentaje,
	validateAporteAmount,
	getErrors,
	getWarnings,
	hasErrors,
	formatValidationResults,
	type PersonaAporte
} from './validator';

describe('validator.ts - Validaciones post-OpenAI', () => {
	describe('validateTransferenciaAmount', () => {
		it('acepta montos válidos sin warnings ni errores', () => {
			const results = validateTransferenciaAmount(54755.35, 'test');
			expect(hasErrors(results)).toBe(false);
			expect(getWarnings(results)).toHaveLength(0);
		});

		it('genera error para monto null', () => {
			const results = validateTransferenciaAmount(null, 'test');
			expect(hasErrors(results)).toBe(true);
			expect(getErrors(results)[0].mensaje).toContain('no encontrado');
		});

		it('genera error para monto negativo', () => {
			const results = validateTransferenciaAmount(-100, 'test');
			expect(hasErrors(results)).toBe(true);
			expect(getErrors(results)[0].mensaje).toContain('positivo');
		});

		it('genera warning para monto muy bajo', () => {
			const results = validateTransferenciaAmount(50, 'test');
			expect(hasErrors(results)).toBe(false);
			expect(getWarnings(results)).toHaveLength(1);
			expect(getWarnings(results)[0].mensaje).toContain('sospechosamente bajo');
		});

		it('genera error para monto excesivo', () => {
			const results = validateTransferenciaAmount(999_999_999, 'test');
			expect(hasErrors(results)).toBe(true);
			expect(getErrors(results)[0].mensaje).toContain('excede límite');
		});

		it('acepta monto en el límite bajo sin error', () => {
			const results = validateTransferenciaAmount(100, 'test');
			expect(hasErrors(results)).toBe(false);
		});
	});

	describe('validateTransferenciaConsistency', () => {
		it('no genera warnings cuando todos los importes son iguales', () => {
			const results = validateTransferenciaConsistency(
				54755.35,
				54755.35,
				54755.35,
				'test'
			);
			expect(results).toHaveLength(0);
		});

		it('genera warning cuando hay inconsistencia', () => {
			const results = validateTransferenciaConsistency(
				54755.35,
				54755.35,
				54700, // diferente
				'test'
			);
			expect(results).toHaveLength(1);
			expect(results[0].tipo).toBe('warning');
			expect(results[0].mensaje).toContain('Inconsistencia');
		});

		it('no genera warning para pequeñas diferencias (< $1)', () => {
			const results = validateTransferenciaConsistency(
				54755.35,
				54755.35,
				54755.50, // solo $0.15 de diferencia
				'test'
			);
			expect(results).toHaveLength(0);
		});

		it('maneja valores null correctamente', () => {
			const results = validateTransferenciaConsistency(
				54755.35,
				null,
				null,
				'test'
			);
			expect(results).toHaveLength(0);
		});
	});

	describe('validateAportesTotales', () => {
		it('acepta cuando suma coincide con total', () => {
			const personas: PersonaAporte[] = [
				{ nombre: 'GARCIA JUAN', totalRemunerativo: 100000, cantidadLegajos: 1, montoConcepto: 100 },
				{ nombre: 'LOPEZ MARIA', totalRemunerativo: 200000, cantidadLegajos: 1, montoConcepto: 200 },
			];
			const results = validateAportesTotales(personas, 300, 'test');
			expect(hasErrors(results)).toBe(false);
			expect(getWarnings(results)).toHaveLength(0);
		});

		it('genera warning cuando suma no coincide', () => {
			const personas: PersonaAporte[] = [
				{ nombre: 'GARCIA JUAN', totalRemunerativo: 100000, cantidadLegajos: 1, montoConcepto: 100 },
				{ nombre: 'LOPEZ MARIA', totalRemunerativo: 200000, cantidadLegajos: 1, montoConcepto: 200 },
			];
			const results = validateAportesTotales(personas, 500, 'test'); // debería ser 300
			expect(getWarnings(results)).toHaveLength(1);
			expect(getWarnings(results)[0].mensaje).toContain('Inconsistencia');
		});

		it('genera error para array vacío', () => {
			const results = validateAportesTotales([], 100, 'test');
			expect(hasErrors(results)).toBe(true);
			expect(getErrors(results)[0].mensaje).toContain('No se encontraron personas');
		});

		it('tolera diferencias menores a $1', () => {
			const personas: PersonaAporte[] = [
				{ nombre: 'GARCIA JUAN', totalRemunerativo: 100000, cantidadLegajos: 1, montoConcepto: 100.50 },
			];
			const results = validateAportesTotales(personas, 100, 'test'); // $0.50 de diferencia
			expect(getWarnings(results)).toHaveLength(0);
		});
	});

	describe('validateAporteConceptoPorcentaje', () => {
		it('acepta montoConcepto ~1% de totalRemunerativo', () => {
			const persona: PersonaAporte = {
				nombre: 'GARCIA JUAN',
				totalRemunerativo: 100000,
				cantidadLegajos: 1,
				montoConcepto: 1000 // 1%
			};
			const results = validateAporteConceptoPorcentaje(persona, 'test');
			expect(results).toHaveLength(0);
		});

		it('genera warning para porcentaje muy bajo', () => {
			const persona: PersonaAporte = {
				nombre: 'GARCIA JUAN',
				totalRemunerativo: 100000,
				cantidadLegajos: 1,
				montoConcepto: 100 // 0.1%
			};
			const results = validateAporteConceptoPorcentaje(persona, 'test');
			expect(getWarnings(results)).toHaveLength(1);
			expect(getWarnings(results)[0].mensaje).toContain('muy bajo');
		});

		it('genera warning para porcentaje muy alto', () => {
			const persona: PersonaAporte = {
				nombre: 'GARCIA JUAN',
				totalRemunerativo: 100000,
				cantidadLegajos: 1,
				montoConcepto: 5000 // 5%
			};
			const results = validateAporteConceptoPorcentaje(persona, 'test');
			expect(getWarnings(results)).toHaveLength(1);
			expect(getWarnings(results)[0].mensaje).toContain('muy alto');
		});

		it('no valida si totalRemunerativo es 0', () => {
			const persona: PersonaAporte = {
				nombre: 'GARCIA JUAN',
				totalRemunerativo: 0,
				cantidadLegajos: 1,
				montoConcepto: 100
			};
			const results = validateAporteConceptoPorcentaje(persona, 'test');
			expect(results).toHaveLength(0);
		});
	});

	describe('validateAporteAmount', () => {
		it('acepta montos válidos', () => {
			const results = validateAporteAmount(1000, 'montoConcepto', 'test');
			expect(results).toHaveLength(0);
		});

		it('genera error para montos negativos', () => {
			const results = validateAporteAmount(-100, 'montoConcepto', 'test');
			expect(hasErrors(results)).toBe(true);
		});

		it('genera warning para montos muy altos', () => {
			const results = validateAporteAmount(15_000_000, 'montoConcepto', 'test');
			expect(getWarnings(results)).toHaveLength(1);
		});

		it('acepta null sin errores', () => {
			const results = validateAporteAmount(null, 'montoConcepto', 'test');
			expect(results).toHaveLength(0);
		});
	});

	describe('formatValidationResults', () => {
		it('formatea errores y warnings correctamente', () => {
			const results = [
				{ tipo: 'error' as const, mensaje: 'Error crítico', campo: 'importe' },
				{ tipo: 'warning' as const, mensaje: 'Advertencia leve', campo: 'monto' },
			];
			const formatted = formatValidationResults(results);
			expect(formatted).toContain('❌ ERROR');
			expect(formatted).toContain('Error crítico');
			expect(formatted).toContain('⚠️ WARNING');
			expect(formatted).toContain('Advertencia leve');
		});

		it('retorna mensaje para array vacío', () => {
			const formatted = formatValidationResults([]);
			expect(formatted).toBe('Sin problemas de validación');
		});
	});

	describe('getErrors y getWarnings', () => {
		it('filtra correctamente por tipo', () => {
			const results = [
				{ tipo: 'error' as const, mensaje: 'Error 1' },
				{ tipo: 'warning' as const, mensaje: 'Warning 1' },
				{ tipo: 'error' as const, mensaje: 'Error 2' },
			];
			expect(getErrors(results)).toHaveLength(2);
			expect(getWarnings(results)).toHaveLength(1);
		});
	});
});
