import { IsInt, IsString } from 'class-validator';

export class CreateHorarioDto {
  @IsString()
  dia: string;

  @IsString()
  hora_inicio: string;

  @IsString()
  hora_fin: string;

  @IsInt()
  id_profesional: number;
}
