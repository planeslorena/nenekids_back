import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { TurnosController } from './turnos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Turno } from './entities/turno.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { Horario } from 'src/profesionales/entities/horario.entity';
import { HorarioDestacado } from 'src/profesionales/entities/horario-destacado.entity';
import { Bloqueo } from 'src/bloqueos/entities/bloqueo.entity';
import { PagosModule } from 'src/pagos/pagos.module';
import { ProfesionalesModule } from 'src/profesionales/profesionales.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { ConfiguracionDisponibilidad } from './entities/configuracion-disponibilidad.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Turno, Cliente, Profesional, Servicio, Horario, HorarioDestacado, Bloqueo, ConfiguracionDisponibilidad]),
    PagosModule,
    ProfesionalesModule,
    WhatsappModule,
  ],
  controllers: [TurnosController],
  providers: [TurnosService],
})
export class TurnosModule { }
