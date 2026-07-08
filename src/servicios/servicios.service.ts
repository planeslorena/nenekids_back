import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { Servicio } from './entities/servicio.entity';

@Injectable()
export class ServiciosService {
  constructor(
    @InjectRepository(Servicio)
    private readonly servicioRepository: Repository<Servicio>,
  ) {}

  async create(createServicioDto: CreateServicioDto) {
    const servicio = this.servicioRepository.create({
      nombre: createServicioDto.nombre,
      descripcion: createServicioDto.descripcion || null,
      duracion: createServicioDto.duracion,
      precio: createServicioDto.precio,
      precio_transferencia: createServicioDto.precio_transferencia ?? createServicioDto.precio,
      monto_reserva: createServicioDto.reserva ?? createServicioDto.monto_reserva ?? 0,
      visible: createServicioDto.visible_cliente ?? createServicioDto.visible ?? true,
      visible_como_complemento: createServicioDto.visible_como_complemento ?? false,
      imagenes: this.normalizeImagenes(createServicioDto.imagenes),
    });
    servicio.complementos_permitidos = await this.resolveComplementos(createServicioDto.complementos_permitidos_ids);
    return this.servicioRepository.save(servicio).then((saved) => this.serialize(saved));
  }

  async findAll(includeHidden = false) {
    const servicios = await this.servicioRepository.find({
      where: includeHidden ? {} : { visible: true },
      withDeleted: includeHidden,
      relations: ['complementos_permitidos'],
      order: { nombre: 'ASC' },
    });
    return servicios.map((servicio) => this.serialize(servicio));
  }

  async findOne(id: number) {
    const servicio = await this.servicioRepository.findOne({
      where: { id_servicio: id },
      relations: ['complementos_permitidos'],
    });
    if (!servicio) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return servicio;
  }

  async update(id: number, updateServicioDto: UpdateServicioDto) {
    const servicio = await this.findOne(id);
    Object.assign(servicio, {
      nombre: updateServicioDto.nombre ?? servicio.nombre,
      descripcion: updateServicioDto.descripcion ?? servicio.descripcion,
      duracion: updateServicioDto.duracion ?? servicio.duracion,
      precio: updateServicioDto.precio ?? servicio.precio,
      precio_transferencia: updateServicioDto.precio_transferencia ?? servicio.precio_transferencia,
      monto_reserva: updateServicioDto.reserva ?? updateServicioDto.monto_reserva ?? servicio.monto_reserva,
      visible: updateServicioDto.visible_cliente ?? updateServicioDto.visible ?? servicio.visible,
      visible_como_complemento: updateServicioDto.visible_como_complemento ?? servicio.visible_como_complemento,
      imagenes: updateServicioDto.imagenes === undefined ? servicio.imagenes : this.normalizeImagenes(updateServicioDto.imagenes),
    });
    if (updateServicioDto.complementos_permitidos_ids !== undefined) {
      servicio.complementos_permitidos = await this.resolveComplementos(updateServicioDto.complementos_permitidos_ids, id);
    }
    return this.servicioRepository.save(servicio).then((saved) => this.serialize(saved));
  }

  async remove(id: number) {
    const servicio = await this.findOne(id);
    return this.servicioRepository.softRemove(servicio).then((saved) => this.serialize(saved));
  }

  private serialize(servicio: Servicio) {
    return {
      ...servicio,
      reserva: servicio.monto_reserva,
      precio_efectivo: servicio.precio,
      precio_transferencia: servicio.precio_transferencia ?? servicio.precio,
      visible_cliente: servicio.visible,
      visible_como_complemento: servicio.visible_como_complemento,
      imagenes: servicio.imagenes || [],
      complementos_permitidos: (servicio.complementos_permitidos || [])
        .filter((complemento) => complemento.visible_como_complemento)
        .map((complemento) => this.serializeBasic(complemento)),
      complementos_permitidos_ids: (servicio.complementos_permitidos || [])
        .filter((complemento) => complemento.visible_como_complemento)
        .map((complemento) => complemento.id_servicio),
      categoria: null,
    };
  }

  private serializeBasic(servicio: Servicio) {
    return {
      id_servicio: servicio.id_servicio,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      duracion: servicio.duracion,
      precio: servicio.precio,
      precio_efectivo: servicio.precio,
      precio_transferencia: servicio.precio_transferencia ?? servicio.precio,
      reserva: servicio.monto_reserva,
      monto_reserva: servicio.monto_reserva,
      visible_cliente: servicio.visible,
      visible_como_complemento: servicio.visible_como_complemento,
      imagenes: servicio.imagenes || [],
      categoria: null,
    };
  }

  private normalizeImagenes(imagenes?: CreateServicioDto['imagenes']) {
    return (imagenes || [])
      .filter((imagen) => imagen.url && imagen.pathname)
      .map((imagen, index) => ({
        url: imagen.url,
        pathname: imagen.pathname,
        alt: imagen.alt || undefined,
        orden: imagen.orden ?? index,
      }));
  }

  private async resolveComplementos(ids?: number[], selfId?: number) {
    if (!ids?.length) return [];

    const uniqueIds = Array.from(new Set(ids.map(Number).filter(Boolean)));
    if (uniqueIds.length !== ids.length) {
      throw new BadRequestException('No se pueden repetir complementos');
    }
    if (selfId && uniqueIds.includes(selfId)) {
      throw new BadRequestException('Un servicio no puede ser complemento de si mismo');
    }

    const complementos = await this.servicioRepository.find({
      where: { id_servicio: In(uniqueIds), visible_como_complemento: true },
      order: { nombre: 'ASC' },
    });
    if (complementos.length !== uniqueIds.length) {
      throw new NotFoundException('Uno o mas complementos no fueron encontrados');
    }

    return uniqueIds.map((id) => complementos.find((servicio) => servicio.id_servicio === id)!);
  }
}
