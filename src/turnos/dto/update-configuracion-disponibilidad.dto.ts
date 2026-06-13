import { IsInt, Min } from 'class-validator';

export class UpdateConfiguracionDisponibilidadDto {
  @IsInt()
  @Min(1)
  cantidad_horarios_visibles: number;
}
