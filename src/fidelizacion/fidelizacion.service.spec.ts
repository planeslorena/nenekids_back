import { Cliente } from 'src/clientes/entities/cliente.entity';
import { BeneficioFidelizacion, Turno, TurnoStatus } from 'src/turnos/entities/turno.entity';
import { CicloFidelizacion, EstadoCicloFidelizacion } from './entities/ciclo-fidelizacion.entity';
import { MovimientoFidelizacion } from './entities/movimiento-fidelizacion.entity';
import { FidelizacionService } from './fidelizacion.service';

describe('consulta de tarjeta de fidelizacion', () => {
  it('no permite consultar la tarjeta de otro adulto', async () => {
    const clientes = { findOne: async () => ({ id_cliente: 1, adulto: { id_usuario: 9 } }) };
    const service = new FidelizacionService(clientes as any, null as any, null as any, null as any, null as any);
    await expect(service.estado(1, { rol: 'USER', sub: 2 })).rejects.toThrow('otro nino');
  });

  it('separa cortes acreditados, reserva pendiente y ultimo beneficio aplicado', async () => {
    const ciclo = { id: 1, estado: EstadoCicloFidelizacion.ACTIVO, cantidadCortes: 4, fechaVencimiento: new Date(2099, 0, 1) };
    const pendiente = { id_turno: 15, fechaHora: new Date(2098, 0, 1), fidelizacionBeneficio: BeneficioFidelizacion.DESCUENTO_50, fidelizacionBeneficioAplicado: false, estado: TurnoStatus.CONFIRMADO };
    const beneficio = { id_turno: 3, fechaHora: new Date(2025, 0, 1), fidelizacionBeneficio: BeneficioFidelizacion.CORTE_GRATIS };
    const clientes = { findOne: async () => ({ id_cliente: 1, adulto: { id_usuario: 2 } }) };
    const turnos = { findOne: jest.fn().mockResolvedValueOnce(pendiente).mockResolvedValueOnce(beneficio) };
    const ciclos = { findOne: jest.fn().mockResolvedValue(ciclo) };
    const service = new FidelizacionService(clientes as any, turnos as any, ciclos as any, null as any, null as any);
    const estado = await service.estado(1, { rol: 'USER', sub: 2 });
    expect(estado.cortes).toBe(4);
    expect(estado.cortes_hasta_proximo_beneficio).toBe(1);
    expect(estado.siguiente_beneficio).toBe(BeneficioFidelizacion.DESCUENTO_50);
    expect(estado.turno_pendiente).toBe(15);
    expect(estado.detalle_turno_pendiente?.beneficio).toBe(BeneficioFidelizacion.DESCUENTO_50);
    expect(estado.ultimo_beneficio_aplicado?.beneficio).toBe(BeneficioFidelizacion.CORTE_GRATIS);
    const filtroPendiente = (turnos.findOne as jest.Mock).mock.calls[0][0].where;
    expect(filtroPendiente.fidelizacionPendienteClienteId).toBe(1);
    expect(filtroPendiente.estado.value).toEqual([
      TurnoStatus.PENDIENTE_PAGO,
      TurnoStatus.CONFIRMADO,
      TurnoStatus.ATENDIDO,
    ]);
  });

  it('indica cuantos cortes faltan para el gratis cuando se renuncio al 50%', async () => {
    const ciclo = { estado: EstadoCicloFidelizacion.ACTIVO, cantidadCortes: 6, renuncio50: true, fechaVencimiento: new Date(2099, 0, 1) };
    const service = new FidelizacionService(
      { findOne: async () => ({ id_cliente: 1, adulto: { id_usuario: 2 } }) } as any,
      { findOne: async () => null } as any,
      { findOne: async () => ciclo } as any,
      null as any, null as any,
    );
    const estado = await service.estado(1, { rol: 'USER', sub: 2 });
    expect(estado.cortes_hasta_proximo_beneficio).toBe(4);
    expect(estado.siguiente_beneficio).toBe(BeneficioFidelizacion.CORTE_GRATIS);
  });

  it('respeta la eleccion de seguir acumulando mientras el quinto corte esta reservado', async () => {
    const ciclo = { estado: EstadoCicloFidelizacion.ACTIVO, cantidadCortes: 4, renuncio50: false, fechaVencimiento: new Date(2099, 0, 1) };
    const pendiente = { id_turno: 15, fechaHora: new Date(2098, 0, 1), fidelizacionBeneficio: BeneficioFidelizacion.NINGUNO, estado: TurnoStatus.CONFIRMADO };
    const service = new FidelizacionService(
      { findOne: async () => ({ id_cliente: 1, adulto: { id_usuario: 2 } }) } as any,
      { findOne: jest.fn().mockResolvedValueOnce(pendiente).mockResolvedValueOnce(null) } as any,
      { findOne: async () => ciclo } as any,
      null as any, null as any,
    );
    const estado = await service.estado(1, { rol: 'USER', sub: 2 });
    expect(estado.cortes).toBe(4);
    expect(estado.siguiente_beneficio).toBe(BeneficioFidelizacion.CORTE_GRATIS);
    expect(estado.cortes_hasta_proximo_beneficio).toBe(6);
    expect(estado.proximo_beneficio).toBeNull();
  });
});

