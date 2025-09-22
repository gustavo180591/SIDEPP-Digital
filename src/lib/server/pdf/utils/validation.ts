import { Prisma } from '@prisma/client';
import { logger } from './logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDecimal(value: unknown, fieldName: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (value === undefined || value === null) {
    result.errors.push(`El campo ${fieldName} es requerido`);
    result.isValid = false;
    return result;
  }

  // Convertir a string para validación
  const strValue = String(value).trim();
  
  // Verificar si es un número válido
  if (!/^-?\d+(\.\d+)?$/.test(strValue)) {
    result.errors.push(`El campo ${fieldName} debe ser un número válido`);
    result.isValid = false;
    return result;
  }

  // Convertir a número para validaciones adicionales
  const numValue = Number(strValue);
  
  if (isNaN(numValue)) {
    result.errors.push(`El campo ${fieldName} no es un número válido`);
    result.isValid = false;
    return result;
  }

  // Validar rango razonable para montos
  if (fieldName.toLowerCase().includes('monto') || fieldName.toLowerCase().includes('importe')) {
    if (numValue < 0) {
      result.warnings.push(`El campo ${fieldName} no debería ser negativo`);
    }
    
    if (numValue > 1000000) {
      result.warnings.push(`El campo ${fieldName} parece ser inusualmente alto`);
    }
  }

  return result;
}

export function validateString(value: unknown, fieldName: string, options: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
} = {}): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  const { required = true, minLength, maxLength, pattern } = options;

  if ((value === undefined || value === null || value === '') && required) {
    result.errors.push(`El campo ${fieldName} es requerido`);
    result.isValid = false;
    return result;
  }

  if (value === undefined || value === null || value === '') {
    return result;
  }

  const strValue = String(value).trim();

  if (minLength !== undefined && strValue.length < minLength) {
    result.errors.push(
      `El campo ${fieldName} debe tener al menos ${minLength} caracteres`
    );
    result.isValid = false;
  }

  if (maxLength !== undefined && strValue.length > maxLength) {
    result.warnings.push(
      `El campo ${fieldName} excede el máximo de ${maxLength} caracteres`
    );
  }

  if (pattern && !pattern.test(strValue)) {
    result.errors.push(
      `El campo ${fieldName} no cumple con el formato requerido`
    );
    result.isValid = false;
  }

  return result;
}

export function validateDate(value: unknown, fieldName: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (value === undefined || value === null) {
    result.errors.push(`El campo ${fieldName} es requerido`);
    result.isValid = false;
    return result;
  }

  let date: Date;
  
  try {
    date = new Date(String(value));
    
    if (isNaN(date.getTime())) {
      throw new Error('Fecha inválida');
    }
    
    // Validar rango de fechas razonable (ejemplo: entre 2000 y 2100)
    const year = date.getFullYear();
    if (year < 2000 || year > 2100) {
      result.warnings.push(`El año en ${fieldName} parece estar fuera del rango esperado`);
    }
    
  } catch (error) {
    result.errors.push(`El campo ${fieldName} debe ser una fecha válida`);
    result.isValid = false;
  }

  return result;
}

export function validateCUIT(cuit: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!cuit) {
    result.errors.push('El CUIT es requerido');
    result.isValid = false;
    return result;
  }

  // Limpiar el CUIT (quitar guiones y espacios)
  const cleanCuit = cuit.replace(/[\s-]/g, '');
  
  // Validar formato (11 dígitos)
  if (!/^\d{11}$/.test(cleanCuit)) {
    result.errors.push('El CUIT debe tener 11 dígitos');
    result.isValid = false;
    return result;
  }

  // Validar prefijo (primeros 2 dígitos)
  const prefijo = cleanCuit.substring(0, 2);
  const prefijosValidos = ['20', '23', '24', '27', '30', '33', '34'];
  
  if (!prefijosValidos.includes(prefijo)) {
    result.warnings.push('El prefijo del CUIT no es común en Argentina');
  }

  // Validar dígito verificador
  const digitos = cleanCuit.split('').map(Number);
  const verificador = digitos.pop(); // Último dígito
  
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  
  for (let i = 0; i < 10; i++) {
    suma += digitos[i] * factores[i];
  }
  
  const resto = suma % 11;
  const digitoCalculado = (11 - resto) % 11;
  
  if (digitoCalculado !== verificador) {
    result.errors.push('El CUIT no es válido (error en el dígito verificador)');
    result.isValid = false;
  }

  return result;
}

// Función para validar un objeto completo de contribución
export function validateContribution(contribution: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Validar CUIT/CUIL
  if (contribution.cuit) {
    const cuitValidation = validateCUIT(contribution.cuit);
    if (!cuitValidation.isValid) {
      result.errors.push(...cuitValidation.errors);
    }
    result.warnings.push(...cuitValidation.warnings);
  } else {
    result.errors.push('El CUIT/CUIL es requerido');
  }

  // Validar período
  if (contribution.period) {
    const periodValidation = validateString(contribution.period, 'Período', {
      required: true,
      pattern: /^\d{2}\/\d{4}$/
    });
    
    if (!periodValidation.isValid) {
      result.errors.push('El período debe tener el formato MM/YYYY');
    }
  } else {
    result.errors.push('El período es requerido');
  }

  // Validar montos
  const amountFields = ['importe', 'monto', 'amount'];
  amountFields.forEach(field => {
    if (contribution[field] !== undefined) {
      const amountValidation = validateDecimal(contribution[field], field);
      if (!amountValidation.isValid) {
        result.errors.push(...amountValidation.errors);
      }
      result.warnings.push(...amountValidation.warnings);
    }
  });

  // Validar fecha si existe
  if (contribution.fecha) {
    const dateValidation = validateDate(contribution.fecha, 'Fecha');
    if (!dateValidation.isValid) {
      result.errors.push(...dateValidation.errors);
    }
    result.warnings.push(...dateValidation.warnings);
  }

  // Actualizar el estado de validación general
  result.isValid = result.errors.length === 0;
  
  return result;
}
