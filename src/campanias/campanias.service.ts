import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { CreateCampaniaDto } from './dto/create-campania.dto';
import { UpdateCampaniaDto } from './dto/update-campania.dto';
import {
  Campania,
  CampaniaTipo,
  CampaniaUbicacion,
} from './entities/campania.entity';

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
        tipo: CampaniaTipo.FLYER,
        ubicacion,
        fecha_desde: LessThanOrEqual(today),
        fecha_hasta: MoreThanOrEqual(today),
      },
      order: { createdAt: 'DESC', id_campania: 'DESC' },
    });
  }

  findAnunciosActivos() {
    const today = this.todayArgentina();
    return this.campaniaRepository.find({
      where: {
        tipo: CampaniaTipo.BANNER,
        ubicacion: CampaniaUbicacion.HOME,
        fecha_desde: LessThanOrEqual(today),
        fecha_hasta: MoreThanOrEqual(today),
      },
      order: { createdAt: 'ASC', id_campania: 'ASC' },
    });
  }

  async create(dto: CreateCampaniaDto) {
    this.validateDateRange(dto.fecha_desde, dto.fecha_hasta);
    const values = this.normalizeByType({
      ...dto,
      tipo: dto.tipo ?? CampaniaTipo.FLYER,
      ubicacion: dto.ubicacion ?? CampaniaUbicacion.HOME,
    });
    const campania = this.campaniaRepository.create(values);
    return this.campaniaRepository.save(campania);
  }

  async update(id: number, dto: UpdateCampaniaDto) {
    const campania = await this.campaniaRepository.findOneBy({
      id_campania: id,
    });
    if (!campania) throw new NotFoundException('Campaña no encontrada');

    const fechaDesde = dto.fecha_desde ?? campania.fecha_desde;
    const fechaHasta = dto.fecha_hasta ?? campania.fecha_hasta;
    this.validateDateRange(fechaDesde, fechaHasta);

    const values = this.normalizeByType({ ...campania, ...dto });
    Object.assign(campania, values);
    return this.campaniaRepository.save(campania);
  }

  async remove(id: number) {
    const campania = await this.campaniaRepository.findOneBy({
      id_campania: id,
    });
    if (!campania) throw new NotFoundException('Campaña no encontrada');
    await this.campaniaRepository.remove(campania);
    return { deleted: true };
  }

  private validateDateRange(fechaDesde: string, fechaHasta: string) {
    if (fechaHasta < fechaDesde) {
      throw new BadRequestException(
        'La fecha hasta debe ser igual o posterior a la fecha desde.',
      );
    }
  }

  private normalizeByType(values: Partial<Campania>) {
    const tipo = values.tipo ?? CampaniaTipo.FLYER;
    if (tipo === CampaniaTipo.BANNER) {
      const texto = values.texto?.trim();
      if (!texto)
        throw new BadRequestException(
          'El texto es obligatorio para un banner.',
        );
      return {
        ...values,
        tipo,
        texto,
        enlace: values.enlace?.trim() || null,
        imagen_url: null,
        imagen_pathname: null,
        ubicacion: CampaniaUbicacion.HOME,
      };
    }

    if (!values.imagen_url || !values.imagen_pathname) {
      throw new BadRequestException('La imagen es obligatoria para un flyer.');
    }
    return {
      ...values,
      tipo,
      texto: null,
      enlace: null,
    };
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
