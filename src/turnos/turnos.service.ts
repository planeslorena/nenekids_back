import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Bloqueo, TipoBloqueo } from 'src/bloqueos/entities/bloqueo.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import dayjs, { formatLocalDateTime, nowArgentinaDateForDatabase } from 'src/common/date.util';
import { PagosService } from 'src/pagos/pagos.service';
import { HorarioDestacado } from 'src/profesionales/entities/horario-destacado.entity';
import { Horario } from 'src/profesionales/entities/horario.entity';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { ProfesionalesService } from 'src/profesionales/profesionales.service';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { Between, DataSource, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { CreateAdminTurnoDto } from './dto/create-admin-turno.dto';
import { CreateGrupoTurnoDto } from './dto/create-grupo-turno.dto';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { ConfiguracionDisponibilidad } from './entities/configuracion-disponibilidad.entity';
import { PaymentStatus, Turno, TurnoStatus } from './entities/turno.entity';
import { randomUUID } from 'crypto';

type ServicioBundle = {
  principal: Servicio;
  adicionales: Servicio[];
  servicios: Servicio[];
  duracionTotal: number;
  precioTotal: number;
  reservaTotal: number;
};

type EstadoDevolucionReserva = 'pendientes' | 'devueltos' | 'sin_devolucion' | 'todos';

@Injectable()
export class TurnosService {
  constructor(
    @InjectRepository(Turno)
    private readonly turnoRepository: Repository<Turno>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Profesional)
    private readonly profesionalRepository: Repository<Profesional>,
    @InjectRepository(Servicio)
    private readonly servicioRepository: Repository<Servicio>,
    @InjectRepository(Horario)
    private readonly horarioRepository: Repository<Horario>,
    @InjectRepository(HorarioDestacado)
    private readonly horarioDestacadoRepository: Repository<HorarioDestacado>,
    @InjectRepository(Bloqueo)
    private readonly bloqueoRepository: Repository<Bloqueo>,
    @InjectRepository(ConfiguracionDisponibilidad)
    private readonly configuracionDisponibilidadRepository: Repository<ConfiguracionDisponibilidad>,
    private readonly pagosService: PagosService,
    private readonly profesionalesService: ProfesionalesService,
    private readonly whatsappService: WhatsappService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateTurnoDto, user: any) {
    const cliente = await this.getClienteOwned(dto.id_cliente, user);
    const bundle = await this.resolveServicioBundle(dto.id_servicio, dto.ids_servicios_adicionales, {
      portalFamiliar: true,
      idProfesional: dto.id_profesional,
    });

    const disponibles = await this.getHorariosDisponibles(
      dto.id_profesional,
      dto.id_servicio,
      dto.fecha,
      1,
      dto.ids_servicios_adicionales,
    );
    if (!disponibles.includes(dto.hora)) {
      throw new BadRequestException('El horario seleccionado no esta disponible');
    }

    return this.createTurnoBase({
      cliente,
      id_profesional: dto.id_profesional,
      bundle,
      fecha: dto.fecha,
      hora: dto.hora,
      observaciones: dto.observaciones,
      reservaPagada: false,
      crearPago: true,
    });
  }

  async createGrupo(dto: CreateGrupoTurnoDto, user: any) {
    const cantidad = dto.id_clientes.length;
    const clientes = await this.getClientesOwned(dto.id_clientes, user);
    const bundle = await this.resolveServicioBundle(dto.id_servicio, dto.ids_servicios_adicionales, {
      portalFamiliar: true,
      idProfesional: dto.id_profesional,
    });

    const disponibles = await this.getHorariosDisponibles(
      dto.id_profesional,
      dto.id_servicio,
      dto.fecha,
      cantidad,
      dto.ids_servicios_adicionales,
    );
    if (!disponibles.includes(dto.hora)) {
      throw new BadRequestException('El bloque horario seleccionado no esta disponible');
    }

    const requierePago = bundle.reservaTotal > 0;
    const externalReference = `grupo:${randomUUID()}`;
    const horaInicial = this.toMinutes(dto.hora);

    const turnosGuardados = await this.dataSource.transaction(async (manager) => {
      const turnoRepository = manager.getRepository(Turno);
      const turnos = clientes.map((cliente, index) => {
        const hora = this.toTime(horaInicial + bundle.duracionTotal * index);
        return turnoRepository.create({
          dia: dto.fecha,
          hora,
          fechaHora: dayjs(`${dto.fecha} ${hora}`).toDate(),
          observaciones: dto.observaciones || null,
          estado: requierePago ? TurnoStatus.PENDIENTE_PAGO : TurnoStatus.CONFIRMADO,
          paymentStatus: requierePago ? PaymentStatus.PENDIENTE : PaymentStatus.NO_REQUIERE,
          paymentAmount: requierePago ? bundle.reservaTotal : null,
          precio_total: bundle.precioTotal,
          monto_reserva_total: bundle.reservaTotal,
          duracion_total: bundle.duracionTotal,
          paymentExpiresAt: requierePago ? dayjs().add(15, 'minute').toDate() : null,
          externalReference,
          cliente,
          profesional: { id_profesional: dto.id_profesional } as Profesional,
          servicio: bundle.principal,
          servicios_adicionales: bundle.adicionales,
        });
      });

      return turnoRepository.save(turnos);
    });

    if (!requierePago) {
      turnosGuardados.forEach((turno) => void this.whatsappService.sendTurnoConfirmation(turno.id_turno));
      return { turnos: turnosGuardados.map((turno) => this.serializeTurno(turno)), pago: null };
    }

    const preferencia = await this.pagosService.crearPreferenciaGrupo(turnosGuardados, bundle.principal, externalReference);
    const checkoutUrl = this.pagosService.getCheckoutUrl(preferencia);
    const turnosConPago = await this.turnoRepository.save(turnosGuardados.map((turno) => ({
      ...turno,
      mercadoPagoPreferenceId: preferencia.id,
      mercadoPagoInitPoint: checkoutUrl,
    })));

    return {
      turnos: turnosConPago.map((turno) => this.serializeTurno(turno)),
      pago: {
        preferenceId: preferencia.id,
        initPoint: checkoutUrl,
        sandboxInitPoint: preferencia.sandbox_init_point,
      },
    };
  }

  async createTurnoAdmin(dto: CreateAdminTurnoDto) {
    const cliente = await this.clienteRepository.findOne({
      where: { id_cliente: dto.id_cliente },
      relations: ['adulto'],
    });
    if (!cliente) throw new NotFoundException('Nino no encontrado');

    const bundle = await this.resolveServicioBundle(dto.id_servicio, dto.ids_servicios_adicionales, {
      idProfesional: dto.id_profesional,
    });
    const dentroHorario = await this.isDentroHorario(dto.id_profesional, dto.fecha, dto.hora, bundle.duracionTotal);

    if (!dentroHorario && !dto.forzar_fuera_horario) {
      throw new BadRequestException('El turno esta fuera del horario laboral');
    }

    await this.validarSolapamiento({
      id_profesional: dto.id_profesional,
      id_servicio: dto.id_servicio,
      ids_servicios_adicionales: dto.ids_servicios_adicionales,
      fecha: dto.fecha,
      hora: dto.hora,
      permitirSobreturno: Boolean(dto.confirmar_sobreturno),
    });

    const result = await this.createTurnoBase({
      cliente,
      id_profesional: dto.id_profesional,
      bundle,
      fecha: dto.fecha,
      hora: dto.hora,
      observaciones: dto.observaciones,
      reservaPagada: Boolean(dto.reserva_pagada),
      crearPago: false,
    });

    return result.turno;
  }

  async createTurnoProfesional(dto: CreateAdminTurnoDto, userId: number) {
    const idProfesional = await this.profesionalesService.getIdByUsuario(userId);
    return this.createTurnoAdmin({
      ...dto,
      id_profesional: idProfesional,
    });
  }

  async findAllAdmin(params: { desde?: string; hasta?: string; id_profesional?: number } = {}) {
    const inicio = dayjs(params.desde || dayjs().format('YYYY-MM-DD')).startOf('day').toDate();
    const fin = dayjs(params.hasta || dayjs().format('YYYY-MM-DD')).endOf('day').toDate();

    const query = this.turnoRepository
      .createQueryBuilder('turno')
      .leftJoinAndSelect('turno.cliente', 'cliente')
      .leftJoinAndSelect('cliente.adulto', 'adulto')
      .leftJoinAndSelect('turno.profesional', 'profesional')
      .leftJoinAndSelect('profesional.usuario', 'profesionalUsuario')
      .leftJoinAndSelect('turno.servicio', 'servicio')
      .leftJoinAndSelect('turno.servicios_adicionales', 'serviciosAdicionales')
      .where('turno.fechaHora BETWEEN :inicio AND :fin', { inicio, fin })
      .andWhere('turno.estado != :cancelado', { cancelado: TurnoStatus.CANCELADO })
      .orderBy('turno.fechaHora', 'ASC');

    if (params.id_profesional) {
      query.andWhere('profesional.id_profesional = :idProfesional', { idProfesional: params.id_profesional });
    }

    const turnos = await query.getMany();
    return turnos.map((turno) => this.serializeTurno(turno));
  }

  async findCanceledAdmin(params: { desde?: string; hasta?: string; id_profesional?: number; estado_devolucion?: string } = {}) {
    const inicio = dayjs(params.desde || dayjs().subtract(30, 'day').format('YYYY-MM-DD')).startOf('day').toDate();
    const fin = dayjs(params.hasta || dayjs().format('YYYY-MM-DD')).endOf('day').toDate();
    const estadoDevolucion = (params.estado_devolucion || 'pendientes') as EstadoDevolucionReserva;

    const query = this.turnoRepository
      .createQueryBuilder('turno')
      .leftJoinAndSelect('turno.cliente', 'cliente')
      .leftJoinAndSelect('cliente.adulto', 'adulto')
      .leftJoinAndSelect('turno.profesional', 'profesional')
      .leftJoinAndSelect('profesional.usuario', 'profesionalUsuario')
      .leftJoinAndSelect('turno.servicio', 'servicio')
      .leftJoinAndSelect('turno.servicios_adicionales', 'serviciosAdicionales')
      .where('turno.fechaHora BETWEEN :inicio AND :fin', { inicio, fin })
      .andWhere('turno.estado = :cancelado', { cancelado: TurnoStatus.CANCELADO })
      .orderBy('turno.fechaHora', 'DESC');

    if (params.id_profesional) {
      query.andWhere('profesional.id_profesional = :idProfesional', { idProfesional: params.id_profesional });
    }

    if (estadoDevolucion === 'pendientes') {
      query
        .andWhere('turno.estado_pago = :aprobado', { aprobado: PaymentStatus.APROBADO })
        .andWhere('turno.reservaRefundedAt IS NULL');
    }

    if (estadoDevolucion === 'devueltos') {
      query.andWhere('turno.reservaRefundedAt IS NOT NULL');
    }

    if (estadoDevolucion === 'sin_devolucion') {
      query.andWhere('(turno.estado_pago != :aprobado OR turno.estado_pago IS NULL)', { aprobado: PaymentStatus.APROBADO });
    }

    const turnos = await query.getMany();
    return turnos.map((turno) => this.serializeTurno(turno));
  }

  findAll() {
    return this.turnoRepository.find({
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio', 'servicios_adicionales'],
      order: { fechaHora: 'ASC' },
    }).then((turnos) => turnos.map((turno) => this.serializeTurno(turno)));
  }

  findMine(userId: number) {
    return this.turnoRepository.find({
      where: {
        cliente: { adulto: { id_usuario: userId } },
        fechaHora: MoreThanOrEqual(dayjs().toDate()),
      },
      relations: ['cliente', 'profesional', 'profesional.usuario', 'servicio', 'servicios_adicionales'],
      order: { fechaHora: 'ASC' },
    }).then((turnos) => turnos
      .filter((turno) => turno.estado !== TurnoStatus.CANCELADO)
      .map((turno) => this.serializeTurno(turno)));
  }

  async getEstadoPagoTurno(user: any, idTurno: number, sincronizar = false) {
    const turno = await this.turnoRepository.findOne({
      where: { id_turno: idTurno },
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio', 'servicios_adicionales'],
    });
    if (!turno) throw new NotFoundException('Turno no encontrado');

    if (user.rol === 'USER' && turno.cliente.adulto?.id_usuario !== user.sub) {
      throw new ForbiddenException('No podes consultar un turno ajeno');
    }

    if (
      sincronizar
      && turno.estado === TurnoStatus.PENDIENTE_PAGO
      && turno.paymentStatus === PaymentStatus.PENDIENTE
    ) {
      const turnoSincronizado = await this.pagosService.sincronizarPagoPorTurno(turno.id_turno);
      if (Array.isArray(turnoSincronizado)) {
        const actual = turnoSincronizado.find((item) => item.id_turno === turno.id_turno);
        if (actual) Object.assign(turno, actual);
      } else if (turnoSincronizado) {
        Object.assign(turno, turnoSincronizado);
      }
    }

    const serialized = this.serializeTurno(turno);
    return {
      ...serialized,
      confirmado: turno.estado === TurnoStatus.CONFIRMADO && turno.paymentStatus === PaymentStatus.APROBADO,
    };
  }

  @Cron('*/5 * * * *')
  async cancelarTurnosPendientesVencidos() {
    const turnos = await this.turnoRepository.find({
      where: {
        estado: TurnoStatus.PENDIENTE_PAGO,
        paymentStatus: PaymentStatus.PENDIENTE,
        paymentExpiresAt: LessThanOrEqual(new Date()),
      },
      take: 100,
    });

    if (!turnos.length) return;

    const cancelados = turnos.map((turno) => ({
      ...turno,
      estado: TurnoStatus.CANCELADO,
      paymentStatus: PaymentStatus.CANCELADO,
    }));

    await this.turnoRepository.save(cancelados);
  }

  async findProfesional(userId: number, params: { desde?: string; hasta?: string } = {}) {
    const idProfesional = await this.profesionalesService.getIdByUsuario(userId);
    return this.findAllAdmin({ ...params, id_profesional: idProfesional });
  }

  async getHorariosDisponibles(idProfesional: number, idServicio: number, fecha: string, cantidad = 1, idsServiciosAdicionales: number[] = []) {
    const disponibles = await this.getHorariosDisponiblesCompletos(idProfesional, idServicio, fecha, cantidad, idsServiciosAdicionales);
    return this.aplicarDisponibilidadPublica(idProfesional, fecha, disponibles);
  }

  private async getHorariosDisponiblesCompletos(
    idProfesional: number,
    idServicio: number,
    fecha: string,
    cantidad = 1,
    idsServiciosAdicionales: number[] = [],
    portalFamiliar = true,
  ) {
    const bundle = await this.resolveServicioBundle(idServicio, idsServiciosAdicionales, {
      portalFamiliar,
      idProfesional,
    });
    const duracionTurno = bundle.duracionTotal;
    const turnosConsecutivos = Math.max(1, cantidad || 1);
    const diaSemana = dayjs(fecha).day();
    const horarios = await this.horarioRepository.find({
      where: { profesional: { id_profesional: idProfesional } },
      relations: ['profesional'],
    });
    const horariosDelDia = horarios.filter((horario) => Number(horario.dia) === diaSemana || this.matchDia(String(horario.dia), diaSemana));

    const inicioDia = dayjs(fecha).startOf('day').toDate();
    const finDia = dayjs(fecha).endOf('day').toDate();
    const ocupados = await this.turnoRepository.find({
      where: {
        fechaHora: Between(inicioDia, finDia),
        profesional: { id_profesional: idProfesional },
      },
      relations: ['servicio', 'servicios_adicionales'],
    });
    const intervalosTurnos = ocupados
      .filter((turno) => turno.estado !== TurnoStatus.CANCELADO)
      .map((turno) => {
        const inicio = dayjs(turno.fechaHora);
        return { inicio, fin: inicio.add(turno.duracion_total || turno.servicio?.duracion || duracionTurno, 'minute') };
      });

    const bloqueos = await this.bloqueoRepository.find({
      where: { profesional: { id_profesional: idProfesional }, dia: fecha },
    });
    if (bloqueos.some((bloqueo) => bloqueo.tipo === TipoBloqueo.DIA_COMPLETO)) return [];

    const intervalosBloqueos = bloqueos
      .filter((bloqueo) => bloqueo.tipo === TipoBloqueo.RANGO_HORARIO && bloqueo.hora_inicio && bloqueo.hora_fin)
      .map((bloqueo) => ({
        inicio: dayjs(`${fecha} ${bloqueo.hora_inicio}`),
        fin: dayjs(`${fecha} ${bloqueo.hora_fin}`),
      }));

    const intervalos = [...intervalosTurnos, ...intervalosBloqueos];
    const slots = horariosDelDia.flatMap((horario) =>
      this.generateSlots(horario.hora_inicio, horario.hora_fin, duracionTurno, duracionTurno * turnosConsecutivos),
    );

    const disponibles = slots.filter((hora) => {
      const inicio = dayjs(`${fecha} ${hora}`);
      const fin = inicio.add(duracionTurno * turnosConsecutivos, 'minute');
      return !intervalos.some((intervalo) => inicio.isBefore(intervalo.fin) && fin.isAfter(intervalo.inicio));
    });

    return Array.from(new Set(disponibles)).sort((a, b) => this.toMinutes(a) - this.toMinutes(b));
  }

  async getConfiguracionDisponibilidad() {
    return { cantidad_horarios_visibles: await this.getCantidadHorariosVisibles() };
  }

  async updateConfiguracionDisponibilidad(cantidadHorariosVisibles: number) {
    const cantidad = Math.max(1, Number(cantidadHorariosVisibles || 6));
    await this.configuracionDisponibilidadRepository.save(
      this.configuracionDisponibilidadRepository.create({
        clave: 'cantidad_horarios_visibles',
        valor: cantidad,
      }),
    );
    return { cantidad_horarios_visibles: cantidad };
  }

  async getDiasDisponibles(idProfesional: number, idServicio: number, desde?: string, hasta?: string, cantidad = 1, idsServiciosAdicionales: number[] = []) {
    const start = dayjs(desde || dayjs().format('YYYY-MM-DD')).startOf('day');
    const end = hasta ? dayjs(hasta).startOf('day') : start.add(30, 'day');
    const dias: string[] = [];

    let cursor = start;
    while (cursor.isSameOrBefore(end)) {
      const fecha = cursor.format('YYYY-MM-DD');
      const horarios = await this.getHorariosDisponibles(idProfesional, idServicio, fecha, cantidad, idsServiciosAdicionales);
      if (horarios.length) dias.push(fecha);
      cursor = cursor.add(1, 'day');
    }

    return dias;
  }

  async cancel(id: number, user: any) {
    const turno = await this.turnoRepository.findOne({
      where: { id_turno: id },
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio', 'servicios_adicionales'],
    });
    if (!turno) throw new NotFoundException('Turno no encontrado');

    if (user.rol === 'USER' && turno.cliente.adulto?.id_usuario !== user.sub) {
      throw new ForbiddenException('No podes cancelar un turno ajeno');
    }
    if (user.rol === 'PROF' && turno.profesional.usuario?.id_usuario !== user.sub) {
      throw new ForbiddenException('No podes cancelar un turno de otro profesional');
    }
    if (user.rol === 'USER' && dayjs(turno.fechaHora).diff(dayjs(), 'hour', true) < 24) {
      throw new BadRequestException('Los turnos solo se pueden cancelar con 24 hs de anticipacion');
    }

    turno.estado = TurnoStatus.CANCELADO;
    if (turno.paymentStatus === PaymentStatus.PENDIENTE) turno.paymentStatus = PaymentStatus.CANCELADO;
    return this.turnoRepository.save(turno).then((saved) => this.serializeTurno(saved));
  }

  async updateReservaPagoAdmin(id: number, reservaPagada: boolean) {
    const turno = await this.turnoRepository.findOne({ where: { id_turno: id }, relations: ['servicio'] });
    if (!turno) throw new NotFoundException('Turno no encontrado');

    const paymentStatusAnterior = turno.paymentStatus;
    const reservaRequerida = this.getReservaTotalTurno(turno);
    if (!reservaRequerida) {
      turno.paymentStatus = PaymentStatus.NO_REQUIERE;
      turno.paymentAmount = null;
      turno.paidAt = null;
    } else {
      turno.paymentStatus = reservaPagada ? PaymentStatus.APROBADO : PaymentStatus.PENDIENTE;
      turno.paymentAmount = reservaRequerida;
      turno.paidAt = reservaPagada ? new Date() : null;
      if (reservaPagada) turno.estado = TurnoStatus.CONFIRMADO;
    }

    const saved = await this.turnoRepository.save(turno);
    if (reservaPagada && paymentStatusAnterior !== PaymentStatus.APROBADO) {
      void this.whatsappService.sendTurnoConfirmation(saved.id_turno);
    }

    return this.serializeTurno(saved);
  }

  async markReservaRefundedAdmin(id: number) {
    const turno = await this.turnoRepository.findOne({
      where: { id_turno: id },
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio', 'servicios_adicionales'],
    });
    if (!turno) throw new NotFoundException('Turno no encontrado');
    if (turno.estado !== TurnoStatus.CANCELADO) {
      throw new BadRequestException('Solo se puede marcar devolucion en turnos cancelados');
    }
    if (turno.paymentStatus !== PaymentStatus.APROBADO) {
      throw new BadRequestException('El turno no tiene una reserva aprobada para devolver');
    }

    if (turno.reservaRefundedAt) return this.serializeTurno(turno);

    turno.reservaRefundedAt = nowArgentinaDateForDatabase();
    return this.turnoRepository.save(turno).then((saved) => this.serializeTurno(saved));
  }

  private async createTurnoBase({
    cliente,
    id_profesional,
    bundle,
    fecha,
    hora,
    observaciones,
    reservaPagada,
    crearPago,
  }: {
    cliente: Cliente;
    id_profesional: number;
    bundle: ServicioBundle;
    fecha: string;
    hora: string;
    observaciones?: string;
    reservaPagada: boolean;
    crearPago: boolean;
  }) {
    const requierePago = bundle.reservaTotal > 0;
    const turno = this.turnoRepository.create({
      dia: fecha,
      hora,
      fechaHora: dayjs(`${fecha} ${hora}`).toDate(),
      observaciones: observaciones || null,
      estado: requierePago && !reservaPagada ? TurnoStatus.PENDIENTE_PAGO : TurnoStatus.CONFIRMADO,
      paymentStatus: !requierePago ? PaymentStatus.NO_REQUIERE : reservaPagada ? PaymentStatus.APROBADO : PaymentStatus.PENDIENTE,
      paymentAmount: requierePago ? bundle.reservaTotal : null,
      precio_total: bundle.precioTotal,
      monto_reserva_total: bundle.reservaTotal,
      duracion_total: bundle.duracionTotal,
      paidAt: requierePago && reservaPagada ? new Date() : null,
      paymentExpiresAt: requierePago && !reservaPagada ? dayjs().add(15, 'minute').toDate() : null,
      cliente,
      profesional: { id_profesional: id_profesional } as Profesional,
      servicio: bundle.principal,
      servicios_adicionales: bundle.adicionales,
    });

    const turnoGuardado = await this.turnoRepository.save(turno);

    if (!requierePago || reservaPagada) {
      void this.whatsappService.sendTurnoConfirmation(turnoGuardado.id_turno);
      return { turno: this.serializeTurno(turnoGuardado), pago: null };
    }

    if (!crearPago) return { turno: this.serializeTurno(turnoGuardado), pago: null };

    const preferencia = await this.pagosService.crearPreferencia(turnoGuardado, bundle.principal);
    const checkoutUrl = this.pagosService.getCheckoutUrl(preferencia);
    turnoGuardado.mercadoPagoPreferenceId = preferencia.id;
    turnoGuardado.mercadoPagoInitPoint = checkoutUrl;
    turnoGuardado.externalReference = turnoGuardado.id_turno.toString();
    const turnoConPago = await this.turnoRepository.save(turnoGuardado);

    return {
      turno: this.serializeTurno(turnoConPago),
      pago: {
        preferenceId: preferencia.id,
        initPoint: checkoutUrl,
        sandboxInitPoint: preferencia.sandbox_init_point,
      },
    };
  }

  private async getClienteOwned(idCliente: number, user: any) {
    const cliente = await this.clienteRepository.findOne({
      where: { id_cliente: idCliente },
      relations: ['adulto'],
    });
    if (!cliente) throw new NotFoundException('Nino no encontrado');
    if (user.rol === 'USER' && cliente.adulto?.id_usuario !== user.sub) {
      throw new ForbiddenException('No podes reservar para un nino de otro responsable');
    }
    return cliente;
  }

  private async getClientesOwned(idsClientes: number[], user: any) {
    const idsUnicos = Array.from(new Set(idsClientes));
    if (idsUnicos.length !== idsClientes.length) {
      throw new BadRequestException('No se puede reservar dos veces para el mismo nino en el mismo bloque');
    }

    const clientes = await this.clienteRepository.find({
      where: idsUnicos.map((id_cliente) => ({ id_cliente })),
      relations: ['adulto'],
    });

    if (clientes.length !== idsClientes.length) {
      throw new NotFoundException('Uno o mas ninos no fueron encontrados');
    }

    clientes.forEach((cliente) => {
      if (user.rol === 'USER' && cliente.adulto?.id_usuario !== user.sub) {
        throw new ForbiddenException('No podes reservar para un nino de otro responsable');
      }
    });

    return idsClientes.map((idCliente) => clientes.find((cliente) => cliente.id_cliente === idCliente)!);
  }

  private async getServicio(idServicio: number) {
    const servicio = await this.servicioRepository.findOne({
      where: { id_servicio: idServicio },
      relations: ['complementos_permitidos'],
    });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return servicio;
  }

  private async resolveServicioBundle(
    idServicio: number,
    idsServiciosAdicionales: number[] = [],
    options: { portalFamiliar?: boolean; idProfesional?: number } = {},
  ): Promise<ServicioBundle> {
    const principal = await this.getServicio(idServicio);
    if (options.portalFamiliar && !principal.visible) {
      throw new BadRequestException('Este servicio no se puede reservar desde el portal familiar');
    }

    const idsUnicos = Array.from(new Set((idsServiciosAdicionales || []).map(Number).filter(Boolean)));
    if (idsUnicos.length !== (idsServiciosAdicionales || []).length) {
      throw new BadRequestException('No se pueden repetir servicios adicionales');
    }
    if (idsUnicos.includes(idServicio)) {
      throw new BadRequestException('El servicio principal no puede agregarse como complemento');
    }

    const adicionales = idsUnicos.length
      ? await this.servicioRepository.find({
        where: { id_servicio: In(idsUnicos) },
        order: { nombre: 'ASC' },
      })
      : [];
    if (adicionales.length !== idsUnicos.length) {
      throw new NotFoundException('Uno o mas servicios adicionales no fueron encontrados');
    }

    const permitidos = new Set((principal.complementos_permitidos || []).map((servicio) => servicio.id_servicio));
    adicionales.forEach((adicional) => {
      if (!permitidos.has(adicional.id_servicio)) {
        throw new BadRequestException(`${adicional.nombre} no esta disponible como complemento de ${principal.nombre}`);
      }
      if (!adicional.visible_como_complemento) {
        throw new BadRequestException(`${adicional.nombre} no esta disponible como complemento`);
      }
    });

    const servicios = [principal, ...idsUnicos.map((id) => adicionales.find((servicio) => servicio.id_servicio === id)!)];

    if (options.idProfesional) {
      await this.validarServiciosDelProfesional(options.idProfesional, servicios);
    }

    return {
      principal,
      adicionales: servicios.slice(1),
      servicios,
      duracionTotal: servicios.reduce((total, servicio) => total + Number(servicio.duracion || 0), 0),
      precioTotal: servicios.reduce((total, servicio) => total + Number(servicio.precio || 0), 0),
      reservaTotal: servicios.reduce((total, servicio) => total + Number(servicio.monto_reserva || 0), 0),
    };
  }

  private async validarServiciosDelProfesional(idProfesional: number, servicios: Servicio[]) {
    const profesional = await this.profesionalRepository.findOne({
      where: { id_profesional: idProfesional },
      relations: ['profServicio', 'profServicio.servicio'],
    });
    if (!profesional) throw new NotFoundException('Profesional no encontrado');

    const asignados = new Set((profesional.profServicio || []).map((item) => item.servicio?.id_servicio));
    const faltante = servicios.find((servicio) => !asignados.has(servicio.id_servicio));
    if (faltante) {
      throw new BadRequestException(`El profesional no tiene asignado el servicio ${faltante.nombre}`);
    }
  }

  private getReservaTotalTurno(turno: Turno) {
    return Number(turno.monto_reserva_total ?? turno.paymentAmount ?? turno.servicio?.monto_reserva ?? 0);
  }

  private getPrecioTotalTurno(turno: Turno) {
    const adicionales = (turno.servicios_adicionales || []).reduce((total, servicio) => total + Number(servicio.precio || 0), 0);
    return Number(turno.precio_total ?? (Number(turno.servicio?.precio || 0) + adicionales));
  }

  private getDuracionTotalTurno(turno: Turno) {
    const adicionales = (turno.servicios_adicionales || []).reduce((total, servicio) => total + Number(servicio.duracion || 0), 0);
    return Number(turno.duracion_total ?? (Number(turno.servicio?.duracion || 0) + adicionales));
  }

  private async validarSolapamiento(params: { id_profesional: number; id_servicio: number; ids_servicios_adicionales?: number[]; fecha: string; hora: string; permitirSobreturno: boolean }) {
    if (params.permitirSobreturno) return;
    const disponibles = await this.getHorariosDisponiblesCompletos(
      params.id_profesional,
      params.id_servicio,
      params.fecha,
      1,
      params.ids_servicios_adicionales,
      false,
    );
    if (!disponibles.includes(params.hora)) {
      throw new BadRequestException('El turno se superpone con otro turno o bloqueo');
    }
  }

  private async isDentroHorario(idProfesional: number, fecha: string, hora: string, duracion: number) {
    const dia = dayjs(fecha).day();
    const inicio = this.toMinutes(hora);
    const fin = inicio + duracion;
    const horarios = await this.horarioRepository.find({ where: { profesional: { id_profesional: idProfesional } } });
    return horarios.some((horario) => Number(horario.dia) === dia && inicio >= this.toMinutes(horario.hora_inicio) && fin <= this.toMinutes(horario.hora_fin));
  }

  private async getCantidadHorariosVisibles() {
    const config = await this.configuracionDisponibilidadRepository.findOneBy({ clave: 'cantidad_horarios_visibles' });
    return Math.max(1, Number(config?.valor || 6));
  }

  private async aplicarDisponibilidadPublica(idProfesional: number, fecha: string, disponibles: string[]) {
    const limite = await this.getCantidadHorariosVisibles();
    const disponiblesUnicos = Array.from(new Set(disponibles)).sort((a, b) => this.toMinutes(a) - this.toMinutes(b));
    const disponiblesSet = new Set(disponiblesUnicos);
    const destacados = await this.horarioDestacadoRepository.find({
      where: {
        profesional: { id_profesional: idProfesional },
      },
      order: { orden: 'ASC' },
    });

    const priorizados = destacados
      .map((destacado) => destacado.hora.slice(0, 5))
      .filter((hora, index, values) => disponiblesSet.has(hora) && values.indexOf(hora) === index);
    const relleno = disponiblesUnicos.filter((hora) => !priorizados.includes(hora));

    return [...priorizados, ...relleno].slice(0, limite);
  }

  private matchDia(value: string, weekday: number) {
    const normalized = value.toLowerCase();
    const names = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return normalized === String(weekday) || normalized === names[weekday];
  }

  private generateSlots(inicio: string, fin: string, duracion: number, duracionBloque = duracion) {
    const slots: string[] = [];
    let cursor = this.toMinutes(inicio);
    const end = this.toMinutes(fin);
    while (cursor + duracionBloque <= end) {
      slots.push(this.toTime(cursor));
      cursor += duracion;
    }
    return slots;
  }

  private toMinutes(value: string) {
    const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  }

  private toTime(value: number) {
    const hours = Math.floor(value / 60).toString().padStart(2, '0');
    const minutes = (value % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private serializeTurno(turno: Turno) {
    const fechaHora = turno.fechaHora || dayjs(`${turno.dia} ${turno.hora}`).toDate();
    const fecha = dayjs(fechaHora).format('YYYY-MM-DD');
    const hora = dayjs(fechaHora).format('HH:mm');
    const serviciosAdicionales = (turno.servicios_adicionales || []).map((servicio) => ({
      ...servicio,
      reserva: servicio.monto_reserva,
      precio_efectivo: servicio.precio,
      precio_transferencia: servicio.precio_transferencia ?? servicio.precio,
      visible_cliente: servicio.visible,
      imagenes: servicio.imagenes || [],
    }));
    return {
      ...turno,
      fechaHora: formatLocalDateTime(fechaHora),
      dia: fecha,
      hora,
      estado_pago: turno.paymentStatus,
      reservaRefundedAt: turno.reservaRefundedAt ? formatLocalDateTime(turno.reservaRefundedAt) : null,
      precio_total: this.getPrecioTotalTurno(turno),
      monto_reserva_total: this.getReservaTotalTurno(turno),
      duracion_total: this.getDuracionTotalTurno(turno),
      cliente: turno.cliente ? {
        ...turno.cliente,
        adulto: turno.cliente.adulto,
        usuario: turno.cliente.adulto,
      } : undefined,
      profesional: turno.profesional ? {
        ...turno.profesional,
        nombre: turno.profesional.usuario?.nombre || `Profesional ${turno.profesional.id_profesional}`,
      } : undefined,
      servicio: turno.servicio ? {
        ...turno.servicio,
        reserva: turno.servicio.monto_reserva,
        precio_efectivo: turno.servicio.precio,
        precio_transferencia: turno.servicio.precio_transferencia ?? turno.servicio.precio,
        visible_cliente: turno.servicio.visible,
        imagenes: turno.servicio.imagenes || [],
      } : undefined,
      servicios_adicionales: serviciosAdicionales,
    };
  }
}
