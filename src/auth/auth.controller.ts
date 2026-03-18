import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  //Trae los datos del cliente por DNI
  @Post('login')
  async login(
    @Body() body: { dni: number; codigo?: number },
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.login(body.dni, body.codigo);

    if (result.step === 'LOGGED') {
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // true en producción
        path: '/',
      });
    }

    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req) {
    return req.user;
  }


}
