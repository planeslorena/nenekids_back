import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUrl, Length, ValidateNested } from 'class-validator';

export class ServicioImagenDto {
  @IsUrl({ require_tld: false })
  url: string;

  @IsString()
  pathname: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsInt()
  orden?: number;
}

export class CreateServicioDto {
  @IsString()
  @Length(2, 50)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsInt()
  duracion: number;

  @IsInt()
  precio: number;

  @IsOptional()
  @IsInt()
  precio_transferencia?: number;

  @IsOptional()
  @IsInt()
  monto_reserva?: number;

  @IsOptional()
  @IsInt()
  reserva?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  visible_cliente?: boolean;

  @IsOptional()
  @IsBoolean()
  visible_como_complemento?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicioImagenDto)
  imagenes?: ServicioImagenDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  complementos_permitidos_ids?: number[];
}
