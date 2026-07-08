import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from 'passport-jwt';


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
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
    return payload;
  }
}
