import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createClienteDto: CreateClienteDto, @Req() req) {
    return this.clientesService.create(createClienteDto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, new RolesGuard(['ADMIN']))
  findAll() {
    return this.clientesService.findAll();
  }

  @Get('mis-ninos')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req) {
    return this.clientesService.findMine(req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Req() req) {
    return this.clientesService.findOne(+id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateClienteDto: UpdateClienteDto, @Req() req) {
    return this.clientesService.update(+id, updateClienteDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Req() req) {
    return this.clientesService.remove(+id, req.user);
  }
}
