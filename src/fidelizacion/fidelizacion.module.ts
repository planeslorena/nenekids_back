import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Turno } from 'src/turnos/entities/turno.entity';
import { FidelizacionController } from './fidelizacion.controller';
import { FidelizacionService } from './fidelizacion.service';
import { CicloFidelizacion } from './entities/ciclo-fidelizacion.entity';
import { MovimientoFidelizacion } from './entities/movimiento-fidelizacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, Turno, CicloFidelizacion, MovimientoFidelizacion])],
  controllers: [FidelizacionController],
  providers: [FidelizacionService],
  exports: [FidelizacionService],
})
export class FidelizacionModule {}
