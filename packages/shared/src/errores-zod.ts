import { z } from 'zod';

/**
 * Mensajes de validación en español para los casos que no tienen mensaje propio.
 * Se registra al importar @reservaitn/shared, así la API, la web y la app muestran lo mismo.
 * (Zod 4: `z.config({ customError })`; un mensaje puesto en el esquema tiene prioridad.)
 */
const tamano = (origen: string, limite: number | bigint, minimo: boolean) => {
  if (origen === 'string') return `${minimo ? 'Mínimo' : 'Máximo'} ${limite} caracteres`;
  if (origen === 'array' || origen === 'set') return minimo ? `Debe tener al menos ${limite} elemento(s)` : `Debe tener como máximo ${limite} elemento(s)`;
  return `Debe ser ${minimo ? 'mayor' : 'menor'} o igual a ${limite}`;
};

z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        if (issue.input === undefined) return 'Campo obligatorio';
        if (issue.expected === 'number') return 'Debe ser un número';
        if (issue.expected === 'date') return 'Fecha inválida';
        return `Tipo inválido: se esperaba ${issue.expected}`;
      case 'invalid_format':
        if (issue.format === 'uuid' || issue.format === 'guid') return 'Identificador inválido';
        if (issue.format === 'email') return 'Correo inválido';
        if (issue.format === 'datetime' || issue.format === 'date') return 'Fecha inválida';
        return 'Formato inválido';
      case 'invalid_value':
        return `Valor inválido. Opciones: ${issue.values.map(String).join(', ')}`;
      case 'too_small':
        return tamano(issue.origin, issue.minimum, true);
      case 'too_big':
        return tamano(issue.origin, issue.maximum, false);
      default:
        return undefined;
    }
  },
});
