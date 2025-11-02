/**
 * Utilidades para manejo de CUIT
 */

/**
 * Normaliza un CUIT removiendo guiones y espacios
 * @param cuit CUIT en cualquier formato
 * @returns CUIT sin guiones ni espacios (solo dígitos)
 */
export function normalizeCuit(cuit: string | null | undefined): string | null {
	if (!cuit) return null;
	return cuit.replace(/[-\s]/g, '');
}

/**
 * Formatea un CUIT a formato con guiones: XX-XXXXXXXX-X
 * @param cuit CUIT en formato de solo dígitos o con guiones
 * @returns CUIT formateado con guiones o null si es inválido
 */
export function formatCuit(cuit: string | null | undefined): string | null {
	if (!cuit) return null;

	// Normalizar primero (quitar guiones)
	const normalized = normalizeCuit(cuit);
	if (!normalized || normalized.length !== 11) {
		return null;
	}

	// Validar que sean solo dígitos
	if (!/^\d{11}$/.test(normalized)) {
		return null;
	}

	// Formatear: XX-XXXXXXXX-X
	return `${normalized.substr(0, 2)}-${normalized.substr(2, 8)}-${normalized.substr(10, 1)}`;
}

/**
 * Valida si un CUIT tiene el formato correcto (11 dígitos)
 * @param cuit CUIT a validar
 * @returns true si el formato es válido
 */
export function isValidCuitFormat(cuit: string | null | undefined): boolean {
	if (!cuit) return false;

	const normalized = normalizeCuit(cuit);
	return !!normalized && /^\d{11}$/.test(normalized);
}

/**
 * Compara dos CUITs independientemente del formato
 * @param cuit1 Primer CUIT
 * @param cuit2 Segundo CUIT
 * @returns true si son el mismo CUIT
 */
export function compareCuits(
	cuit1: string | null | undefined,
	cuit2: string | null | undefined
): boolean {
	const norm1 = normalizeCuit(cuit1);
	const norm2 = normalizeCuit(cuit2);

	if (!norm1 || !norm2) return false;

	return norm1 === norm2;
}
