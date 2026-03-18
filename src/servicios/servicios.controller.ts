import { Controller } from '@nestjs/common';
import { ServiciosService } from './servicios.service';

@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}
}