describe('acreditacion automatica de fidelizacion', () => {
  it('procesa turnos confirmados o atendidos cuya fecha y hora ya pasaron', async () => {
    const turnos = {
      find: jest.fn().mockResolvedValue([{ id_turno: 10 }, { id_turno: 11 }]),
    };
    const service = new FidelizacionService(null as any, turnos as any, null as any, null as any, null as any);
    const acreditar = jest.spyOn(service, 'acreditar').mockResolvedValue(true);

    await expect(service.acreditarPendientes()).resolves.toEqual({ procesados: 2 });
    expect(acreditar).toHaveBeenNthCalledWith(1, 10);
    expect(acreditar).toHaveBeenNthCalledWith(2, 11);
    const filtro = turnos.find.mock.calls[0][0].where;
    expect(filtro.estado.value).toEqual([TurnoStatus.CONFIRMADO, TurnoStatus.ATENDIDO]);
  });
});

describe('preparacion de reserva fidelizable', () => {
  it('limpia una marca pendiente residual de un turno cancelado antes de reservar', async () => {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === Cliente) return {
          createQueryBuilder: () => ({
            setLock() { return this; },
            where() { return this; },
            getOneOrFail: async () => ({ id_cliente: 1 }),
          }),
        };
        if (entity === Turno) return { update };
        return { findOne: async () => null };
      },
    };
    const service = new FidelizacionService(null as any, null as any, null as any, null as any, null as any);

    await expect(service.prepararReserva(1, true, undefined, manager as any)).resolves.toEqual({
      elegible: true,
      pendienteClienteId: 1,
      beneficio: BeneficioFidelizacion.NINGUNO,
    });
    expect(update).toHaveBeenCalledWith(
      { fidelizacionPendienteClienteId: 1, estado: TurnoStatus.CANCELADO },
      { fidelizacionPendienteClienteId: null, fidelizacionBeneficio: BeneficioFidelizacion.NINGUNO },
    );
  });
});

describe('cancelacion de cortes acreditados', () => {
  it('reabre con nueve cortes el ciclo cerrado por un decimo corte gratis cancelado', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turno = {
      id_turno: 10,
      cliente,
      estado: TurnoStatus.CANCELADO,
      fechaHora: new Date(2026, 9, 8, 10),
      fidelizacionElegible: true,
      fidelizacionAcreditadoAt: new Date(2026, 9, 8, 10, 30),
      fidelizacionBeneficio: BeneficioFidelizacion.CORTE_GRATIS,
      fidelizacionBeneficioAplicado: true,
      fidelizacionPendienteClienteId: null,
    } as Turno;
    const ciclo = {
      id: 4,
      cliente,
      cantidadCortes: 10,
      estado: EstadoCicloFidelizacion.CERRADO_GRATIS,
      fechaCierre: turno.fechaHora,
      renuncio50: true,
    } as CicloFidelizacion;
    const turnoRepo = { exists: jest.fn().mockResolvedValue(false) };
    const movimientoRepo = { findOne: jest.fn().mockResolvedValue({ ciclo }) };
    const saved: unknown[] = [];
    const manager = {
      getRepository: (entity: unknown) => entity === Turno ? turnoRepo : movimientoRepo,
      create: (entity: unknown, data: object) => Object.assign(Object.create((entity as Function).prototype), data),
      save: async (entity: unknown, value?: unknown) => { const item = value || entity; saved.push(item); return item; },
    };
    const dataSource = { transaction: async (callback: (manager: unknown) => Promise<unknown>) => callback(manager) };
    const service = new FidelizacionService(null as any, null as any, null as any, null as any, dataSource as any);

    await service.cancelar(turno, 20);

    expect(ciclo.cantidadCortes).toBe(9);
    expect(ciclo.estado).toBe(EstadoCicloFidelizacion.ACTIVO);
    expect(ciclo.fechaCierre).toBeNull();
    expect(ciclo.renuncio50).toBe(true);
    expect(turno.fidelizacionAcreditadoAt).toBeNull();
    expect(turno.fidelizacionBeneficioAplicado).toBe(false);
    expect(turno.fidelizacionBeneficio).toBe(BeneficioFidelizacion.NINGUNO);
    expect(saved).toContain(ciclo);
  });
});

