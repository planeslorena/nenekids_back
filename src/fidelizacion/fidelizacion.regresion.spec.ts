import { Cliente } from 'src/clientes/entities/cliente.entity';
import { BeneficioFidelizacion, Turno, TurnoStatus } from 'src/turnos/entities/turno.entity';
import { CicloFidelizacion, EstadoCicloFidelizacion } from './entities/ciclo-fidelizacion.entity';
import { MovimientoFidelizacion, TipoMovimientoFidelizacion } from './entities/movimiento-fidelizacion.entity';
import { resolverBeneficioReserva } from './fidelizacion.policy';
import { FidelizacionService } from './fidelizacion.service';

type Harness = ReturnType<typeof crearHarness>;

function crearTurno(id: number, cliente: Cliente, overrides: Partial<Turno> = {}) {
  return {
    id_turno: id,
    cliente,
    fechaHora: new Date(2026, 0, id, 10),
    estado: TurnoStatus.CONFIRMADO,
    fidelizacionElegible: true,
    fidelizacionAcreditadoAt: null,
    fidelizacionBeneficio: BeneficioFidelizacion.NINGUNO,
    fidelizacionBeneficioAplicado: false,
    fidelizacionPendienteClienteId: cliente.id_cliente,
    ...overrides,
  } as Turno;
}

function crearHarness(turnosIniciales: Turno[]) {
  const turnos = [...turnosIniciales];
  const ciclos: CicloFidelizacion[] = [];
  const movimientos: MovimientoFidelizacion[] = [];
  let siguienteCicloId = 1;
  let idConsultado = 0;

  const turnoRepo = {
    createQueryBuilder: () => ({
      setLock() { return this; },
      leftJoinAndSelect() { return this; },
      where(_sql: string, params: { id?: number }) { if (params?.id) idConsultado = params.id; return this; },
      orderBy() { return this; },
      addOrderBy() { return this; },
      getOne: async () => turnos.find((turno) => turno.id_turno === idConsultado) || null,
    }),
    find: jest.fn(async () => turnos
      .filter((turno) => [TurnoStatus.CONFIRMADO, TurnoStatus.ATENDIDO].includes(turno.estado))
      .filter((turno) => turno.fidelizacionElegible && !turno.fidelizacionAcreditadoAt)
      .filter((turno) => turno.fechaHora <= new Date())
      .map((turno) => ({ id_turno: turno.id_turno }))),
    exists: jest.fn(async ({ where }: any) => turnos.some((otro) =>
      otro.cliente.id_cliente === where.cliente.id_cliente
      && otro.fechaHora > where.fechaHora.value
      && Boolean(otro.fidelizacionAcreditadoAt)
      && [TurnoStatus.CONFIRMADO, TurnoStatus.ATENDIDO].includes(otro.estado))),
    save: async (turno: Turno) => turno,
  };
  const cicloRepo = {
    findOne: async ({ where }: any) => ciclos.find((ciclo) =>
      ciclo.cliente.id_cliente === where.cliente.id_cliente
      && ciclo.estado === where.estado) || null,
  };
  const clienteRepo = {
    createQueryBuilder: () => ({
      setLock() { return this; },
      where() { return this; },
      getOneOrFail: async () => turnos[0]?.cliente,
    }),
  };
  const movimientoRepo = {
    findOne: async ({ where }: any) => [...movimientos].reverse().find((movimiento) =>
      movimiento.turno?.id_turno === where.turno.id_turno
      && where.tipo.value.includes(movimiento.tipo)) || null,
  };
  const manager = {
    getRepository: (entity: unknown) => entity === Turno
      ? turnoRepo
      : entity === Cliente
        ? clienteRepo
        : entity === CicloFidelizacion
          ? cicloRepo
          : movimientoRepo,
    create: (entity: unknown, data: object) => Object.assign(Object.create((entity as Function).prototype), data),
    save: async (entity: unknown, value?: any) => {
      const instance = value || entity;
      if (instance instanceof CicloFidelizacion && !instance.id) {
        instance.id = siguienteCicloId++;
        ciclos.push(instance);
      }
      if (instance instanceof MovimientoFidelizacion) movimientos.push(instance);
      return instance;
    },
  };
  const dataSource = { transaction: async (callback: (manager: unknown) => Promise<unknown>) => callback(manager) };
  const service = new FidelizacionService(null as any, turnoRepo as any, null as any, null as any, dataSource as any);
  return { service, turnos, ciclos, movimientos, turnoRepo };
}

