import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CampaniaTipo, CampaniaUbicacion } from '../entities/campania.entity';

function isDateOnly(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}

@ValidatorConstraint({ name: 'fechaDto', async: false })
export class FechaDtoValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    return isDateOnly(value);
  }

  defaultMessage() {
    return 'La fecha debe tener formato YYYY-MM-DD.';
  }
}

@ValidatorConstraint({ name: 'fechaHasta', async: false })
export class FechaHastaValidator implements ValidatorConstraintInterface {
  validate(fechaHasta: string, args: ValidationArguments) {
    const fechaDesde = (args.object as CreateCampaniaDto).fecha_desde;
    return (
      isDateOnly(fechaDesde) &&
      isDateOnly(fechaHasta) &&
      fechaHasta >= fechaDesde
    );
  }

  defaultMessage() {
    return 'La fecha hasta debe ser igual o posterior a la fecha desde.';
  }
}

export class CreateCampaniaDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsOptional()
  @IsIn(Object.values(CampaniaTipo))
  tipo?: CampaniaTipo;

  @ValidateIf((dto: CreateCampaniaDto) => dto.tipo !== CampaniaTipo.BANNER)
  @IsUrl({ require_tld: false })
  @IsString()
  @MaxLength(500)
  imagen_url?: string | null;

  @ValidateIf((dto: CreateCampaniaDto) => dto.tipo !== CampaniaTipo.BANNER)
  @IsString()
  @MaxLength(255)
  imagen_pathname?: string | null;

  @ValidateIf((dto: CreateCampaniaDto) => dto.tipo === CampaniaTipo.BANNER)
  @IsString()
  @Length(1, 300)
  texto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(\/(?!\/)|https?:\/\/).+/, {
    message: 'El enlace debe ser una ruta interna o una URL http/https.',
  })
  enlace?: string | null;

  @IsString()
  @Validate(FechaDtoValidator)
  fecha_desde: string;

  @IsString()
  @Validate(FechaHastaValidator)
  fecha_hasta: string;

  @IsOptional()
  @IsIn(Object.values(CampaniaUbicacion))
  ubicacion?: CampaniaUbicacion;
}
