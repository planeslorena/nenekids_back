import { IsEnum, IsOptional } from 'class-validator';
import { MedioPagoTurno } from '../entities/turno.entity';

export class UpdateAtencionTurnoDto {
  @IsOptional()
  @IsEnum(MedioPagoTurno)
  medio_pago?: MedioPagoTurno;
}
