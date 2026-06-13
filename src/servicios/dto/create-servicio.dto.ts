import { IsBoolean, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateServicioDto {
  @IsString()
  @Length(2, 50)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsInt()
  duracion: number;

  @IsInt()
  precio: number;

  @IsOptional()
  @IsInt()
  monto_reserva?: number;

  @IsOptional()
  @IsInt()
  reserva?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  visible_cliente?: boolean;
}
