import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { TurnosService } from './turnos.service';
import { BeneficioFidelizacion, MedioPagoTurno, PaymentStatus, Turno, TurnoStatus } from './entities/turno.entity';

function crearTurno(overrides: Partial<Turno> = {}) {
  const servicio = {
    id_servicio: 1,
    nombre: 'Corte',
    precio: 100_000,
    precio_transferencia: 100_000,
    duracion: 30,
    monto_reserva: 0,
    imagenes: [],
  } as unknown as Servicio;
  return {
    id_turno: 1,
    fechaHora: new Date('2026-10-08T10:00:00-03:00'),
    estado: TurnoStatus.CONFIRMADO,
    paymentStatus: PaymentStatus.NO_REQUIERE,
    cliente: { id_cliente: 1, adulto: { id_usuario: 10 } } as Cliente,
    profesional: { id_profesional: 1, usuario: { id_usuario: 20, nombre: 'Nina' } } as Profesional,
    servicio,
    servicios_adicionales: [],
    fidelizacionBeneficio: BeneficioFidelizacion.NINGUNO,
    fidelizacionElegible: true,
    fidelizacionAcreditadoAt: new Date('2026-10-08T10:30:00-03:00'),
    ...overrides,
  } as Turno;
}

function crearService(options: {
  turno?: Turno;
  turnosResumen?: Turno[];
  profesional?: Partial<Profesional> | null;
} = {}) {
  const turno = options.turno || crearTurno();
  const turnoRepository = {
    findOne: jest.fn().mockResolvedValue(turno),
    find: jest.fn().mockImplementation(async ({ where }: any) => (options.turnosResumen || [])
      .filter((item) => item.profesional.id_profesional === where.profesional.id_profesional)
      .filter((item) => where.estado.value.includes(item.estado))),
    save: jest.fn(async (value: Turno) => value),
  };
  const profesionalRepository = {
    findOne: jest.fn().mockResolvedValue(options.profesional === null ? null : {
      id_profesional: 1,
      porcentaje_comision: 50,
      usuario: { nombre: 'Nina' },
      ...options.profesional,
    }),
  };
  const fidelizacionService = { acreditar: jest.fn().mockResolvedValue(true) };
  const service = new TurnosService(
    turnoRepository as any,
    null as any,
    profesionalRepository as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    { getIdByUsuario: jest.fn().mockResolvedValue(1) } as any,
    null as any,
    null as any,
    fidelizacionService as any,
  );
  return { service, turno, turnoRepository, profesionalRepository, fidelizacionService };
}

describe('registro de atencion e importe final', () => {
  it.each([
    [MedioPagoTurno.EFECTIVO, 120_000],
    [MedioPagoTurno.TRANSFERENCIA, 150_000],
  ])('calcula el total vigente para %s y acredita una sola vez', async (medioPago, esperado) => {
    const adicional = { precio: 20_000, precio_transferencia: 30_000, duracion: 10, monto_reserva: 0, imagenes: [] } as Servicio;
    const turno = crearTurno({
      servicio: { ...crearTurno().servicio, precio_transferencia: 120_000 } as Servicio,
      servicios_adicionales: [adicional],
    });
    const { service, fidelizacionService } = crearService({ turno });
    const result = await service.registrarAtencion(turno.id_turno, medioPago, { rol: 'ADMIN', sub: 1 });
    expect(turno.estado).toBe(TurnoStatus.ATENDIDO);
    expect(turno.importe_final).toBe(esperado);
    expect(result.importe_final).toBe(esperado);
    expect(fidelizacionService.acreditar).toHaveBeenCalledTimes(1);
  });

  it.each([
    [MedioPagoTurno.EFECTIVO, 70_000],
    [MedioPagoTurno.TRANSFERENCIA, 90_000],
  ])('aplica 50%% solo al servicio principal para %s', async (medioPago, esperado) => {
    const turno = crearTurno({
      servicio: { ...crearTurno().servicio, precio_transferencia: 120_000 } as Servicio,
      servicios_adicionales: [{ precio: 20_000, precio_transferencia: 30_000, duracion: 10, monto_reserva: 0, imagenes: [] } as Servicio],
      fidelizacionBeneficio: BeneficioFidelizacion.DESCUENTO_50,
    });
    const { service } = crearService({ turno });
    await service.registrarAtencion(turno.id_turno, medioPago, { rol: 'ADMIN', sub: 1 });
    expect(turno.importe_final).toBe(esperado);
  });

  it('registra el decimo corte gratis con importe final cero y sin medio de pago', async () => {
    const turno = crearTurno({ fidelizacionBeneficio: BeneficioFidelizacion.CORTE_GRATIS });
    const { service } = crearService({ turno });
    await service.registrarAtencion(turno.id_turno, undefined, { rol: 'ADMIN', sub: 1 });
    expect(turno.importe_final).toBe(0);
    expect(turno.medioPago).toBeNull();
  });

  it('conserva el importe final historico aunque cambie el precio del servicio', async () => {
    const turno = crearTurno();
    const { service } = crearService({ turno, turnosResumen: [turno] });
    await service.registrarAtencion(turno.id_turno, MedioPagoTurno.EFECTIVO, { rol: 'ADMIN', sub: 1 });
    turno.servicio.precio = 180_000;
    const resumen = await service.getResumenDiarioAdmin(1, '2026-10-08');
    expect(turno.importe_final).toBe(100_000);
    expect(resumen.total_dia).toBe(100_000);
  });

  it('marcar atendido no requiere ni modifica una acreditacion ya existente', async () => {
    const acreditadoAt = new Date('2026-10-08T10:01:00-03:00');
    const turno = crearTurno({ fidelizacionAcreditadoAt: acreditadoAt });
    const { service } = crearService({ turno });
    await service.registrarAtencion(turno.id_turno, MedioPagoTurno.EFECTIVO, { rol: 'ADMIN', sub: 1 });
    expect(turno.fidelizacionAcreditadoAt).toBe(acreditadoAt);
  });
});

