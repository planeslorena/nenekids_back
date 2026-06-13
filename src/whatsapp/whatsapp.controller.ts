import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller()
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  verifyWebhook(@Query() query: any) {
    return this.whatsappService.verify(query);
  }

  @Post('webhook')
  webhook(@Body() payload: unknown) {
    return this.whatsappService.webhook(payload);
  }

  @Get('whatsapp/webhook')
  verifyWhatsappWebhook(@Query() query: any) {
    return this.whatsappService.verify(query);
  }

  @Post('whatsapp/webhook')
  whatsappWebhook(@Body() payload: unknown) {
    return this.whatsappService.webhook(payload);
  }
}
