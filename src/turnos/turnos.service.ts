import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Bloqueo, TipoBloqueo } from 'src/bloqueos/entities/bloqueo.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import dayjs, { formatLocalDateTime } from 'src/common/date.util';
import { PagosService } from 'src/pagos/pagos.service';
import { HorarioDestacado } from 'src/profesionales/entities/horario-destacado.entity';
import { Horario } from 'src/profesionales/entities/horario.entity';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { ProfesionalesService } from 'src/profesionales/profesionales.service';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { Between, DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { CreateAdminTurnoDto } from './dto/create-admin-turno.dto';
import { CreateGrupoTurnoDto } from './dto/create-grupo-turno.dto';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { ConfiguracionDisponibilidad } from './entities/configuracion-disponibilidad.entity';
import { PaymentStatus, Turno, TurnoStatus } from './entities/turno.entity';
import { randomUUID } from 'crypto';

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
    const servicio = await this.getServicio(dto.id_servicio);

    if (!servicio.visible) {
      throw new BadRequestException('Este servicio no se puede reservar desde el portal familiar');
    }

    const disponibles = await this.getHorariosDisponibles(dto.id_profesional, dto.id_servicio, dto.fecha);
    if (!disponibles.includes(dto.hora)) {
      throw new BadRequestException('El horario seleccionado no esta disponible');
    }

    return this.createTurnoBase({
      cliente,
      id_profesional: dto.id_profesional,
      servicio,
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
    const servicio = await this.getServicio(dto.id_servicio);

    if (!servicio.visible) {
      throw new BadRequestException('Este servicio no se puede reservar desde el portal familiar');
    }

    const disponibles = await this.getHorariosDisponibles(dto.id_profesional, dto.id_servicio, dto.fecha, cantidad);
    if (!disponibles.includes(dto.hora)) {
      throw new BadRequestException('El bloque horario seleccionado no esta disponible');
    }

    const requierePago = Number(servicio.monto_reserva) > 0;
    const externalReference = `grupo:${randomUUID()}`;
    const horaInicial = this.toMinutes(dto.hora);

    const turnosGuardados = await this.dataSource.transaction(async (manager) => {
      const turnoRepository = manager.getRepository(Turno);
      const turnos = clientes.map((cliente, index) => {
        const hora = this.toTime(horaInicial + servicio.duracion * index);
        return turnoRepository.create({
          dia: dto.fecha,
          hora,
          fechaHora: dayjs(`${dto.fecha} ${hora}`).toDate(),
          observaciones: dto.observaciones || null,
          estado: requierePago ? TurnoStatus.PENDIENTE_PAGO : TurnoStatus.CONFIRMADO,
          paymentStatus: requierePago ? PaymentStatus.PENDIENTE : PaymentStatus.NO_REQUIERE,
          paymentAmount: requierePago ? Number(servicio.monto_reserva) : null,
          paymentExpiresAt: requierePago ? dayjs().add(15, 'minute').toDate() : null,
          externalReference,
          cliente,
          profesional: { id_profesional: dto.id_profesional } as Profesional,
          servicio,
        });
      });

      return turnoRepository.save(turnos);
    });

    if (!requierePago) {
      turnosGuardados.forEach((turno) => void this.whatsappService.sendTurnoConfirmation(turno.id_turno));
      return { turnos: turnosGuardados.map((turno) => this.serializeTurno(turno)), pago: null };
    }

    const preferencia = await this.pagosService.crearPreferenciaGrupo(turnosGuardados, servicio, externalReference);
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

    const servicio = await this.getServicio(dto.id_servicio);
    const dentroHorario = await this.isDentroHorario(dto.id_profesional, dto.fecha, dto.hora, servicio.duracion);

    if (!dentroHorario && !dto.forzar_fuera_horario) {
      throw new BadRequestException('El turno esta fuera del horario laboral');
    }

    await this.validarSolapamiento({
      id_profesional: dto.id_profesional,
      id_servicio: dto.id_servicio,
      fecha: dto.fecha,
      hora: dto.hora,
      permitirSobreturno: Boolean(dto.confirmar_sobreturno),
    });

    const result = await this.createTurnoBase({
      cliente,
      id_profesional: dto.id_profesional,
      servicio,
      fecha: dto.fecha,
      hora: dto.hora,
      observaciones: dto.observaciones,
      reservaPagada: Boolean(dto.reserva_pagada),
      crearPago: false,
    });

    return result.turno;
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
      .where('turno.fechaHora BETWEEN :inicio AND :fin', { inicio, fin })
      .andWhere('turno.estado != :cancelado', { cancelado: TurnoStatus.CANCELADO })
      .orderBy('turno.fechaHora', 'ASC');

    if (params.id_profesional) {
      query.andWhere('profesional.id_profesional = :idProfesional', { idProfesional: params.id_profesional });
    }

    const turnos = await query.getMany();
    return turnos.map((turno) => this.serializeTurno(turno));
  }

  findAll() {
    return this.turnoRepository.find({
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio'],
      order: { fechaHora: 'ASC' },
    }).then((turnos) => turnos.map((turno) => this.serializeTurno(turno)));
  }

  findMine(userId: number) {
    return this.turnoRepository.find({
      where: {
        cliente: { adulto: { id_usuario: userId } },
        fechaHora: MoreThanOrEqual(dayjs().toDate()),
      },
      relations: ['cliente', 'profesional', 'profesional.usuario', 'servicio'],
      order: { fechaHora: 'ASC' },
    }).then((turnos) => turnos
      .filter((turno) => turno.estado !== TurnoStatus.CANCELADO)
      .map((turno) => this.serializeTurno(turno)));
  }

  async findProfesional(userId: number) {
    const idProfesional = await this.profesionalesService.getIdByUsuario(userId);
    return this.findAllAdmin({ id_profesional: idProfesional });
  }

  async getHorariosDisponibles(idProfesional: number, idServicio: number, fecha: string, cantidad = 1) {
    const disponibles = await this.getHorariosDisponiblesCompletos(idProfesional, idServicio, fecha, cantidad);
    return this.aplicarDisponibilidadPublica(idProfesional, fecha, disponibles);
  }

  private async getHorariosDisponiblesCompletos(idProfesional: number, idServicio: number, fecha: string, cantidad = 1) {
    const servicio = await this.getServicio(idServicio);
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
      relations: ['servicio'],
    });
    const intervalosTurnos = ocupados
      .filter((turno) => turno.estado !== TurnoStatus.CANCELADO)
      .map((turno) => {
        const inicio = dayjs(turno.fechaHora);
        return { inicio, fin: inicio.add(turno.servicio?.duracion || servicio.duracion, 'minute') };
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
      this.generateSlots(horario.hora_inicio, horario.hora_fin, servicio.duracion, servicio.duracion * turnosConsecutivos),
    );

    const disponibles = slots.filter((hora) => {
      const inicio = dayjs(`${fecha} ${hora}`);
      const fin = inicio.add(servicio.duracion * turnosConsecutivos, 'minute');
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

  async getDiasDisponibles(idProfesional: number, idServicio: number, desde?: string, hasta?: string, cantidad = 1) {
    const start = dayjs(desde || dayjs().format('YYYY-MM-DD')).startOf('day');
    const end = hasta ? dayjs(hasta).startOf('day') : start.add(30, 'day');
    const dias: string[] = [];

    let cursor = start;
    while (cursor.isSameOrBefore(end)) {
      const fecha = cursor.format('YYYY-MM-DD');
      const horarios = await this.getHorariosDisponibles(idProfesional, idServicio, fecha, cantidad);
      if (horarios.length) dias.push(fecha);
      cursor = cursor.add(1, 'day');
    }

    return dias;
  }

  async cancel(id: number, user: any) {
    const turno = await this.turnoRepository.findOne({
      where: { id_turno: id },
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio'],
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

    if (!turno.servicio?.monto_reserva) {
      turno.paymentStatus = PaymentStatus.NO_REQUIERE;
      turno.paymentAmount = null;
      turno.paidAt = null;
    } else {
      turno.paymentStatus = reservaPagada ? PaymentStatus.APROBADO : PaymentStatus.PENDIENTE;
      turno.paymentAmount = turno.servicio.monto_reserva;
      turno.paidAt = reservaPagada ? new Date() : null;
      if (reservaPagada) turno.estado = TurnoStatus.CONFIRMADO;
    }

    return this.turnoRepository.save(turno).then((saved) => this.serializeTurno(saved));
  }

  private async createTurnoBase({
    cliente,
    id_profesional,
    servicio,
    fecha,
    hora,
    observaciones,
    reservaPagada,
    crearPago,
  }: {
    cliente: Cliente;
    id_profesional: number;
    servicio: Servicio;
    fecha: string;
    hora: string;
    observaciones?: string;
    reservaPagada: boolean;
    crearPago: boolean;
  }) {
    const requierePago = Number(servicio.monto_reserva) > 0;
    const turno = this.turnoRepository.create({
      dia: fecha,
      hora,
      fechaHora: dayjs(`${fecha} ${hora}`).toDate(),
      observaciones: observaciones || null,
      estado: requierePago && !reservaPagada ? TurnoStatus.PENDIENTE_PAGO : TurnoStatus.CONFIRMADO,
      paymentStatus: !requierePago ? PaymentStatus.NO_REQUIERE : reservaPagada ? PaymentStatus.APROBADO : PaymentStatus.PENDIENTE,
      paymentAmount: requierePago ? Number(servicio.monto_reserva) : null,
      paidAt: requierePago && reservaPagada ? new Date() : null,
      paymentExpiresAt: requierePago && !reservaPagada ? dayjs().add(15, 'minute').toDate() : null,
      cliente,
      profesional: { id_profesional: id_profesional } as Profesional,
      servicio,
    });

    const turnoGuardado = await this.turnoRepository.save(turno);

    if (!requierePago || reservaPagada) {
      void this.whatsappService.sendTurnoConfirmation(turnoGuardado.id_turno);
      return { turno: this.serializeTurno(turnoGuardado), pago: null };
    }

    if (!crearPago) return { turno: this.serializeTurno(turnoGuardado), pago: null };

    const preferencia = await this.pagosService.crearPreferencia(turnoGuardado, servicio);
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
    const servicio = await this.servicioRepository.findOneBy({ id_servicio: idServicio });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return servicio;
  }

  private async validarSolapamiento(params: { id_profesional: number; id_servicio: number; fecha: string; hora: string; permitirSobreturno: boolean }) {
    if (params.permitirSobreturno) return;
    const disponibles = await this.getHorariosDisponiblesCompletos(params.id_profesional, params.id_servicio, params.fecha);
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
    return {
      ...turno,
      fechaHora: formatLocalDateTime(fechaHora),
      dia: fecha,
      hora,
      estado_pago: turno.paymentStatus,
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
        visible_cliente: turno.servicio.visible,
      } : undefined,
    };
  }
}
