import { ProfesionalesService } from './profesionales.service';
import { Profesional } from './entities/profesional.entity';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { TurnosService } from '../turnos/turnos.service';
import { ProfesionalesController } from './profesionales.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('Baja logica y acceso', () => {
  let profesional: any;
  let repository: any;
  let manager: any;
  let service: ProfesionalesService;
  let turnos: any[];
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-30T15:00:00Z'));
    profesional = {
      id_profesional: 7,
      baja_desde: null,
      usuario: { id_usuario: 9, nombre: 'Ana' },
      horarios: [{ dia: '4' }],
    };
    turnos = [
      {
        id_turno: 15,
        fechaHora: new Date('2026-10-02T10:00:00'),
        cliente: { nombre: 'Peque' },
        estado: 'CONFIRMADO',
        paymentStatus: 'APROBADO',
      },
    ];
    repository = {
      findOne: jest.fn(async () => ({ ...profesional })),
      find: jest.fn(async () => [{ ...profesional, profServicio: [] }]),
      update: jest.fn(async (_id, fields) =>
        Object.assign(profesional, fields),
      ),
    };
    const query: any = {};
    for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy'])
      query[key] = jest.fn(() => query);
    query.getMany = jest.fn(async () => turnos);
    manager = {
      getRepository: jest.fn((entity) =>
        entity === Profesional
          ? repository
          : { createQueryBuilder: () => query },
      ),
    };
    const dataSource: any = {
      manager,
      transaction: jest.fn((cb) => cb(manager)),
    };
    service = new ProfesionalesService(
      dataSource,
      repository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('conserva turnos, pagos, usuario y horarios; recalcula impacto al guardar', async () => {
    const originales = JSON.stringify(turnos);
    const result = await service.darBaja(7, '2026-10-01');
    expect(result.estado_actividad).toBe('BAJA_PROGRAMADA');
    expect(result.impacto.cantidad).toBe(1);
    expect(JSON.stringify(turnos)).toBe(originales);
    expect(profesional.usuario.nombre).toBe('Ana');
    expect(profesional.horarios).toHaveLength(1);
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(Object.keys(repository.update.mock.calls[0][1])).toEqual([
      'baja_desde',
    ]);
  });

  it('permite cambiar, cancelar y repetir una baja programada', async () => {
    await service.darBaja(7, '2026-10-01');
    await service.darBaja(7, '2026-10-02');
    expect((await service.darBaja(7, '2026-10-02')).baja_desde).toBe(
      '2026-10-02T00:00:00',
    );
    await service.reactivar(7);
    await service.reactivar(7);
    expect(profesional.baja_desde).toBeNull();
  });

  it('DELETE es inmediato e idempotente; exige reactivar para otra fecha', async () => {
    const first = await service.remove(7);
    jest.setSystemTime(new Date('2026-09-30T16:00:00Z'));
    expect((await service.remove(7)).baja_desde).toBe(first.baja_desde);
    await expect(service.darBaja(7, '2026-10-02')).rejects.toThrow('Reactiva');
    await expect(
      service.validarReserva(7, '2026-10-03', '10:00', manager),
    ).rejects.toThrow('baja');
  });

  it('oculta inactivas en listado publico pero conserva listado administrativo e historial', async () => {
    await service.remove(7);
    expect(await service.findAllWithServicios()).toEqual([]);
    expect(await service.findAllAdmin()).toEqual([
      expect.objectContaining({ nombre: 'Ana', estado_actividad: 'INACTIVA' }),
    ]);
  });

  it('rechaza login y JWT ya emitido al llegar la fecha; reactivar recupera acceso', async () => {
    await service.darBaja(7, '2026-10-01');
    const auth = new AuthService(
      service,
      {
        findOneBy: async () => ({ id_usuario: 9, rol: 'PROF', codigo: 123 }),
      } as any,
      { sign: () => 'token' } as any,
    );
    const strategy = new JwtStrategy(
      { get: () => 'test-secret' } as any,
      service,
    );
    const payload = { sub: 9, rol: 'PROF' };
    await expect(auth.login(12345678, 123)).resolves.toHaveProperty('token');
    await expect(strategy.validate(payload)).resolves.toEqual(payload);
    jest.setSystemTime(new Date('2026-10-01T03:00:00Z'));
    await expect(auth.login(12345678, 123)).rejects.toThrow('baja');
    await expect(strategy.validate(payload)).rejects.toThrow('baja');
    await expect(
      strategy.validate({ sub: 1, rol: 'ADMIN' }),
    ).resolves.toHaveProperty('rol', 'ADMIN');
    await service.reactivar(7);
    await expect(strategy.validate(payload)).resolves.toEqual(payload);
  });

  it('rechaza alta administrativa aunque fuerce horario y sobreturno', async () => {
    await service.remove(7);
    const turnosService = Object.create(TurnosService.prototype);
    turnosService.profesionalesService = service;
    await expect(
      turnosService.createTurnoAdmin({
        id_profesional: 7,
        fecha: '2026-10-02',
        hora: '10:00',
        forzar_fuera_horario: true,
        confirmar_sobreturno: true,
      }),
    ).rejects.toThrow('baja');
  });

  it('revalida dentro de la transaccion antes de guardar una reserva individual', async () => {
    await service.remove(7);
    const save = jest.fn();
    const turnosService = Object.create(TurnosService.prototype);
    Object.assign(turnosService, {
      profesionalesService: service,
      turnoRepository: { create: (value) => value },
      dataSource: {
        transaction: (cb) =>
          cb({
            getRepository: (entity) =>
              entity === Profesional ? repository : { save },
          }),
      },
    });
    await expect(
      turnosService.createTurnoBase({
        id_profesional: 7,
        fecha: '2026-10-02',
        hora: '10:00',
        bundle: { reservaTotal: 0 },
      }),
    ).rejects.toThrow('baja');
    expect(save).not.toHaveBeenCalled();
  });

  it('revalida reservas grupales si la baja ocurre despues de consultar disponibilidad', async () => {
    const save = jest.fn();
    const turnosService = Object.create(TurnosService.prototype);
    Object.assign(turnosService, {
      profesionalesService: service,
      getClientesOwned: async () => [{ id_cliente: 1 }, { id_cliente: 2 }],
      resolveServicioBundle: async () => ({
        reservaTotal: 0,
        duracionTotal: 30,
      }),
      getHorariosDisponibles: async () => ['10:00'],
      dataSource: {
        transaction: async (cb) => {
          await service.remove(7);
          return cb({
            getRepository: (entity) =>
              entity === Profesional ? repository : { save },
          });
        },
      },
    });
    await expect(
      turnosService.createGrupo(
        {
          id_profesional: 7,
          id_clientes: [1, 2],
          fecha: '2026-10-02',
          hora: '10:00',
        },
        {},
      ),
    ).rejects.toThrow('baja');
    expect(save).not.toHaveBeenCalled();
  });

  it('disponibilidad diaria y mensual excluyen fechas desde la baja', async () => {
    await service.darBaja(7, '2026-10-01');
    const turnosService = Object.create(TurnosService.prototype);
    Object.assign(turnosService, {
      profesionalesService: service,
      resolveServicioBundle: async () => ({ duracionTotal: 30 }),
      horarioRepository: { find: async () => [] },
      turnoRepository: { find: async () => [] },
      bloqueoRepository: { find: async () => [] },
      calcularHorariosDisponibles: () => ['10:00'],
    });
    await expect(
      turnosService.getHorariosDisponiblesCompletos(7, 1, '2026-10-01'),
    ).resolves.toEqual([]);
    await expect(
      turnosService.getHorariosDisponiblesCompletos(7, 1, '2026-09-30'),
    ).resolves.toEqual(['10:00']);
    await expect(
      turnosService.getDiasDisponibles(7, 1, '2026-09-30', '2026-10-02'),
    ).resolves.toEqual(['2026-09-30']);
  });

  it.each(['baja', 'impactoBaja', 'reactivar', 'remove'])(
    'protege %s con JWT y rol ADMIN',
    (method) => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        ProfesionalesController.prototype[method],
      );
      expect(guards).toContain(JwtAuthGuard);
      const guard: RolesGuard = guards.find((g) => g instanceof RolesGuard);
      for (const rol of ['USER', 'PROF']) {
        expect(() =>
          guard.canActivate({
            switchToHttp: () => ({ getRequest: () => ({ user: { rol } }) }),
          } as any),
        ).toThrow();
      }
      expect(
        guard.canActivate({
          switchToHttp: () => ({
            getRequest: () => ({ user: { rol: 'ADMIN' } }),
          }),
        } as any),
      ).toBe(true);
    },
  );
});
