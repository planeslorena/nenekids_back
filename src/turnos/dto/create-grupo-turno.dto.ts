import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateGrupoTurnoDto {
  @IsString()
  fecha: string;

  @IsString()
  hora: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsInt({ each: true })
  id_clientes: number[];

  @IsInt()
  id_profesional: number;

  @IsInt()
  id_servicio: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
