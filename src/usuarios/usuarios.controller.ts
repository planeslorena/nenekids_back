import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Post('register')
  register(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.register(createUsuarioDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get('administradores')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findAdministradores() {
    return this.usuariosService.findAdministradores();
  }

  @Post('administradores')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  createAdministrador(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create({ ...createUsuarioDto, rol: 'ADMIN' });
  }

  @Patch('administradores/:id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  updateAdministrador(@Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    return this.usuariosService.update(+id, { ...updateUsuarioDto, rol: 'ADMIN' });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  update(@Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    return this.usuariosService.update(+id, updateUsuarioDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(+id);
  }

  @Delete('administradores/:id')
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  removeAdministrador(@Param('id') id: string) {
    return this.usuariosService.remove(+id);
  }
}
