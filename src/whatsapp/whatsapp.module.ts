import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Turno } from 'src/turnos/entities/turno.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { WhatsappMessageLog } from './entities/whatsapp-message-log.entity';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappMessageLog, Turno, Usuario])],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
