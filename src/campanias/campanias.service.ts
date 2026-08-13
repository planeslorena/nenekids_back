import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { CreateCampaniaDto } from './dto/create-campania.dto';
import { UpdateCampaniaDto } from './dto/update-campania.dto';
import { Campania, CampaniaUbicacion } from './entities/campania.entity';

@Injectable()
export class CampaniasService {
  constructor(
    @InjectRepository(Campania)
    private readonly campaniaRepository: Repository<Campania>,
  ) {}

  findAllAdmin() {
    return this.campaniaRepository.find({
      order: { createdAt: 'DESC', id_campania: 'DESC' },
    });
  }

  findActiva(ubicacion: CampaniaUbicacion = CampaniaUbicacion.HOME) {
    const today = this.todayArgentina();
    return this.campaniaRepository.findOne({
      where: {
        ubicacion,
        fecha_desde: LessThanOrEqual(today),
        fecha_hasta: MoreThanOrEqual(today),
      },
      order: { createdAt: 'DESC', id_campania: 'DESC' },
    });
  }

  async create(dto: CreateCampaniaDto) {
    this.validateDateRange(dto.fecha_desde, dto.fecha_hasta);
    const campania = this.campaniaRepository.create({
      ...dto,
      ubicacion: dto.ubicacion ?? CampaniaUbicacion.HOME,
    });
    return this.campaniaRepository.save(campania);
  }

  async update(id: number, dto: UpdateCampaniaDto) {
    const campania = await this.campaniaRepository.findOneBy({ id_campania: id });
    if (!campania) throw new NotFoundException('Campaña no encontrada');

    const fechaDesde = dto.fecha_desde ?? campania.fecha_desde;
    const fechaHasta = dto.fecha_hasta ?? campania.fecha_hasta;
    this.validateDateRange(fechaDesde, fechaHasta);

    Object.assign(campania, dto);
    return this.campaniaRepository.save(campania);
  }

  async remove(id: number) {
    const campania = await this.campaniaRepository.findOneBy({ id_campania: id });
    if (!campania) throw new NotFoundException('Campaña no encontrada');
    await this.campaniaRepository.remove(campania);
    return { deleted: true };
  }

  private validateDateRange(fechaDesde: string, fechaHasta: string) {
    if (fechaHasta < fechaDesde) {
      throw new BadRequestException('La fecha hasta debe ser igual o posterior a la fecha desde.');
    }
  }

  private todayArgentina() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}