describe('carga historica de fidelizacion', () => {
  it('acredita once cortes en dos ciclos sin atribuir beneficios antiguos y permite reintentar', async () => {
    const cliente = { id_cliente: 1 } as Cliente;
    const turnos = Array.from({ length: 11 }, (_, index) => ({
      id_turno: index + 1,
      cliente,
      fechaHora: new Date(2025, 0, index + 1, 10),
      estado: TurnoStatus.CONFIRMADO,
      fidelizacionElegible: true,
      fidelizacionAcreditadoAt: null,
      fidelizacionBeneficio: BeneficioFidelizacion.NINGUNO,
      fidelizacionBeneficioAplicado: false,
      fidelizacionPendienteClienteId: 1,
    } as Turno));
    const ciclos: CicloFidelizacion[] = [];
    const movimientos: MovimientoFidelizacion[] = [];
    let siguienteId = 1;
    let turnoActual: Turno;

    const turnoRepo = {
      createQueryBuilder: () => ({
        setLock() { return this; },
        leftJoinAndSelect() { return this; },
        where() { return this; },
        orderBy() { return this; },
        addOrderBy() { return this; },
        getOne: async () => turnoActual,
      }),
      save: async (turno: Turno) => turno,
    };
    const cicloRepo = {
      findOne: async () => ciclos.find((ciclo) => ciclo.estado === EstadoCicloFidelizacion.ACTIVO) || null,
    };
    const clienteRepo = {
      createQueryBuilder: () => ({
        setLock() { return this; },
        where() { return this; },
        getOneOrFail: async () => cliente,
      }),
    };
    const manager = {
      getRepository: (entity: unknown) => entity === Turno ? turnoRepo : entity === Cliente ? clienteRepo : cicloRepo,
      create: (entity: unknown, data: object) => Object.assign(Object.create((entity as Function).prototype), data),
      save: async (entity: unknown, value?: any) => {
        const instance = value || entity;
        if (instance instanceof CicloFidelizacion && !instance.id) {
          instance.id = siguienteId++;
          ciclos.push(instance);
        }
        if (instance instanceof MovimientoFidelizacion) movimientos.push(instance);
        return instance;
      },
    };
    const dataSource = { transaction: async (callback: (manager: unknown) => Promise<unknown>) => callback(manager) };
    const service = new FidelizacionService(null as any, null as any, null as any, null as any, dataSource as any);

    for (const turno of turnos) {
      turnoActual = turno;
      expect(await service.acreditar(turno.id_turno, true)).toBe(true);
    }
    turnoActual = turnos[10];
    expect(await service.acreditar(turnoActual.id_turno, true)).toBe(false);
    expect(ciclos.map((ciclo) => [ciclo.cantidadCortes, ciclo.estado])).toEqual([
      [10, EstadoCicloFidelizacion.CERRADO_SIN_BENEFICIO],
      [1, EstadoCicloFidelizacion.ACTIVO],
    ]);
    expect(turnos.every((turno) => !turno.fidelizacionBeneficioAplicado)).toBe(true);
    expect(movimientos).toHaveLength(11);
  });

  it('recupera un ciclo activo que ya tenia diez cortes antes del error', async () => {
    const cliente = { id_cliente: 2 } as Cliente;
    const ultimoCorte = { id_turno: 10, fechaHora: new Date(2025, 0, 10, 10) } as Turno;
    const turno = {
      id_turno: 11, cliente, fechaHora: new Date(2025, 0, 11, 10),
      estado: TurnoStatus.CONFIRMADO, fidelizacionElegible: true,
      fidelizacionAcreditadoAt: null, fidelizacionBeneficio: BeneficioFidelizacion.NINGUNO,
    } as Turno;
    const cicloViejo = {
      id: 1, cliente, fechaInicio: new Date(2025, 0, 1, 10),
      fechaVencimiento: new Date(2026, 0, 1, 10),
      cantidadCortes: 10, estado: EstadoCicloFidelizacion.ACTIVO,
    } as CicloFidelizacion;
    const ciclos = [cicloViejo];
    let consultaTurno = 0;
    const turnoRepo = {
      createQueryBuilder: () => ({
        setLock() { return this; }, leftJoinAndSelect() { return this; },
        where() { return this; }, orderBy() { return this; }, addOrderBy() { return this; },
        getOne: async () => ++consultaTurno === 1 ? turno : ultimoCorte,
      }),
      save: async (value: Turno) => value,
    };
    const manager = {
      getRepository: (entity: unknown) => entity === Turno ? turnoRepo : entity === Cliente ? {
        createQueryBuilder: () => ({ setLock() { return this; }, where() { return this; }, getOneOrFail: async () => cliente }),
      } : { findOne: async () => ciclos.find((ciclo) => ciclo.estado === EstadoCicloFidelizacion.ACTIVO) || null },
      create: (entity: unknown, data: object) => Object.assign(Object.create((entity as Function).prototype), data),
      save: async (entity: unknown, value?: any) => {
        const instance = value || entity;
        if (instance instanceof CicloFidelizacion && !instance.id) { instance.id = 2; ciclos.push(instance); }
        return instance;
      },
    };
    const dataSource = { transaction: async (callback: (manager: unknown) => Promise<unknown>) => callback(manager) };
    const service = new FidelizacionService(null as any, null as any, null as any, null as any, dataSource as any);

    expect(await service.acreditar(turno.id_turno, true)).toBe(true);
    expect(cicloViejo.estado).toBe(EstadoCicloFidelizacion.CERRADO_SIN_BENEFICIO);
    expect(cicloViejo.fechaCierre).toEqual(ultimoCorte.fechaHora);
    expect(ciclos[1].cantidadCortes).toBe(1);
    expect(ciclos[1].estado).toBe(EstadoCicloFidelizacion.ACTIVO);
  });
});
