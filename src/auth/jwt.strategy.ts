import { ProfesionalesService } from '../profesionales/profesionales.service';
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from 'passport-jwt';


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly profesionalesService: ProfesionalesService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET no configurado');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.token,
      ]),
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (payload.rol === 'PROF') await this.profesionalesService.validarAcceso(payload.sub);
    return payload;
  }
}
