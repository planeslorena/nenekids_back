import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { ServiciosService } from './servicios.service';

@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  @Get()
  findAll(@Query('admin') admin?: string) {
    return this.serviciosService.findAll(admin === 'true');
  }

  @Post()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  create(@Body() createServicioDto: CreateServicioDto) {
    return this.serviciosService.create(createServicioDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  update(@Param('id') id: string, @Body() updateServicioDto: UpdateServicioDto) {
    return this.serviciosService.update(+id, updateServicioDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  remove(@Param('id') id: string) {
    return this.serviciosService.remove(+id);
  }
}
