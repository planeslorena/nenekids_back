import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from 'passport-jwt';


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.token,
      ]),
      secretOrKey: process.env.JWT_SECRET || 'secret-key',
    });
  }

  async validate(payload: any) {
    return payload;
  }
}
