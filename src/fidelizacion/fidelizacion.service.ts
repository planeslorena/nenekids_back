import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import dayjs, { nowArgentinaDateForDatabase } from 'src/common/date.util';
import { BeneficioFidelizacion, Turno, TurnoStatus } from 'src/turnos/entities/turno.entity';
import { DataSource, EntityManager, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { CicloFidelizacion, EstadoCicloFidelizacion } from './entities/ciclo-fidelizacion.entity';
import { MovimientoFidelizacion, TipoMovimientoFidelizacion } from './entities/movimiento-fidelizacion.entity';
import { cicloVencido, estadoAlDecimoCorte, resolverBeneficioReserva } from './fidelizacion.policy';

@Injectable()
export class FidelizacionService {
  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(Turno) private readonly turnos: Repository<Turno>,
    @InjectRepository(CicloFidelizacion) private readonly ciclos: Repository<CicloFidelizacion>,
    @InjectRepository(MovimientoFidelizacion) private readonly movimientos: Repository<MovimientoFidelizacion>,
    private readonly dataSource: DataSource,
  ) {}

  async prepararReserva(idCliente: number, fidelizable: boolean, usar50?: boolean, manager?: EntityManager) {
    if (!fidelizable) return { elegible: false, pendienteClienteId: null, beneficio: BeneficioFidelizacion.NINGUNO };
    if (manager) {
      await manager.getRepository(Cliente).createQueryBuilder('cliente').setLock('pessimistic_write')
        .where('cliente.id_cliente = :idCliente', { idCliente }).getOneOrFail();
    }
    const repo = (manager || this.dataSource.manager).getRepository(CicloFidelizacion);
    const ciclo = await repo.findOne({ where: { cliente: { id_cliente: idCliente }, estado: EstadoCicloFidelizacion.ACTIVO }, order: { fechaInicio: 'DESC' } });
    const cortes = ciclo?.cantidadCortes || 0;
    return {
      elegible: true,
      pendienteClienteId: idCliente,
      beneficio: resolverBeneficioReserva(cortes, usar50),
    };
  }

  async estado(idCliente: number, user: any) {
    const cliente = await this.clientes.findOne({ where: { id_cliente: idCliente }, relations: ['adulto'] });
    if (!cliente) throw new NotFoundException('Nino no encontrado');
    if (user.rol === 'USER' && cliente.adulto?.id_usuario !== user.sub) throw new ForbiddenException('No podes consultar la fidelizacion de otro nino');
    if (user.rol === 'PROF') {
      const autorizado = await this.turnos.createQueryBuilder('t').innerJoin('t.profesional', 'p').innerJoin('p.usuario', 'u')
        .where('t.id_cliente = :idCliente AND u.id_usuario = :userId', { idCliente, userId: user.sub }).getExists();
      if (!autorizado) throw new ForbiddenException('El nino no pertenece a tu agenda');
    }
    const ciclo = await this.ciclos.findOne({ where: { cliente: { id_cliente: idCliente }, estado: EstadoCicloFidelizacion.ACTIVO }, order: { fechaInicio: 'DESC' } });
    const ultimoCiclo = await this.ciclos.findOne({ where: { cliente: { id_cliente: idCliente } }, order: { fechaInicio: 'DESC', id: 'DESC' } });
    const pendiente = await this.turnos.findOne({ where: { fidelizacionPendienteClienteId: idCliente }, order: { fechaHora: 'ASC' } });
    const ultimoBeneficio = await this.turnos.findOne({
      where: { cliente: { id_cliente: idCliente }, estado: TurnoStatus.CONFIRMADO, fidelizacionBeneficioAplicado: true },
      order: { fechaHora: 'DESC', id_turno: 'DESC' },
    });
    const cicloVigente = ciclo && !cicloVencido(nowArgentinaDateForDatabase(), ciclo.fechaVencimiento) ? ciclo : null;
    const cortesVigentes = cicloVigente?.cantidadCortes || 0;
    const eligioSeguirAcumulando = cortesVigentes === 4 && pendiente?.fidelizacionBeneficio === BeneficioFidelizacion.NINGUNO;
    const haciaCorteGratis = Boolean(cicloVigente?.renuncio50) || cortesVigentes >= 5 || eligioSeguirAcumulando;
    return {
      id_cliente: idCliente,
      ciclo: cicloVigente || null,
      ultimo_ciclo: ultimoCiclo || null,
      cortes: cortesVigentes,
      siguiente_beneficio: haciaCorteGratis ? BeneficioFidelizacion.CORTE_GRATIS : BeneficioFidelizacion.DESCUENTO_50,
      cortes_hasta_proximo_beneficio: (haciaCorteGratis ? 10 : 5) - cortesVigentes,
      proximo_beneficio: cicloVigente?.cantidadCortes === 4 && !eligioSeguirAcumulando ? 'ELECCION_50' : cicloVigente?.cantidadCortes === 9 ? 'CORTE_GRATIS' : null,
      turno_pendiente: pendiente?.id_turno || null,
      detalle_turno_pendiente: pendiente ? { id_turno: pendiente.id_turno, fechaHora: pendiente.fechaHora, beneficio: pendiente.fidelizacionBeneficio, aplicado: pendiente.fidelizacionBeneficioAplicado, estado: pendiente.estado } : null,
      ultimo_beneficio_aplicado: ultimoBeneficio ? { id_turno: ultimoBeneficio.id_turno, fechaHora: ultimoBeneficio.fechaHora, beneficio: ultimoBeneficio.fidelizacionBeneficio } : null,
    };
  }

  @Cron('*/30 * * * *')
  async acreditarPendientes() {
    const ids = (await this.turnos.find({
      select: { id_turno: true },
      where: { estado: TurnoStatus.CONFIRMADO, fidelizacionElegible: true, fidelizacionAcreditadoAt: IsNull(), fechaHora: LessThanOrEqual(nowArgentinaDateForDatabase()) },
      order: { fechaHora: 'ASC', id_turno: 'ASC' }, take: 200,
    })).map((t) => t.id_turno);
    for (const id of ids) await this.acreditar(id);
    return { procesados: ids.length };
  }

  async acreditar(idTurno: number, cargaHistorica = false) {
    return this.dataSource.transaction(async (manager) => {
      const turnoRepo = manager.getRepository(Turno);
      const turno = await turnoRepo.createQueryBuilder('t').setLock('pessimistic_write').leftJoinAndSelect('t.cliente', 'cliente')
        .where('t.id_turno = :id', { id: idTurno }).getOne();
      if (!turno || turno.fidelizacionAcreditadoAt || !turno.fidelizacionElegible || turno.estado !== TurnoStatus.CONFIRMADO || dayjs(turno.fechaHora).isAfter(dayjs())) return false;
      await manager.getRepository(Cliente).createQueryBuilder('cliente').setLock('pessimistic_write')
        .where('cliente.id_cliente = :idCliente', { idCliente: turno.cliente.id_cliente }).getOneOrFail();
      let ciclo = await manager.getRepository(CicloFidelizacion).findOne({ where: { cliente: { id_cliente: turno.cliente.id_cliente }, estado: EstadoCicloFidelizacion.ACTIVO }, order: { fechaInicio: 'DESC' } });
      if (ciclo?.cantidadCortes === 10) {
        const ultimoCorte = await turnoRepo.createQueryBuilder('anterior')
          .where('anterior.id_cliente = :idCliente AND anterior.fidelizacion_acreditado_at IS NOT NULL', { idCliente: turno.cliente.id_cliente })
          .orderBy('anterior.fechaHora', 'DESC').addOrderBy('anterior.id_turno', 'DESC').getOne();
        ciclo.estado = EstadoCicloFidelizacion.CERRADO_SIN_BENEFICIO;
        ciclo.fechaCierre = ultimoCorte?.fechaHora || ciclo.fechaInicio;
        await manager.save(ciclo);
      }
      if (ciclo?.estado === EstadoCicloFidelizacion.ACTIVO && cicloVencido(turno.fechaHora, ciclo.fechaVencimiento)) {
        ciclo.estado = EstadoCicloFidelizacion.VENCIDO; ciclo.fechaCierre = ciclo.fechaVencimiento;
        await manager.save(ciclo);
      }
      if (!ciclo || ciclo.estado !== EstadoCicloFidelizacion.ACTIVO) {
        ciclo = manager.create(CicloFidelizacion, { cliente: turno.cliente, fechaInicio: turno.fechaHora, fechaVencimiento: dayjs(turno.fechaHora).add(1, 'year').toDate(), cantidadCortes: 0, estado: EstadoCicloFidelizacion.ACTIVO, renuncio50: false });
      }
      ciclo.cantidadCortes += 1;
      if (ciclo.cantidadCortes > 10) throw new ConflictException('Un ciclo no puede superar diez cortes');
      if (!cargaHistorica && ciclo.cantidadCortes === 5) {
        if (turno.fidelizacionBeneficio === BeneficioFidelizacion.DESCUENTO_50) { turno.fidelizacionBeneficioAplicado = true; ciclo.estado = EstadoCicloFidelizacion.CERRADO_50; ciclo.fechaCierre = turno.fechaHora; }
        else ciclo.renuncio50 = true;
      }
      if (ciclo.cantidadCortes === 10) {
        ciclo.estado = estadoAlDecimoCorte(turno.fidelizacionBeneficio, cargaHistorica);
        ciclo.fechaCierre = turno.fechaHora;
        turno.fidelizacionBeneficioAplicado = ciclo.estado === EstadoCicloFidelizacion.CERRADO_GRATIS;
      }
      ciclo = await manager.save(ciclo);
      turno.fidelizacionAcreditadoAt = nowArgentinaDateForDatabase(); turno.fidelizacionPendienteClienteId = null;
      await turnoRepo.save(turno);
      await manager.save(MovimientoFidelizacion, manager.create(MovimientoFidelizacion, { cliente: turno.cliente, ciclo, turno, tipo: cargaHistorica ? TipoMovimientoFidelizacion.CARGA_HISTORICA : TipoMovimientoFidelizacion.ACREDITACION }));
      if (turno.fidelizacionBeneficioAplicado) await manager.save(MovimientoFidelizacion, manager.create(MovimientoFidelizacion, { cliente: turno.cliente, ciclo, turno, tipo: TipoMovimientoFidelizacion.BENEFICIO_APLICADO, detalle: turno.fidelizacionBeneficio }));
      return true;
    });
  }

  async cancelar(turno: Turno, actorId?: number) {
    if (!turno.fidelizacionElegible) return;
    turno.fidelizacionPendienteClienteId = null;
    if (!turno.fidelizacionAcreditadoAt) {
      turno.fidelizacionBeneficio = BeneficioFidelizacion.NINGUNO;
      await this.turnos.save(turno);
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.save(turno);
      await manager.save(MovimientoFidelizacion, manager.create(MovimientoFidelizacion, { cliente: turno.cliente, turno, tipo: TipoMovimientoFidelizacion.REVERSA, actorId, detalle: 'Cancelacion de corte acreditado; ciclos reconstruidos' }));
      await this.reconstruir(turno.cliente.id_cliente, manager);
    });
  }

  private async reconstruir(idCliente: number, manager: EntityManager) {
    const turnos = await manager.getRepository(Turno).find({ where: { cliente: { id_cliente: idCliente }, estado: TurnoStatus.CONFIRMADO, fidelizacionElegible: true }, order: { fechaHora: 'ASC', id_turno: 'ASC' }, relations: ['cliente'] });
    await manager.getRepository(MovimientoFidelizacion).createQueryBuilder().delete().where('id_cliente = :id AND tipo != :reversa', { id: idCliente, reversa: TipoMovimientoFidelizacion.REVERSA }).execute();
    await manager.getRepository(CicloFidelizacion).createQueryBuilder().delete().where('id_cliente = :id', { id: idCliente }).execute();
    await manager.getRepository(Turno).createQueryBuilder().update().set({ fidelizacionAcreditadoAt: null, fidelizacionBeneficioAplicado: false }).where('id_cliente = :id', { id: idCliente }).execute();
    for (const turno of turnos) if (!dayjs(turno.fechaHora).isAfter(dayjs())) await this.acreditarReconstruccion(turno, manager);
  }

  private async acreditarReconstruccion(turno: Turno, manager: EntityManager) {
    let ciclo = await manager.getRepository(CicloFidelizacion).findOne({ where: { cliente: { id_cliente: turno.cliente.id_cliente }, estado: EstadoCicloFidelizacion.ACTIVO }, order: { fechaInicio: 'DESC' } });
    if (!ciclo || cicloVencido(turno.fechaHora, ciclo.fechaVencimiento)) ciclo = manager.create(CicloFidelizacion, { cliente: turno.cliente, fechaInicio: turno.fechaHora, fechaVencimiento: dayjs(turno.fechaHora).add(1, 'year').toDate(), cantidadCortes: 0, estado: EstadoCicloFidelizacion.ACTIVO });
    ciclo.cantidadCortes += 1;
    if (ciclo.cantidadCortes === 5 && turno.fidelizacionBeneficio === BeneficioFidelizacion.DESCUENTO_50) { turno.fidelizacionBeneficioAplicado = true; ciclo.estado = EstadoCicloFidelizacion.CERRADO_50; ciclo.fechaCierre = turno.fechaHora; }
    else if (ciclo.cantidadCortes === 5) ciclo.renuncio50 = true;
    if (ciclo.cantidadCortes === 10) {
      ciclo.estado = estadoAlDecimoCorte(turno.fidelizacionBeneficio, false);
      ciclo.fechaCierre = turno.fechaHora;
      turno.fidelizacionBeneficioAplicado = ciclo.estado === EstadoCicloFidelizacion.CERRADO_GRATIS;
    }
    ciclo = await manager.save(ciclo); turno.fidelizacionAcreditadoAt = nowArgentinaDateForDatabase(); await manager.save(turno);
    await manager.save(MovimientoFidelizacion, manager.create(MovimientoFidelizacion, { cliente: turno.cliente, ciclo, turno, tipo: TipoMovimientoFidelizacion.REASIGNACION }));
  }

  async cargarHistorico() {
    const turnos = await this.turnos.createQueryBuilder('t').innerJoinAndSelect('t.cliente', 'cliente').innerJoin('t.servicio', 'servicio')
      .where('t.estado = :estado AND t.fechaHora <= :ahora AND t.fidelizacion_acreditado_at IS NULL AND servicio.fidelizable = true', { estado: TurnoStatus.CONFIRMADO, ahora: nowArgentinaDateForDatabase() })
      .orderBy('t.fechaHora', 'ASC').addOrderBy('t.id_turno', 'ASC').getMany();
    let acreditados = 0;
    for (const turno of turnos) { await this.turnos.update(turno.id_turno, { fidelizacionElegible: true }); if (await this.acreditar(turno.id_turno, true)) acreditados++; }
    return { encontrados: turnos.length, acreditados };
  }
}
