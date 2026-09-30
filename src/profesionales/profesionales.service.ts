import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import dayjs, { nowArgentina } from '../common/date.util';
import { Turno, TurnoStatus } from '../turnos/entities/turno.entity';
import { admiteReserva, estadoActividad, fechaBajaLocal, resolverFechaBaja } from './actividad-profesional';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { HorarioDestacado } from './entities/horario-destacado.entity';
import { Horario } from './entities/horario.entity';
import { ProfServicio } from './entities/prof_servicio.entity';
import { Profesional } from './entities/profesional.entity';

@Injectable()
export class ProfesionalesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Profesional)
    private readonly profesionalRepository: Repository<Profesional>,
    @InjectRepository(Horario)
    private readonly horarioRepository: Repository<Horario>,
    @InjectRepository(HorarioDestacado)
    private readonly horarioDestacadoRepository: Repository<HorarioDestacado>,
    @InjectRepository(ProfServicio)
    private readonly profServicioRepository: Repository<ProfServicio>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Servicio)
    private readonly servicioRepository: Repository<Servicio>,
  ) {}

  async findAllWithServicios() {
    const profesionales = await this.profesionalRepository.find({
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio', 'profServicio.servicio.complementos_permitidos'],
      order: { id_profesional: 'ASC' },
    });
    return profesionales.filter((p) => estadoActividad(p.baja_desde) !== 'INACTIVA').map((profesional) => ({
      id_profesional: profesional.id_profesional,
      nombre: profesional.usuario?.nombre || `Profesional ${profesional.id_profesional}`,
      foto_url: profesional.foto_url,
      foto_pathname: profesional.foto_pathname,
      servicios: (profesional.profServicio || [])
        .filter((relacion) => relacion.servicio?.visible)
        .map((relacion) => this.mapServicio(relacion.servicio)),
    }));
  }

  async findAllAdmin() {
    const profesionales = await this.profesionalRepository.find({
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio', 'profServicio.servicio.complementos_permitidos'],
      order: { id_profesional: 'ASC' },
    });
    return profesionales.map((profesional) => this.mapAdmin(profesional));
  }

  async findOne(id: number) {
    const profesional = await this.profesionalRepository.findOne({
      where: { id_profesional: id },
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio', 'profServicio.servicio.complementos_permitidos'],
    });

    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }

    return this.mapAdmin(profesional);
  }

  async findMe(userId: number) {
    const profesional = await this.profesionalRepository.findOne({
      where: { usuario: { id_usuario: userId } },
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio', 'profServicio.servicio.complementos_permitidos', 'turnos'],
    });

    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado para este usuario');
    }

    return this.mapAdmin(profesional);
  }

  async create(createProfesionalDto: CreateProfesionalDto) {
    let usuario = createProfesionalDto.id_usuario
      ? await this.usuarioRepository.findOneBy({ id_usuario: createProfesionalDto.id_usuario })
      : null;

    if (!usuario && createProfesionalDto.dni) {
      const existing = await this.usuarioRepository.findOneBy({ dni: createProfesionalDto.dni });
      if (existing) {
        throw new ConflictException('Ya existe un usuario con ese DNI');
      }
      usuario = await this.usuarioRepository.save(
        this.usuarioRepository.create({
          nombre: createProfesionalDto.nombre || 'Profesional',
          dni: createProfesionalDto.dni,
          mail: createProfesionalDto.mail || '',
          telefono: createProfesionalDto.telefono || 0,
          instagram: '',
          codigo: createProfesionalDto.codigo,
          rol: 'PROF',
        }),
      );
    }

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    usuario.rol = 'PROF';
    await this.usuarioRepository.save(usuario);

    const profesional = await this.profesionalRepository.save(
      this.profesionalRepository.create({
        fecha_nacimiento: createProfesionalDto.fecha_nacimiento,
        foto_url: createProfesionalDto.foto_url,
        foto_pathname: createProfesionalDto.foto_pathname,
        usuario,
      }),
    );

    if (createProfesionalDto.servicios?.length) {
      for (const idServicio of createProfesionalDto.servicios) {
        const servicio = await this.servicioRepository.findOneBy({ id_servicio: idServicio });
        if (servicio) {
          await this.profServicioRepository.save(
            this.profServicioRepository.create({ profesional, servicio }),
          );
        }
      }
    }

    if (createProfesionalDto.horarios?.length) {
      await this.saveHorarios(profesional, createProfesionalDto.horarios);
    }

    if (createProfesionalDto.horarios_destacados?.length) {
      await this.saveHorariosDestacados(profesional, createProfesionalDto.horarios_destacados);
    }

    return this.findOne(profesional.id_profesional);
  }

  async update(id: number, dto: CreateProfesionalDto) {
    const profesional = await this.profesionalRepository.findOne({
      where: { id_profesional: id },
      relations: ['usuario', 'profServicio', 'profServicio.servicio'],
    });
    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }

    if (dto.nombre !== undefined) profesional.usuario.nombre = dto.nombre;
    if (dto.dni !== undefined) profesional.usuario.dni = dto.dni;
    if (dto.mail !== undefined) profesional.usuario.mail = dto.mail;
    if (dto.telefono !== undefined) profesional.usuario.telefono = dto.telefono;
    if (dto.codigo !== undefined) profesional.usuario.codigo = dto.codigo;
    if (dto.fecha_nacimiento !== undefined) profesional.fecha_nacimiento = dto.fecha_nacimiento;
    if (dto.foto_url !== undefined) profesional.foto_url = dto.foto_url;
    if (dto.foto_pathname !== undefined) profesional.foto_pathname = dto.foto_pathname;

    await this.usuarioRepository.save(profesional.usuario);
    await this.profesionalRepository.update(profesional.id_profesional, {
      fecha_nacimiento: profesional.fecha_nacimiento, foto_url: profesional.foto_url, foto_pathname: profesional.foto_pathname,
    });

    if (dto.servicios) {
      await this.profServicioRepository.delete({ profesional: { id_profesional: id } as any });
      for (const idServicio of dto.servicios) {
        const servicio = await this.servicioRepository.findOneBy({ id_servicio: idServicio });
        if (servicio) {
          await this.profServicioRepository.save(this.profServicioRepository.create({ profesional, servicio }));
        }
      }
    }

    if (dto.horarios) {
      await this.horarioRepository.delete({ profesional: { id_profesional: id } as any });
      await this.saveHorarios(profesional, dto.horarios);
    }

    if (dto.horarios_destacados) {
      await this.horarioDestacadoRepository.delete({ profesional: { id_profesional: id } as any });
      await this.saveHorariosDestacados(profesional, dto.horarios_destacados);
    }

    return this.findOne(id);
  }

  async updateMe(userId: number, dto: CreateProfesionalDto) {
    const profesional = await this.profesionalRepository.findOne({
      where: { usuario: { id_usuario: userId } },
      relations: ['usuario'],
    });
    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado para este usuario');
    }

    if (dto.nombre !== undefined) profesional.usuario.nombre = dto.nombre;
    if (dto.dni !== undefined) profesional.usuario.dni = dto.dni;
    if (dto.mail !== undefined) profesional.usuario.mail = dto.mail;
    if (dto.telefono !== undefined) profesional.usuario.telefono = dto.telefono;
    if (dto.codigo !== undefined) profesional.usuario.codigo = dto.codigo;
    if (dto.fecha_nacimiento !== undefined) profesional.fecha_nacimiento = dto.fecha_nacimiento;
    if (dto.foto_url !== undefined) profesional.foto_url = dto.foto_url;
    if (dto.foto_pathname !== undefined) profesional.foto_pathname = dto.foto_pathname;

    await this.usuarioRepository.save(profesional.usuario);
    await this.profesionalRepository.update(profesional.id_profesional, {
      fecha_nacimiento: profesional.fecha_nacimiento, foto_url: profesional.foto_url, foto_pathname: profesional.foto_pathname,
    });

    return this.findMe(userId);
  }

  async remove(id: number) {
    return this.darBaja(id);
  }

  async requireProfesional(id: number, manager?: EntityManager) {
    const profesional = await (manager ? manager.getRepository(Profesional) : this.profesionalRepository).findOne({
      where: { id_profesional: id },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!profesional) throw new NotFoundException('Profesional no encontrado');
    return profesional;
  }

  async validarReserva(id: number, fecha: string, hora: string, manager?: EntityManager) {
    const profesional = await this.requireProfesional(id, manager);
    if (!admiteReserva(profesional.baja_desde, fecha, hora)) {
      throw new BadRequestException('La profesional esta dada de baja para la fecha seleccionada');
    }
  }

  async validarAcceso(userId: number) {
    const profesional = await this.profesionalRepository.findOne({ where: { usuario: { id_usuario: userId } } });
    if (!profesional || estadoActividad(profesional.baja_desde) === 'INACTIVA') {
      throw new ForbiddenException('La profesional esta dada de baja');
    }
  }

  private async calcularImpacto(id: number, baja: string, manager: EntityManager) {
    const desde = [baja, nowArgentina().format('YYYY-MM-DDTHH:mm:ss')].sort().pop()!;
    const turnos = await manager.getRepository(Turno).createQueryBuilder('turno')
      .leftJoinAndSelect('turno.cliente', 'cliente')
      .where('turno.id_profesional = :id', { id })
      .andWhere('turno.estado != :cancelado', { cancelado: TurnoStatus.CANCELADO })
      .andWhere('turno.fechaHora >= :desde', { desde: desde.replace('T', ' ') })
      .orderBy('turno.fechaHora', 'ASC').getMany();
    return {
      cantidad: turnos.length,
      turnos: turnos.map((t) => ({ id_turno: t.id_turno, fechaHora: dayjs(t.fechaHora).format('YYYY-MM-DDTHH:mm:ss'), nombre_cliente: t.cliente?.nombre || '', estado: t.estado })),
    };
  }

  async impactoBaja(id: number, fecha?: string) {
    await this.requireProfesional(id);
    return this.calcularImpacto(id, resolverFechaBaja(fecha), this.dataSource.manager);
  }

  async darBaja(id: number, fecha?: string) {
    const baja = resolverFechaBaja(fecha);
    return this.dataSource.transaction(async (manager) => {
      const profesional = await this.requireProfesional(id, manager);
      const actual = fechaBajaLocal(profesional.baja_desde);
      if (estadoActividad(profesional.baja_desde) === 'INACTIVA' && fecha !== undefined && baja !== actual) {
        throw new BadRequestException('Reactiva la profesional antes de programar otra baja');
      }
      const efectiva = estadoActividad(profesional.baja_desde) === 'INACTIVA' ? actual! : baja;
      // Partial update prevents unrelated profile edits from restoring an old status.
      await manager.getRepository(Profesional).update(id, { baja_desde: dayjs(efectiva).toDate() });
      const impacto = await this.calcularImpacto(id, efectiva, manager);
      return { baja_desde: efectiva, estado_actividad: estadoActividad(efectiva), impacto };
    });
  }

  async reactivar(id: number) {
    return this.dataSource.transaction(async (manager) => {
      await this.requireProfesional(id, manager);
      await manager.getRepository(Profesional).update(id, { baja_desde: null });
      return { baja_desde: null, estado_actividad: 'ACTIVA' as const };
    });
  }

  async createHorario(createHorarioDto: CreateHorarioDto) {
    const profesional = await this.profesionalRepository.findOneBy({ id_profesional: createHorarioDto.id_profesional });
    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }
    const horario = this.horarioRepository.create({
      dia: createHorarioDto.dia,
      hora_inicio: createHorarioDto.hora_inicio,
      hora_fin: createHorarioDto.hora_fin,
      profesional,
    });
    return this.horarioRepository.save(horario);
  }

  async getIdByUsuario(userId: number) {
    const profesional = await this.profesionalRepository.findOne({
      where: { usuario: { id_usuario: userId } },
      select: { id_profesional: true },
    });
    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }
    return profesional.id_profesional;
  }

  private async saveHorarios(profesional: Profesional, horarios: CreateProfesionalDto['horarios']) {
    if (!horarios?.length) return;

    const horariosEntities = horarios.map((horario) => this.horarioRepository.create({
      dia: String(horario.dia),
      hora_inicio: horario.hora_inicio,
      hora_fin: horario.hora_fin,
      profesional,
    }));

    await this.horarioRepository.save(horariosEntities);
  }

  private async saveHorariosDestacados(profesional: Profesional, horarios: CreateProfesionalDto['horarios_destacados']) {
    if (!horarios?.length) return;

    const horariosEntities = horarios.map((horario, index) => this.horarioDestacadoRepository.create({
      hora: horario.hora.slice(0, 5),
      orden: Number(horario.orden || index + 1),
      profesional,
    }));

    await this.horarioDestacadoRepository.save(horariosEntities);
  }

  private mapAdmin(profesional: Profesional) {
    return {
      id_profesional: profesional.id_profesional,
      baja_desde: fechaBajaLocal(profesional.baja_desde),
      estado_actividad: estadoActividad(profesional.baja_desde),
      fecha_nacimiento: profesional.fecha_nacimiento,
      foto_url: profesional.foto_url,
      foto_pathname: profesional.foto_pathname,
      usuario: profesional.usuario,
      nombre: profesional.usuario?.nombre || `Profesional ${profesional.id_profesional}`,
      dni: profesional.usuario?.dni,
      mail: profesional.usuario?.mail,
      telefono: profesional.usuario?.telefono,
      servicios: (profesional.profServicio || [])
        .filter((relacion) => relacion.servicio)
        .map((relacion) => this.mapServicio(relacion.servicio)),
      horarios: (profesional.horarios || []).map((horario) => ({
        id_horario: horario.id_horario,
        dia: Number(horario.dia),
        hora_inicio: horario.hora_inicio?.slice(0, 5),
        hora_fin: horario.hora_fin?.slice(0, 5),
      })),
      horarios_destacados: (profesional.horariosDestacados || [])
        .sort((a, b) => a.orden - b.orden)
        .map((horario) => ({
          id: horario.id,
          hora: horario.hora?.slice(0, 5),
          orden: horario.orden,
        })),
      disponibilidades: [],
    };
  }

  private mapServicio(servicio: Servicio) {
    return {
      id_servicio: servicio.id_servicio,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      duracion: servicio.duracion,
      precio: servicio.precio,
      precio_efectivo: servicio.precio,
      precio_transferencia: servicio.precio_transferencia ?? servicio.precio,
      reserva: servicio.monto_reserva,
      visible_cliente: servicio.visible,
      visible_como_complemento: servicio.visible_como_complemento,
      imagenes: servicio.imagenes || [],
      complementos_permitidos: (servicio.complementos_permitidos || [])
        .filter((complemento) => complemento.visible_como_complemento)
        .map((complemento) => ({
          id_servicio: complemento.id_servicio,
          nombre: complemento.nombre,
          descripcion: complemento.descripcion,
          duracion: complemento.duracion,
          precio: complemento.precio,
          precio_efectivo: complemento.precio,
          precio_transferencia: complemento.precio_transferencia ?? complemento.precio,
          reserva: complemento.monto_reserva,
          visible_cliente: complemento.visible,
          visible_como_complemento: complemento.visible_como_complemento,
          imagenes: complemento.imagenes || [],
          categoria: null,
        })),
      complementos_permitidos_ids: (servicio.complementos_permitidos || [])
        .filter((complemento) => complemento.visible_como_complemento)
        .map((complemento) => complemento.id_servicio),
      categoria: null,
    };
  }
}
