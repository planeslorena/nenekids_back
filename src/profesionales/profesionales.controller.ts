import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { ProfesionalesService } from './profesionales.service';

@Controller('profesionales')
export class ProfesionalesController {
  constructor(private readonly profesionalesService: ProfesionalesService) {}

  @Get()
  findAll() {
    return this.profesionalesService.findAllWithServicios();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findAllAdmin() {
    return this.profesionalesService.findAllAdmin();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, new RolesGuard(['PROF']))
  findMe(@Req() req) {
    return this.profesionalesService.findMe(req.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, new RolesGuard(['PROF']))
  updateMe(@Req() req, @Body() createProfesionalDto: CreateProfesionalDto) {
    return this.profesionalesService.updateMe(req.user.sub, createProfesionalDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profesionalesService.findOne(+id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  create(@Body() createProfesionalDto: CreateProfesionalDto) {
    return this.profesionalesService.create(createProfesionalDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  update(@Param('id') id: string, @Body() createProfesionalDto: CreateProfesionalDto) {
    return this.profesionalesService.update(+id, createProfesionalDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  remove(@Param('id') id: string) {
    return this.profesionalesService.remove(+id);
  }

  @Post('horarios')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  createHorario(@Body() createHorarioDto: CreateHorarioDto) {
    return this.profesionalesService.createHorario(createHorarioDto);
  }
}
