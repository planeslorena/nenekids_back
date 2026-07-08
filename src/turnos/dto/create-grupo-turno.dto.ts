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
  @IsArray()
  @IsInt({ each: true })
  ids_servicios_adicionales?: number[];

  @IsOptional()
  @IsString()
  observaciones?: string;
}
