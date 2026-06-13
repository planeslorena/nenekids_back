import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';

class HorarioProfesionalDto {
  @IsInt()
  dia: number;

  @IsString()
  hora_inicio: string;

  @IsString()
  hora_fin: string;
}

class HorarioDestacadoDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  hora: string;

  @IsInt()
  @Min(1)
  orden: number;
}

export class CreateProfesionalDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsInt()
  dni?: number;

  @IsOptional()
  @IsString()
  mail?: string;

  @IsOptional()
  @IsInt()
  telefono?: number;

  @IsOptional()
  @IsInt()
  codigo?: number;

  @IsString()
  fecha_nacimiento: string;

  @IsOptional()
  @IsInt()
  id_usuario?: number;

  @IsOptional()
  @IsInt({ each: true })
  servicios?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioProfesionalDto)
  horarios?: HorarioProfesionalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioDestacadoDto)
  horarios_destacados?: HorarioDestacadoDto[];
}
