import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getAuthCookieOptions(): CookieOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    const sameSite = (process.env.COOKIE_SAME_SITE as CookieOptions['sameSite']) || (isProduction ? 'none' : 'lax');
    const domain = process.env.COOKIE_DOMAIN || undefined;

    return {
      httpOnly: true,
      sameSite,
      secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  @Post('login')
  async login(
    @Body() body: { dni: number; codigo?: number },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.dni, body.codigo);

    if (result.step === 'LOGGED') {
      res.cookie('token', result.token, this.getAuthCookieOptions());
    }

    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req) {
    return this.authService.getCurrentUser(req.user.sub);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', this.getAuthCookieOptions());
    return { loggedOut: true };
  }
}
