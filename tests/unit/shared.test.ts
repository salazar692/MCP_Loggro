import { describe, expect, it } from 'vitest';

import {
  dateInput,
  dayRangeToIso,
  joinName,
  pageInfo,
  toRestobarPage,
} from '../../src/tools/shared.ts';

describe('dayRangeToIso', () => {
  it('convierte días de Bogotá (UTC−5) a instantes UTC inclusivos', () => {
    expect(dayRangeToIso('2026-09-28', '2026-09-28', 'America/Bogota')).toEqual({
      start: '2026-09-28T05:00:00.000Z',
      end: '2026-09-29T04:59:59.999Z',
    });
  });

  it('respeta zonas con horario de verano', () => {
    expect(dayRangeToIso('2026-07-01', undefined, 'America/New_York').start).toBe(
      '2026-07-01T04:00:00.000Z',
    );
  });

  it('valida el orden y el tamaño del rango', () => {
    expect(() => dayRangeToIso('2026-09-10', '2026-09-01', 'UTC')).toThrow(/anterior/);
    expect(() => dayRangeToIso('2026-01-01', '2026-06-01', 'UTC')).toThrow(/93 días/);
    expect(dayRangeToIso('2026-01-01', '2026-04-03', 'UTC').end).toBe('2026-04-03T23:59:59.999Z');
  });
});

describe('dateInput', () => {
  it('rechaza formatos y fechas inexistentes', () => {
    expect(dateInput.safeParse('2026-02-28').success).toBe(true);
    expect(dateInput.safeParse('2026-02-30').success).toBe(false);
    expect(dateInput.safeParse('28/02/2026').success).toBe(false);
  });
});

describe('paginación', () => {
  it('convierte page desde 1 a page desde 0', () => {
    expect(toRestobarPage(1, 20)).toEqual({ page: 0, limit: 20 });
  });

  it('calcula hasMore con y sin total', () => {
    expect(pageInfo(2, 10, 25, 10).hasMore).toBe(true);
    expect(pageInfo(3, 10, 25, 5).hasMore).toBe(false);
    expect(pageInfo(1, 10, null, 10)).toEqual({
      page: 1,
      pageSize: 10,
      total: null,
      hasMore: true,
    });
  });
});

describe('joinName', () => {
  it('une partes no vacías', () => {
    expect(joinName('Ana', null, ' ', 'Pérez')).toBe('Ana Pérez');
    expect(joinName(undefined, '')).toBeNull();
  });
});
