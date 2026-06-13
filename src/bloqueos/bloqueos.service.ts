import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { Between, Repository } from 'typeorm';
import { CreateBloqueoDto } from './dto/create-bloqueo.dto';
import { Bloqueo, TipoBloqueo } from './entities/bloqueo.entity';

@Injectable()
export class BloqueosService {
  constructor(
    @InjectRepository(Bloqueo)
    private readonly bloqueoRepository: Repository<Bloqueo>,
    @InjectRepository(Profesional)
    private readonly profesionalRepository: Repository<Profesional>,
  ) {}

  async findAll(params: { desde?: string; hasta?: string; id_profesional?: number } = {}) {
    const where: any = {};

    if (params.desde && params.hasta) {
      where.dia = Between(params.desde, params.hasta);
    }

    if (params.id_profesional) {
      where.profesional = { id_profesional: params.id_profesional };
    }

    const bloqueos = await this.bloqueoRepository.find({
      where,
      relations: ['profesional', 'profesional.usuario'],
      order: { dia: 'ASC', hora_inicio: 'ASC' },
    });

    return bloqueos.map((bloqueo) => this.serialize(bloqueo));
  }

  async create(dto: CreateBloqueoDto) {
    const profesional = await this.profesionalRepository.findOneBy({ id_profesional: dto.id_profesional });
    if (!profesional) {
      throw new NotFoundException('Profesional no encontrado');
    }
    const tipo = (dto.tipo || (dto.hora_inicio && dto.hora_fin ? TipoBloqueo.RANGO_HORARIO : TipoBloqueo.DIA_COMPLETO)) as TipoBloqueo;
    const entity = this.bloqueoRepository.create({
        dia: dto.fecha,
        hora_inicio: tipo === TipoBloqueo.RANGO_HORARIO ? dto.hora_inicio : undefined,
        hora_fin: tipo === TipoBloqueo.RANGO_HORARIO ? dto.hora_fin : undefined,
        motivo: dto.motivo,
        tipo,
        profesional,
      });
    const bloqueo = await this.bloqueoRepository.save(entity);

    return this.serialize(bloqueo);
  }

  async remove(id: number) {
    const bloqueo = await this.bloqueoRepository.findOneBy({ id_bloqueo: id });
    if (!bloqueo) {
      throw new NotFoundException('Bloqueo no encontrado');
    }
    await this.bloqueoRepository.remove(bloqueo);
    return { deleted: true };
  }

  private serialize(bloqueo: Bloqueo) {
    return {
      ...bloqueo,
      id: bloqueo.id_bloqueo,
      id_profesional: bloqueo.profesional?.id_profesional,
      fecha: bloqueo.dia,
    };
  }
}
