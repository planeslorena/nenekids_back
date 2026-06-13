import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappMessageLog } from './entities/whatsapp-message-log.entity';

@Injectable()
export class WhatsappService {
  constructor(
    @InjectRepository(WhatsappMessageLog)
    private readonly logRepository: Repository<WhatsappMessageLog>,
  ) {}

  async sendTemplate(telefono: string, template: string, payload: unknown) {
    const enabled = process.env.WHATSAPP_ENABLED === 'true' && !!process.env.WHATSAPP_API_TOKEN;
    const log = await this.logRepository.save(
      this.logRepository.create({
        telefono,
        template,
        estado: enabled ? 'PENDIENTE_ENVIO' : 'DESACTIVADO',
        payload: JSON.stringify(payload || {}),
      }),
    );

    return {
      enabled,
      log,
      message: enabled
        ? 'Envio registrado para integracion WhatsApp'
        : 'WhatsApp no esta habilitado en este entorno',
    };
  }

  async sendTurnoConfirmation(turnoId: number) {
    return this.sendTemplate('', 'turno_confirmado', { turnoId });
  }

  verify(query: any) {
    if (query['hub.verify_token'] && query['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
      return query['hub.challenge'];
    }
    return { verified: false };
  }

  webhook(payload: unknown) {
    return { received: true, payload };
  }
}
