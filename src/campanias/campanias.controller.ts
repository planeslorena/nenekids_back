import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CampaniasService } from './campanias.service';
import { CreateCampaniaDto } from './dto/create-campania.dto';
import { UpdateCampaniaDto } from './dto/update-campania.dto';

@Controller('campanias')
export class CampaniasController {
  constructor(private readonly campaniasService: CampaniasService) {}

  @Get('activa')
  findActiva() {
    return this.campaniasService.findActiva();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findAllAdmin() {
    return this.campaniasService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  create(@Body() dto: CreateCampaniaDto) {
    return this.campaniasService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  update(@Param('id') id: string, @Body() dto: UpdateCampaniaDto) {
    return this.campaniasService.update(+id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  remove(@Param('id') id: string) {
    return this.campaniasService.remove(+id);
  }
}
