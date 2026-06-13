import { Body, Controller, Post } from '@nestjs/common';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('webhook')
  webhook(@Body() payload: unknown) {
    return this.pagosService.webhook(payload);
  }
}
