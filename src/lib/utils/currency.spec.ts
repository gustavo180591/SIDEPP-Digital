import { describe, it, expect } from 'vitest';
import {
	sumarMontos,
	restarMontos,
	multiplicarMonto,
	dividirMonto,
	diferenciaMonto,
	compararMontos,
	calcularTolerancia,
	formatearMontoARS,
	formatearMonto,
	redondearMonto,
	porcentajeMonto,
	montoEnRango
} from './currency';

describe('currency.ts - Utilidades de moneda', () => {
	describe('sumarMontos', () => {
		it('suma montos sin errores de punto flotante', () => {
			// En JS normal: 0.1 + 0.2 = 0.30000000000000004
			expect(sumarMontos(0.1, 0.2)).toBe(0.3);
		});

		it('suma múltiples montos correctamente', () => {
			expect(sumarMontos(100.10, 200.20, 300.30)).toBe(600.6);
		});

		it('suma montos grandes correctamente', () => {
			expect(sumarMontos(53916.71, 838.64)).toBe(54755.35);
		});

		it('retorna 0 para array vacío', () => {
			expect(sumarMontos()).toBe(0);
		});
	});

	describe('restarMontos', () => {
		it('resta montos sin errores de punto flotante', () => {
			// En JS normal: 54755.35 - 53916.71 = 838.6399999999994
			expect(restarMontos(54755.35, 53916.71)).toBe(838.64);
		});

		it('maneja restas con resultado negativo', () => {
			expect(restarMontos(100, 150)).toBe(-50);
		});
	});

	describe('multiplicarMonto', () => {
		it('multiplica correctamente', () => {
			expect(multiplicarMonto(100.50, 2)).toBe(201);
		});

		it('multiplica con porcentajes', () => {
			// 1% de 54755.35
			expect(multiplicarMonto(54755.35, 0.01)).toBe(547.55);
		});
	});

	describe('dividirMonto', () => {
		it('divide correctamente', () => {
			expect(dividirMonto(100, 3)).toBe(33.33);
		});

		it('divide montos grandes', () => {
			expect(dividirMonto(54755.35, 2)).toBe(27377.68);
		});
	});

	describe('diferenciaMonto', () => {
		it('calcula diferencia absoluta', () => {
			expect(diferenciaMonto(100.50, 99.30)).toBe(1.2);
		});

		it('maneja orden invertido', () => {
			expect(diferenciaMonto(99.30, 100.50)).toBe(1.2);
		});

		it('retorna 0 para montos iguales', () => {
			expect(diferenciaMonto(54755.35, 54755.35)).toBe(0);
		});
	});

	describe('compararMontos', () => {
		it('retorna true para montos dentro de tolerancia', () => {
			expect(compararMontos(100.00, 100.01, 0.02)).toBe(true);
		});

		it('retorna false para montos fuera de tolerancia', () => {
			expect(compararMontos(100.00, 100.05, 0.02)).toBe(false);
		});

		it('usa tolerancia default de 0.01', () => {
			expect(compararMontos(100.00, 100.01)).toBe(true);
			expect(compararMontos(100.00, 100.02)).toBe(false);
		});
	});

	describe('calcularTolerancia', () => {
		it('usa mínimo para montos pequeños', () => {
			// 0.1% de 100 = 0.10, pero mínimo es 1
			expect(calcularTolerancia(100)).toBe(1);
		});

		it('usa porcentaje para montos grandes', () => {
			// 0.1% de 100000 = 100
			expect(calcularTolerancia(100000)).toBe(100);
		});

		it('permite configurar porcentaje y mínimo', () => {
			// 1% de 1000 = 10, mínimo 5
			expect(calcularTolerancia(1000, 0.01, 5)).toBe(10);
			// 1% de 100 = 1, mínimo 5
			expect(calcularTolerancia(100, 0.01, 5)).toBe(5);
		});
	});

	describe('formatearMontoARS', () => {
		it('formatea como pesos argentinos', () => {
			expect(formatearMontoARS(54755.35)).toBe('$ 54.755,35');
		});

		it('formatea montos pequeños', () => {
			expect(formatearMontoARS(0.50)).toBe('$ 0,50');
		});

		it('formatea millones', () => {
			expect(formatearMontoARS(1234567.89)).toBe('$ 1.234.567,89');
		});
	});

	describe('formatearMonto', () => {
		it('formatea sin símbolo', () => {
			expect(formatearMonto(54755.35)).toBe('54.755,35');
		});
	});

	describe('redondearMonto', () => {
		it('redondea a 2 decimales', () => {
			expect(redondearMonto(100.456)).toBe(100.46);
		});

		it('no cambia montos ya redondeados', () => {
			expect(redondearMonto(100.50)).toBe(100.5);
		});
	});

	describe('porcentajeMonto', () => {
		it('calcula porcentaje correctamente', () => {
			expect(porcentajeMonto(10, 100)).toBe(10);
		});

		it('maneja porcentajes decimales', () => {
			expect(porcentajeMonto(547.55, 54755.35)).toBeCloseTo(1, 1);
		});

		it('retorna 0 si total es 0', () => {
			expect(porcentajeMonto(10, 0)).toBe(0);
		});
	});

	describe('montoEnRango', () => {
		it('retorna true para monto en rango', () => {
			expect(montoEnRango(50, 0, 100)).toBe(true);
		});

		it('retorna true para límites exactos', () => {
			expect(montoEnRango(0, 0, 100)).toBe(true);
			expect(montoEnRango(100, 0, 100)).toBe(true);
		});

		it('retorna false para monto fuera de rango', () => {
			expect(montoEnRango(150, 0, 100)).toBe(false);
			expect(montoEnRango(-10, 0, 100)).toBe(false);
		});
	});
});
