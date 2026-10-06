import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { FidelizacionService } from './fidelizacion.service';

@Controller('fidelizacion')
@UseGuards(JwtAuthGuard)
export class FidelizacionController {
  constructor(private readonly fidelizacion: FidelizacionService) {}
  @Get('clientes/:id') estado(@Param('id') id: string, @Req() req) { return this.fidelizacion.estado(+id, req.user); }
  @Post('admin/carga-historica') @UseGuards(new RolesGuard(['ADMIN'])) cargarHistorico() { return this.fidelizacion.cargarHistorico(); }
  @Post('admin/acreditar') @UseGuards(new RolesGuard(['ADMIN'])) acreditar() { return this.fidelizacion.acreditarPendientes(); }
}
