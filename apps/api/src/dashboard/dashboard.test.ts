import { describe, expect, it } from 'vitest';
import { horasDisponiblesPorSala } from './dashboard.module';

describe('horasDisponiblesPorSala', () => {
  it('cuenta lunes a viernes × 15 horas', () => {
    // 09/11/2026 (lunes) a 16/11/2026: 5 días hábiles
    expect(horasDisponiblesPorSala(new Date(2026, 10, 9), new Date(2026, 10, 16))).toBe(75);
  });
});
