import { IsEmail, IsIn, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateUsuarioDto {
  @IsInt()
  dni: number;

  @IsString()
  @Length(2, 50)
  nombre: string;

  @IsEmail()
  mail: string;

  @IsInt()
  telefono: number;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN', 'PROF'])
  rol?: string;

  @IsOptional()
  @IsInt()
  codigo?: number;
}
