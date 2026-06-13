import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { Servicio } from './entities/servicio.entity';

@Injectable()
export class ServiciosService {
  constructor(
    @InjectRepository(Servicio)
    private readonly servicioRepository: Repository<Servicio>,
  ) {}

  create(createServicioDto: CreateServicioDto) {
    const servicio = this.servicioRepository.create({
      nombre: createServicioDto.nombre,
      descripcion: createServicioDto.descripcion || null,
      duracion: createServicioDto.duracion,
      precio: createServicioDto.precio,
      monto_reserva: createServicioDto.reserva ?? createServicioDto.monto_reserva ?? 0,
      visible: createServicioDto.visible_cliente ?? createServicioDto.visible ?? true,
    });
    return this.servicioRepository.save(servicio).then((saved) => this.serialize(saved));
  }

  async findAll(includeHidden = false) {
    const servicios = await this.servicioRepository.find({
      where: includeHidden ? {} : { visible: true },
      withDeleted: includeHidden,
      order: { nombre: 'ASC' },
    });
    return servicios.map((servicio) => this.serialize(servicio));
  }

  async findOne(id: number) {
    const servicio = await this.servicioRepository.findOneBy({ id_servicio: id });
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
      monto_reserva: updateServicioDto.reserva ?? updateServicioDto.monto_reserva ?? servicio.monto_reserva,
      visible: updateServicioDto.visible_cliente ?? updateServicioDto.visible ?? servicio.visible,
    });
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
      visible_cliente: servicio.visible,
      categoria: null,
    };
  }
}
