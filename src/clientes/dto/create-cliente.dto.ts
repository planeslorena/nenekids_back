import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @Length(2, 50)
  nombre: string;

  @IsString()
  fecha_nacimiento: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsInt()
  id_usuario?: number;
}
