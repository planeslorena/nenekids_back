import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { TurnosController } from './turnos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Turno } from './entities/turno.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Turno])],
  controllers: [TurnosController],
  providers: [TurnosService],
})
export class TurnosModule { }
