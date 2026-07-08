import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateAdminTurnoDto } from './dto/create-admin-turno.dto';
import { CreateGrupoTurnoDto } from './dto/create-grupo-turno.dto';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateConfiguracionDisponibilidadDto } from './dto/update-configuracion-disponibilidad.dto';
import { UpdateReservaPagoDto } from './dto/update-reserva-pago.dto';
import { TurnosService } from './turnos.service';

@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  private parseIds(value?: string | string[]) {
    if (!value) return [];
    const values = Array.isArray(value) ? value : value.split(',');
    return values.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
  }

  @Get('dias-disponibles')
  getDiasDisponibles(
    @Query('id_profesional') idProfesional: string,
    @Query('id_servicio') idServicio: string,
    @Query('ids_servicios_adicionales') idsServiciosAdicionales?: string | string[],
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('cantidad') cantidad?: string,
  ) {
    return this.turnosService.getDiasDisponibles(
      +idProfesional,
      +idServicio,
      desde,
      hasta,
      cantidad ? Number(cantidad) : 1,
      this.parseIds(idsServiciosAdicionales),
    );
  }

  @Get('horarios-disponibles')
  getHorariosDisponibles(
    @Query('id_profesional') idProfesional: string,
    @Query('id_servicio') idServicio: string,
    @Query('ids_servicios_adicionales') idsServiciosAdicionales?: string | string[],
    @Query('fecha') fecha?: string,
    @Query('dia') dia?: string,
    @Query('cantidad') cantidad?: string,
  ) {
    return this.turnosService.getHorariosDisponibles(
      +idProfesional,
      +idServicio,
      fecha || dia,
      cantidad ? Number(cantidad) : 1,
      this.parseIds(idsServiciosAdicionales),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createTurnoDto: CreateTurnoDto, @Req() req) {
    return this.turnosService.create(createTurnoDto, req.user);
  }

  @Post('grupo')
  @UseGuards(JwtAuthGuard)
  createGrupo(@Body() createGrupoTurnoDto: CreateGrupoTurnoDto, @Req() req) {
    return this.turnosService.createGrupo(createGrupoTurnoDto, req.user);
  }

  @Get('mis-turnos')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req) {
    return this.turnosService.findMine(req.user.sub);
  }

  @Get(':id/estado-pago')
  @UseGuards(JwtAuthGuard)
  getEstadoPago(
    @Param('id') id: string,
    @Req() req,
    @Query('sincronizar') sincronizar?: string,
  ) {
    return this.turnosService.getEstadoPagoTurno(req.user, +id, sincronizar === 'true');
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findAll(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('id_profesional') idProfesional?: string,
  ) {
    return this.turnosService.findAllAdmin({
      desde,
      hasta,
      id_profesional: idProfesional ? Number(idProfesional) : undefined,
    });
  }

  @Get('admin/cancelados')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findCanceledAdmin(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('id_profesional') idProfesional?: string,
    @Query('estado_devolucion') estadoDevolucion?: string,
  ) {
    return this.turnosService.findCanceledAdmin({
      desde,
      hasta,
      id_profesional: idProfesional ? Number(idProfesional) : undefined,
      estado_devolucion: estadoDevolucion,
    });
  }

  @Get('configuracion-disponibilidad')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  getConfiguracionDisponibilidad() {
    return this.turnosService.getConfiguracionDisponibilidad();
  }

  @Patch('configuracion-disponibilidad')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  updateConfiguracionDisponibilidad(@Body() dto: UpdateConfiguracionDisponibilidadDto) {
    return this.turnosService.updateConfiguracionDisponibilidad(dto.cantidad_horarios_visibles);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  createAdmin(@Body() dto: CreateAdminTurnoDto) {
    return this.turnosService.createTurnoAdmin(dto);
  }

  @Patch('admin/:id/cancelar')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  cancelAdmin(@Param('id') id: string, @Req() req) {
    return this.turnosService.cancel(+id, req.user);
  }

  @Patch('admin/:id/pago-reserva')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  updateReservaPago(@Param('id') id: string, @Body() dto: UpdateReservaPagoDto) {
    return this.turnosService.updateReservaPagoAdmin(+id, dto.reserva_pagada);
  }

  @Patch('admin/:id/devolucion-reserva')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  markReservaRefunded(@Param('id') id: string) {
    return this.turnosService.markReservaRefundedAdmin(+id);
  }

  @Get('profesional')
  @UseGuards(JwtAuthGuard, new RolesGuard(['PROF']))
  findProfesional(
    @Req() req,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.turnosService.findProfesional(req.user.sub, { desde, hasta });
  }

  @Post('profesional')
  @UseGuards(JwtAuthGuard, new RolesGuard(['PROF']))
  createProfesional(@Body() dto: CreateAdminTurnoDto, @Req() req) {
    return this.turnosService.createTurnoProfesional(dto, req.user.sub);
  }

  @Patch(':id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @Req() req) {
    return this.turnosService.cancel(+id, req.user);
  }
}