async function acreditarTodos(harness: Harness, turnos: Turno[]) {
  for (const turno of turnos) expect(await harness.service.acreditar(turno.id_turno)).toBe(true);
}

describe('regresion de acreditacion e idempotencia', () => {
  it.each([
    ['futuro', { fechaHora: new Date('2099-01-01T10:00:00-03:00') }],
    ['cancelado', { estado: TurnoStatus.CANCELADO }],
    ['servicio no fidelizable', { fidelizacionElegible: false }],
  ])('no acredita un turno %s', async (_caso, overrides) => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = crearTurno(1, cliente, overrides as Partial<Turno>);
    const harness = crearHarness([turno]);
    expect(await harness.service.acreditar(turno.id_turno)).toBe(false);
    expect(harness.ciclos).toHaveLength(0);
  });

  it('acredita una sola vez aunque se invoque dos veces', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = crearTurno(1, cliente);
    const harness = crearHarness([turno]);
    expect(await harness.service.acreditar(1)).toBe(true);
    expect(await harness.service.acreditar(1)).toBe(false);
    expect(harness.ciclos[0].cantidadCortes).toBe(1);
    expect(harness.movimientos.filter((movimiento) => movimiento.tipo === TipoMovimientoFidelizacion.ACREDITACION)).toHaveLength(1);
  });

  it('dos ejecuciones del cron mantienen una sola acreditacion', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = crearTurno(1, cliente);
    const harness = crearHarness([turno]);
    expect(await harness.service.acreditarPendientes()).toEqual({ procesados: 1 });
    expect(await harness.service.acreditarPendientes()).toEqual({ procesados: 0 });
    expect(harness.ciclos[0].cantidadCortes).toBe(1);
  });

  it.each([
    ['cron antes de ATENDIDO', TurnoStatus.CONFIRMADO],
    ['ATENDIDO antes del cron', TurnoStatus.ATENDIDO],
  ])('%s no duplica el corte', async (_caso, estadoInicial) => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = crearTurno(1, cliente, { estado: estadoInicial });
    const harness = crearHarness([turno]);
    expect(await harness.service.acreditar(1)).toBe(true);
    turno.estado = TurnoStatus.ATENDIDO;
    expect(await harness.service.acreditar(1)).toBe(false);
    expect(await harness.service.acreditarPendientes()).toEqual({ procesados: 0 });
    expect(harness.ciclos[0].cantidadCortes).toBe(1);
  });

  it('acredita sin depender de medio de pago ni importe final', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = crearTurno(1, cliente, { medioPago: null, importe_final: null });
    const harness = crearHarness([turno]);
    expect(await harness.service.acreditar(1)).toBe(true);
    expect(harness.ciclos[0].cantidadCortes).toBe(1);
  });
});

