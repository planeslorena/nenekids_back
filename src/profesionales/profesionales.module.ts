import { Module } from '@nestjs/common';
import { ProfesionalesService } from './profesionales.service';
import { ProfesionalesController } from './profesionales.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Horario } from './entities/horario.entity';
import { HorarioDestacado } from './entities/horario-destacado.entity';
import { ProfServicio } from './entities/prof_servicio.entity';
import { Profesional } from './entities/profesional.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Horario, HorarioDestacado, ProfServicio, Profesional, Usuario, Servicio])],
  controllers: [ProfesionalesController],
  providers: [ProfesionalesService],
  exports: [ProfesionalesService],
})
export class ProfesionalesModule { }
