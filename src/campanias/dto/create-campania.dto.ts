import { IsString, IsUrl, Length, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
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
    return isDateOnly(fechaDesde) && isDateOnly(fechaHasta) && fechaHasta >= fechaDesde;
  }

  defaultMessage() {
    return 'La fecha hasta debe ser igual o posterior a la fecha desde.';
  }
}

export class CreateCampaniaDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  @IsUrl({ require_tld: false })
  imagen_url: string;

  @IsString()
  imagen_pathname: string;

  @IsString()
  @Validate(FechaDtoValidator)
  fecha_desde: string;

  @IsString()
  @Validate(FechaHastaValidator)
  fecha_hasta: string;
}
