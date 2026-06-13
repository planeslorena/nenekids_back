import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async create(createUsuarioDto: CreateUsuarioDto) {
    const exists = await this.usuarioRepository.findOneBy({ dni: createUsuarioDto.dni });
    if (exists) {
      throw new ConflictException('Ya existe un usuario con ese DNI');
    }

    const usuario = this.usuarioRepository.create({
      ...createUsuarioDto,
      instagram: createUsuarioDto.instagram || '',
      rol: createUsuarioDto.rol || 'USER',
    });

    return this.usuarioRepository.save(usuario);
  }

  register(createUsuarioDto: CreateUsuarioDto) {
    return this.create({ ...createUsuarioDto, rol: 'USER' });
  }

  findAll() {
    return this.usuarioRepository.find({ relations: ['clientes'] });
  }

  findAdministradores() {
    return this.usuarioRepository.find({
      where: { rol: 'ADMIN' },
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id_usuario: id },
      relations: ['clientes'],
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    const usuario = await this.findOne(id);
    Object.assign(usuario, updateUsuarioDto);
    return this.usuarioRepository.save(usuario);
  }

  async remove(id: number) {
    const usuario = await this.findOne(id);
    await this.usuarioRepository.remove(usuario);
    return { deleted: true };
  }
}
