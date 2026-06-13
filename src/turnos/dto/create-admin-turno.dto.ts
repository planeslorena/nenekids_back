import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAdminTurnoDto {
  @IsInt()
  id_cliente: number;

  @IsInt()
  id_profesional: number;

  @IsInt()
  id_servicio: number;

  @IsString()
  fecha: string;

  @IsString()
  hora: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  forzar_fuera_horario?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmar_sobreturno?: boolean;

  @IsOptional()
  @IsBoolean()
  reserva_pagada?: boolean;
}
