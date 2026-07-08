import { Body, Controller, Get, Logger, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller(['webhook', 'whatsapp/webhook'])
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get()
  verifyWebhook(@Query() query: any, @Res() res: Response) {
    const verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN')
      || this.configService.get<string>('WHATSAPP_API_TOKEN');
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (!verifyToken) {
      this.logger.warn('Webhook de WhatsApp sin token de verificacion configurado');
      return res.status(403).send('WHATSAPP_VERIFY_TOKEN o WHATSAPP_API_TOKEN no configurado');
    }

    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }

    this.logger.warn(`Verificacion invalida de webhook de WhatsApp: mode=${mode || 'sin_modo'}`);
    return res.status(403).send('Token invalido');
  }

  @Post()
  receiveUpdates(@Body() body: any, @Res() res: Response) {
    if (body.object !== 'whatsapp_business_account') {
      return res.status(400).send('Evento no valido');
    }

    res.status(200).json({ received: true });

    this.processWebhookEvent(body).catch((error) => {
      this.logger.error('Error procesando webhook de WhatsApp', error);
    });
  }

  private async processWebhookEvent(body: any) {
    if (!Array.isArray(body.entry)) return;

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        const statuses = change.value?.statuses;
        if (!Array.isArray(statuses)) continue;

        for (const status of statuses) {
          let errorDetails: string | undefined;

          if (status.status === 'failed' && status.errors?.length) {
            const error = status.errors[0];
            errorDetails = [
              error.code ? `Code: ${error.code}` : null,
              error.title ? `Title: ${error.title}` : null,
              error.details ? `Details: ${error.details}` : null,
            ].filter(Boolean).join(' | ');
          }

          await this.whatsappService.updateMessageStatus(
            status.id,
            status.status,
            new Date(Number(status.timestamp) * 1000),
            errorDetails,
          );
        }
      }
    }
  }
}
