import { Controller } from '@nestjs/common';
import { TurnosService } from './turnos.service';

@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}
}
