import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateBloqueoDto {
  @IsString()
  fecha: string;

  @IsOptional()
  @IsIn(['DIA_COMPLETO', 'RANGO_HORARIO'])
  tipo?: 'DIA_COMPLETO' | 'RANGO_HORARIO';

  @IsOptional()
  @IsString()
  hora_inicio?: string;

  @IsOptional()
  @IsString()
  hora_fin?: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsInt()
  id_profesional: number;
}
