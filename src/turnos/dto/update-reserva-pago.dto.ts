import { IsBoolean } from 'class-validator';

export class UpdateReservaPagoDto {
  @IsBoolean()
  reserva_pagada: boolean;
}
