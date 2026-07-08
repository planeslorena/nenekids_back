import { IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @Length(2, 50)
  nombre: string;

  @IsString()
  @Length(6, 20)
  @Matches(/^\d+$/, { message: 'El DNI del niño debe contener solo numeros' })
  dni: string;

  @IsString()
  fecha_nacimiento: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  foto_url?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  foto_pathname?: string;

  @IsOptional()
  @IsInt()
  id_usuario?: number;
}
