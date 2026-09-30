import { IsOptional, IsString, Matches } from 'class-validator';

export class BajaProfesionalDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha_desde?: string;
}
