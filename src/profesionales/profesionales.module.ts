import { Module } from '@nestjs/common';
import { ProfesionalesService } from './profesionales.service';
import { ProfesionalesController } from './profesionales.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Horario } from './entities/horario.entity';
import { ProfServicio } from './entities/prof_servicio.entity';
import { Profesional } from './entities/profesional.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Horario, ProfServicio, Profesional])],
  controllers: [ProfesionalesController],
  providers: [ProfesionalesService],
})
export class ProfesionalesModule { }
