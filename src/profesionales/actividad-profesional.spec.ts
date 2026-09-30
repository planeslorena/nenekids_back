import {
  admiteReserva,
  estadoActividad,
  resolverFechaBaja,
} from './actividad-profesional';

describe('Baja en horario argentino', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T02:59:59Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('entra en vigencia exactamente a medianoche de Argentina', () => {
    expect(estadoActividad('2026-10-01T00:00:00')).toBe('BAJA_PROGRAMADA');
    jest.setSystemTime(new Date('2026-10-01T03:00:00Z'));
    expect(estadoActividad('2026-10-01T00:00:00')).toBe('INACTIVA');
  });

  it('impide reservas desde la fecha programada y permite las anteriores', () => {
    expect(admiteReserva('2026-10-01T00:00:00', '2026-09-30', '23:30')).toBe(
      true,
    );
    expect(admiteReserva('2026-10-01T00:00:00', '2026-10-01', '00:00')).toBe(
      false,
    );
    expect(admiteReserva('2026-10-01T00:00:00', '2026-11-01', '10:00')).toBe(
      false,
    );
    expect(admiteReserva(null, '2026-11-01')).toBe(true);
  });

  it('baja inmediata bloquea incluso altas retroactivas', () => {
    const baja = resolverFechaBaja();
    expect(baja).toBe('2026-09-30T23:59:59');
    expect(admiteReserva(baja, '2026-09-30', '10:00')).toBe(false);
  });

  it.each([
    '2026-09-29',
    '2026-02-30',
    '2026-13-01',
    '01/10/2026',
    '',
    '2026-10-01T00:00:00',
  ])('rechaza fecha invalida o pasada: %s', (fecha) => {
    expect(() => resolverFechaBaja(fecha)).toThrow();
  });

  it('acepta hoy y devuelve una fecha local sin conversion UTC', () => {
    expect(resolverFechaBaja('2026-09-30')).toBe('2026-09-30T00:00:00');
  });
});
