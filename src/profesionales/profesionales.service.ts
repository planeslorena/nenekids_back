import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Repository } from 'typeorm';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { HorarioDestacado } from './entities/horario-destacado.entity';
import { Horario } from './entities/horario.entity';
import { ProfServicio } from './entities/prof_servicio.entity';
import { Profesional } from './entities/profesional.entity';

@Injectable()
export class ProfesionalesService {
  constructor(
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
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio'],
      order: { id_profesional: 'ASC' },
    });
    return profesionales.map((profesional) => ({
      id_profesional: profesional.id_profesional,
      nombre: profesional.usuario?.nombre || `Profesional ${profesional.id_profesional}`,
      servicios: (profesional.profServicio || [])
        .filter((relacion) => relacion.servicio?.visible)
        .map((relacion) => this.mapServicio(relacion.servicio)),
    }));
  }

  async findAllAdmin() {
    const profesionales = await this.profesionalRepository.find({
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio'],
      order: { id_profesional: 'ASC' },
    });
    return profesionales.map((profesional) => this.mapAdmin(profesional));
  }

  async findOne(id: number) {
    const profesional = await this.profesionalRepository.findOne({
      where: { id_profesional: id },
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio'],
    });

    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }

    return this.mapAdmin(profesional);
  }

  async findMe(userId: number) {
    const profesional = await this.profesionalRepository.findOne({
      where: { usuario: { id_usuario: userId } },
      relations: ['usuario', 'horarios', 'horariosDestacados', 'profServicio', 'profServicio.servicio', 'turnos'],
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

    await this.usuarioRepository.save(profesional.usuario);
    await this.profesionalRepository.save(profesional);

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

  async remove(id: number) {
    const profesional = await this.profesionalRepository.findOne({ where: { id_profesional: id } });
    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }
    await this.profesionalRepository.remove(profesional);
    return { deleted: true };
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
      fecha_nacimiento: profesional.fecha_nacimiento,
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
      reserva: servicio.monto_reserva,
      visible_cliente: servicio.visible,
      categoria: null,
    };
  }
}
