import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Not, Repository } from 'typeorm';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { Cliente } from './entities/cliente.entity';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async create(createClienteDto: CreateClienteDto, user: any) {
    const responsableId =
      user?.rol === 'ADMIN' && createClienteDto.id_usuario ? createClienteDto.id_usuario : user?.sub;

    const adulto = await this.usuarioRepository.findOneBy({ id_usuario: responsableId });
    if (!adulto) {
      throw new NotFoundException('Adulto responsable no encontrado');
    }

    await this.validateDniDisponible(createClienteDto.dni, adulto.id_usuario);

    const cliente = this.clienteRepository.create({
      nombre: createClienteDto.nombre,
      dni: createClienteDto.dni,
      fecha_nacimiento: createClienteDto.fecha_nacimiento,
      observaciones: createClienteDto.observaciones,
      foto_url: createClienteDto.foto_url,
      foto_pathname: createClienteDto.foto_pathname,
      adulto,
    });

    return this.clienteRepository.save(cliente);
  }

  async findAll() {
    const clientes = await this.clienteRepository.find({
      relations: ['adulto', 'turnos', 'turnos.servicio', 'turnos.profesional'],
      order: { id_cliente: 'DESC' },
    });
    return clientes.map((cliente) => this.serialize(cliente));
  }

  async findMine(userId: number) {
    const clientes = await this.clienteRepository.find({
      where: { adulto: { id_usuario: userId } },
      relations: ['turnos', 'turnos.servicio', 'turnos.profesional'],
      order: { id_cliente: 'DESC' },
    });
    return clientes.map((cliente) => this.serialize(cliente));
  }

  async findOne(id: number, user?: any) {
    const cliente = await this.findEntity(id, user);
    return this.serialize(cliente);
  }

  async update(id: number, updateClienteDto: UpdateClienteDto, user: any) {
    const cliente = await this.findEntity(id, user);

    if (updateClienteDto.dni && updateClienteDto.dni !== cliente.dni) {
      await this.validateDniDisponible(updateClienteDto.dni, cliente.adulto.id_usuario, cliente.id_cliente);
    }

    Object.assign(cliente, {
      nombre: updateClienteDto.nombre ?? cliente.nombre,
      dni: updateClienteDto.dni ?? cliente.dni,
      fecha_nacimiento: updateClienteDto.fecha_nacimiento ?? cliente.fecha_nacimiento,
      observaciones: updateClienteDto.observaciones ?? cliente.observaciones,
      foto_url: updateClienteDto.foto_url ?? cliente.foto_url,
      foto_pathname: updateClienteDto.foto_pathname ?? cliente.foto_pathname,
    });
    return this.clienteRepository.save(cliente).then((saved) => this.serialize(saved));
  }

  async remove(id: number, user: any) {
    const cliente = await this.findEntity(id, user);
    await this.clienteRepository.remove(cliente);
    return { deleted: true };
  }

  private serialize(cliente: Cliente) {
    return {
      ...cliente,
      usuario: cliente.adulto,
    };
  }

  private async validateDniDisponible(dni: string, responsableId: number, excludeClienteId?: number) {
    const existente = await this.clienteRepository.findOne({
      where: {
        dni,
        ...(excludeClienteId ? { id_cliente: Not(excludeClienteId) } : {}),
      },
      relations: ['adulto'],
    });

    if (!existente) return;

    if (existente.adulto?.id_usuario === responsableId) {
      throw new ConflictException('Ya cargaste un niño con ese DNI');
    }

    throw new ConflictException('Ya existe un niño registrado con ese DNI');
  }

  private async findEntity(id: number, user?: any) {
    const cliente = await this.clienteRepository.findOne({
      where: { id_cliente: id },
      relations: ['adulto', 'turnos', 'turnos.servicio', 'turnos.profesional'],
    });

    if (!cliente) {
      throw new NotFoundException('Nino no encontrado');
    }

    if (user?.rol === 'USER' && cliente.adulto?.id_usuario !== user.sub) {
      throw new ForbiddenException('No podes acceder a datos de otro responsable');
    }

    return cliente;
  }
}
