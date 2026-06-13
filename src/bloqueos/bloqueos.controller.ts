import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { BloqueosService } from './bloqueos.service';
import { CreateBloqueoDto } from './dto/create-bloqueo.dto';

@Controller('bloqueos')
@UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
export class BloqueosController {
  constructor(private readonly bloqueosService: BloqueosService) {}

  @Get()
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

  @Post()
  create(@Body() dto: CreateBloqueoDto) {
    return this.bloqueosService.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bloqueosService.remove(+id);
  }
}
