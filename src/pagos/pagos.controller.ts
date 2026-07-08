import { Body, Controller, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('webhook')
  async webhook(
    @Body() body: any,
    @Query('data.id') dataId?: string,
    @Query('id') id?: string,
    @Query('type') type?: string,
    @Query('topic') topic?: string,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    const eventType = body?.type || type || topic;
    const paymentId = body?.data?.id || dataId || id;

    if (eventType === 'payment' && paymentId) {
      const signatureValida = this.pagosService.validarWebhookSignature({
        dataId: dataId || String(paymentId),
        xRequestId,
        xSignature,
      });

      if (!signatureValida) {
        throw new UnauthorizedException('Firma de Mercado Pago invalida');
      }

      await this.pagosService.procesarPago(String(paymentId));
    }

    return { ok: true };
  }
}
