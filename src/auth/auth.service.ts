import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(Usuario)
        private readonly usuarioRepository: Repository<Usuario>,
        private readonly jwtService: JwtService,
    ) { }

    async login(dni: number, codigo?: number) {
        const usuario = await this.usuarioRepository.findOneBy({ dni: dni, },);
        if (!usuario) {
            throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
        }

        // USER → entra directo
        if (usuario.rol === 'USER') {
            return {
                step: 'LOGGED',
                usuario,
                token: this.jwtService.sign({
                    sub: usuario.id_usuario,
                    rol: usuario.rol,
                }),
            };
        }

        // ADMIN / PROF → pedir código
        if (!codigo) {
            return { step: 'CODE_REQUIRED' };
        }

        if (usuario.codigo !== codigo) {
            throw new HttpException('Código inválido', HttpStatus.UNAUTHORIZED);
        }

        return {
            step: 'LOGGED',
            usuario,
            token: this.jwtService.sign({
                sub: usuario.id_usuario,
                rol: usuario.rol,
            }),
        };
    }
}
