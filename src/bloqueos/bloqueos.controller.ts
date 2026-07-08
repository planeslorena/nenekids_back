import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { BloqueosService } from './bloqueos.service';
import { CreateBloqueoDto } from './dto/create-bloqueo.dto';

@Controller('bloqueos')
export class BloqueosController {
  constructor(private readonly bloqueosService: BloqueosService) {}

  @Get()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findAll(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('id_profesional') idProfesional?: string,
  ) {
    return this.bloqueosService.findAll({
      desde,
      hasta,
      id_profesional: idProfesional ? Number(idProfesional) : undefined,
    });
  }

  @Get('profesional')
  @UseGuards(JwtAuthGuard, new RolesGuard(['PROF']))
  findAllProfesional(
    @Req() req,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.bloqueosService.findAllForProfesional(req.user.sub, { desde, hasta });
  }

  @Post()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  create(@Body() dto: CreateBloqueoDto) {
    return this.bloqueosService.create(dto);
  }

  @Post('profesional')
  @UseGuards(JwtAuthGuard, new RolesGuard(['PROF']))
  createProfesional(@Body() dto: CreateBloqueoDto, @Req() req) {
    return this.bloqueosService.createForProfesional(dto, req.user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  remove(@Param('id') id: string) {
    return this.bloqueosService.remove(+id);
  }

  @Delete('profesional/:id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['PROF']))
  removeProfesional(@Param('id') id: string, @Req() req) {
    return this.bloqueosService.removeForProfesional(+id, req.user.sub);
  }
}