describe('resumen y liquidacion diaria', () => {
  function turnoAtendido(id: number, importe: number, medioPago: MedioPagoTurno, profesionalId = 1) {
    return crearTurno({
      id_turno: id,
      estado: TurnoStatus.ATENDIDO,
      importe_final: importe,
      medioPago,
      profesional: { id_profesional: profesionalId, usuario: { nombre: `Prof ${profesionalId}` } } as Profesional,
    });
  }

  it.each([
    ['profesional entrega', 60_000, 40_000, 10_000, 'PROFESIONAL_ENTREGA'],
    ['administracion paga', 30_000, 70_000, -20_000, 'ADMINISTRACION_PAGA'],
    ['saldo exacto', 50_000, 50_000, 0, 'SALDADO'],
  ])('calcula correctamente cuando %s', async (_caso, efectivo, transferencia, saldo, sentido) => {
    const turnos = [
      turnoAtendido(1, efectivo, MedioPagoTurno.EFECTIVO),
      turnoAtendido(2, transferencia, MedioPagoTurno.TRANSFERENCIA),
    ];
    const { service } = crearService({ turnosResumen: turnos });
    const resumen = await service.getResumenDiarioAdmin(1, '2026-10-08');
    expect(resumen).toMatchObject({
      total_dia: 100_000,
      total_efectivo: efectivo,
      total_transferencia: transferencia,
      importe_profesional: 50_000,
      saldo,
      sentido,
    });
  });

  it('combina turnos normal, con 50% y gratis usando sus importes finales', async () => {
    const turnos = [
      turnoAtendido(1, 100_000, MedioPagoTurno.EFECTIVO),
      turnoAtendido(2, 50_000, MedioPagoTurno.TRANSFERENCIA),
      turnoAtendido(3, 0, MedioPagoTurno.EFECTIVO),
    ];
    const { service } = crearService({ turnosResumen: turnos });
    const resumen = await service.getResumenDiarioAdmin(1, '2026-10-08');
    expect(resumen.total_dia).toBe(150_000);
    expect(resumen.total_efectivo).toBe(100_000);
    expect(resumen.total_transferencia).toBe(50_000);
  });

  it('excluye reservas, turnos futuros y cancelados de los importes', async () => {
    const reservado = crearTurno({ id_turno: 1, estado: TurnoStatus.CONFIRMADO, paymentStatus: PaymentStatus.APROBADO, importe_final: null });
    const futuro = crearTurno({ id_turno: 2, estado: TurnoStatus.CONFIRMADO, fechaHora: new Date('2099-01-01T10:00:00-03:00') });
    const cancelado = crearTurno({ id_turno: 3, estado: TurnoStatus.CANCELADO, importe_final: 100_000, medioPago: MedioPagoTurno.EFECTIVO });
    const atendido = turnoAtendido(4, 80_000, MedioPagoTurno.EFECTIVO);
    const { service, turnoRepository } = crearService({ turnosResumen: [reservado, futuro, cancelado, atendido] });
    const resumen = await service.getResumenDiarioAdmin(1, '2026-10-08');
    expect(resumen.total_dia).toBe(80_000);
    expect(resumen.cantidad_turnos_sin_marcar).toBe(1);
    const filtroEstado = turnoRepository.find.mock.calls[0][0].where.estado.value;
    expect(filtroEstado).toEqual([TurnoStatus.CONFIRMADO, TurnoStatus.ATENDIDO]);
  });

  it('separa los turnos por profesional y resuelve dias sin turnos', async () => {
    const turnos = [
      turnoAtendido(1, 60_000, MedioPagoTurno.EFECTIVO, 1),
      turnoAtendido(2, 90_000, MedioPagoTurno.EFECTIVO, 2),
    ];
    const uno = crearService({ turnosResumen: turnos });
    const dos = crearService({ turnosResumen: turnos, profesional: { id_profesional: 2, usuario: { nombre: 'Prof 2' } as any } });
    const vacio = crearService({ turnosResumen: [] });
    expect((await uno.service.getResumenDiarioAdmin(1, '2026-10-08')).total_dia).toBe(60_000);
    expect((await dos.service.getResumenDiarioAdmin(2, '2026-10-08')).total_dia).toBe(90_000);
    expect(await vacio.service.getResumenDiarioAdmin(1, '2026-10-08')).toMatchObject({ total_dia: 0, saldo: 0, sentido: 'SALDADO' });
  });

  it('clasifica como pendiente administrativo un atendido sin medio de pago', async () => {
    const turno = turnoAtendido(1, 100_000, undefined as unknown as MedioPagoTurno);
    turno.medioPago = null;
    const { service } = crearService({ turnosResumen: [turno] });
    const resumen = await service.getResumenDiarioAdmin(1, '2026-10-08');
    expect(resumen.total_dia).toBe(100_000);
    expect(resumen.total_sin_clasificar).toBe(100_000);
    expect(resumen.cantidad_sin_clasificar).toBe(1);
  });

  it('consultar el resumen no modifica ni vuelve a acreditar fidelizacion', async () => {
    const turno = turnoAtendido(1, 100_000, MedioPagoTurno.EFECTIVO);
    const { service, fidelizacionService } = crearService({ turnosResumen: [turno] });
    const acreditadoAt = turno.fidelizacionAcreditadoAt;
    await service.getResumenDiarioAdmin(1, '2026-10-08');
    expect(turno.fidelizacionAcreditadoAt).toBe(acreditadoAt);
    expect(fidelizacionService.acreditar).not.toHaveBeenCalled();
  });
});
