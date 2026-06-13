import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly roles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const rol = request.user?.rol;

    if (rol && this.roles.includes(rol)) {
      return true;
    }

    throw new ForbiddenException('No tenes permisos para realizar esta accion');
  }
}