describe('regresion de quinto y decimo corte', () => {
  it('aplica 50% en el quinto, revierte al cancelar y permite aplicar nuevamente el quinto', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turnos = Array.from({ length: 4 }, (_, index) => crearTurno(index + 1, cliente));
    const quinto = crearTurno(5, cliente, { fidelizacionBeneficio: resolverBeneficioReserva(4, true) });
    const reemplazo = crearTurno(6, cliente, { fidelizacionBeneficio: BeneficioFidelizacion.DESCUENTO_50 });
    const harness = crearHarness([...turnos, quinto, reemplazo]);

    await acreditarTodos(harness, [...turnos, quinto]);
    expect(harness.ciclos[0]).toMatchObject({ cantidadCortes: 5, estado: EstadoCicloFidelizacion.CERRADO_50 });
    expect(quinto.fidelizacionBeneficioAplicado).toBe(true);

    quinto.estado = TurnoStatus.CANCELADO;
    await harness.service.cancelar(quinto, 20);
    expect(harness.ciclos[0]).toMatchObject({ cantidadCortes: 4, estado: EstadoCicloFidelizacion.ACTIVO, renuncio50: false });

    expect(await harness.service.acreditar(reemplazo.id_turno)).toBe(true);
    expect(harness.ciclos[0]).toMatchObject({ cantidadCortes: 5, estado: EstadoCicloFidelizacion.CERRADO_50 });
    expect(reemplazo.fidelizacionBeneficioAplicado).toBe(true);
  });

  it('continua despues del quinto, aplica el decimo gratis y lo revierte a nueve al cancelar', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turnos = Array.from({ length: 9 }, (_, index) => crearTurno(index + 1, cliente));
    turnos[4].fidelizacionBeneficio = resolverBeneficioReserva(4, false);
    const decimo = crearTurno(10, cliente, { fidelizacionBeneficio: resolverBeneficioReserva(9) });
    const reemplazo = crearTurno(11, cliente, { fidelizacionBeneficio: BeneficioFidelizacion.CORTE_GRATIS });
    const harness = crearHarness([...turnos, decimo, reemplazo]);

    await acreditarTodos(harness, turnos);
    expect(harness.ciclos[0]).toMatchObject({ cantidadCortes: 9, estado: EstadoCicloFidelizacion.ACTIVO, renuncio50: true });
    expect(await harness.service.acreditar(decimo.id_turno)).toBe(true);
    expect(harness.ciclos[0]).toMatchObject({ cantidadCortes: 10, estado: EstadoCicloFidelizacion.CERRADO_GRATIS });
    expect(decimo.fidelizacionBeneficioAplicado).toBe(true);

    decimo.estado = TurnoStatus.CANCELADO;
    await harness.service.cancelar(decimo, 20);
    expect(harness.ciclos[0]).toMatchObject({ cantidadCortes: 9, estado: EstadoCicloFidelizacion.ACTIVO, renuncio50: true });
    expect(await harness.service.acreditar(reemplazo.id_turno)).toBe(true);
    expect(harness.ciclos[0]).toMatchObject({ cantidadCortes: 10, estado: EstadoCicloFidelizacion.CERRADO_GRATIS });
  });
});

describe('regresion de cancelacion', () => {
  it('cancelar dos veces un turno acreditado revoca exactamente un corte', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = crearTurno(1, cliente);
    const harness = crearHarness([turno]);
    await harness.service.acreditar(turno.id_turno);
    turno.estado = TurnoStatus.CANCELADO;
    await harness.service.cancelar(turno, 20);
    await harness.service.cancelar(turno, 20);
    expect(harness.ciclos[0].cantidadCortes).toBe(0);
    expect(harness.movimientos.filter((movimiento) => movimiento.tipo === TipoMovimientoFidelizacion.REVERSA)).toHaveLength(1);
  });

  it('permite revocar la acreditacion de un turno que habia sido marcado ATENDIDO', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = crearTurno(1, cliente, { estado: TurnoStatus.ATENDIDO });
    const harness = crearHarness([turno]);
    await harness.service.acreditar(turno.id_turno);
    turno.estado = TurnoStatus.CANCELADO;
    await harness.service.cancelar(turno, 20);
    expect(harness.ciclos[0].cantidadCortes).toBe(0);
    expect(turno.fidelizacionAcreditadoAt).toBeNull();
  });

  it('cancelar un turno no acreditado no resta cortes y repetir la cancelacion es idempotente', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const acreditado = crearTurno(1, cliente);
    const pendiente = crearTurno(2, cliente, { fechaHora: new Date('2099-01-02T10:00:00-03:00') });
    const harness = crearHarness([acreditado, pendiente]);
    await harness.service.acreditar(acreditado.id_turno);
    pendiente.estado = TurnoStatus.CANCELADO;
    await harness.service.cancelar(pendiente, 20);
    await harness.service.cancelar(pendiente, 20);
    expect(harness.ciclos[0].cantidadCortes).toBe(1);
  });

  it('revoca solamente el ciclo del niño cancelado', async () => {
    const clienteA = { id_cliente: 1 } as Cliente;
    const clienteB = { id_cliente: 2 } as Cliente;
    const turnoA = crearTurno(1, clienteA);
    const turnoB = crearTurno(2, clienteB);
    const harness = crearHarness([turnoA, turnoB]);
    await harness.service.acreditar(turnoA.id_turno);
    await harness.service.acreditar(turnoB.id_turno);
    turnoA.estado = TurnoStatus.CANCELADO;
    await harness.service.cancelar(turnoA, 20);
    const cicloA = harness.ciclos.find((ciclo) => ciclo.cliente.id_cliente === 1)!;
    const cicloB = harness.ciclos.find((ciclo) => ciclo.cliente.id_cliente === 2)!;
    expect(cicloA.cantidadCortes).toBe(0);
    expect(cicloB.cantidadCortes).toBe(1);
  });
});
