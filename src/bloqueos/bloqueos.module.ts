import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { BloqueosController } from './bloqueos.controller';
import { BloqueosService } from './bloqueos.service';
import { Bloqueo } from './entities/bloqueo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bloqueo, Profesional])],
  controllers: [BloqueosController],
  providers: [BloqueosService],
})
export class BloqueosModule {}
