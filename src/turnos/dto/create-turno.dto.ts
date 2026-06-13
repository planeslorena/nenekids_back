import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTurnoDto {
  @IsString()
  fecha: string;

  @IsString()
  hora: string;

  @IsInt()
  id_cliente: number;

  @IsInt()
  id_profesional: number;

  @IsInt()
  id_servicio: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
