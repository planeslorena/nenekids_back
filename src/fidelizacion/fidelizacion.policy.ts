import { BadRequestException } from '@nestjs/common';
import dayjs from 'src/common/date.util';
import { BeneficioFidelizacion } from 'src/turnos/entities/turno.entity';
import { EstadoCicloFidelizacion } from './entities/ciclo-fidelizacion.entity';

export function resolverBeneficioReserva(cortes: number, usar50?: boolean) {
  if (cortes === 4 && usar50 === undefined) throw new BadRequestException('Debes indicar si deseas usar el beneficio del 50%');
  if (cortes !== 4 && usar50 !== undefined) throw new BadRequestException('La eleccion del 50% solo corresponde al quinto corte');
  if (cortes === 9) return BeneficioFidelizacion.CORTE_GRATIS;
  if (cortes === 4 && usar50) return BeneficioFidelizacion.DESCUENTO_50;
  return BeneficioFidelizacion.NINGUNO;
}

export function cicloVencido(fechaTurno: Date, fechaVencimiento: Date) {
  return !dayjs(fechaTurno).isBefore(dayjs(fechaVencimiento));
}

export function estadoAlDecimoCorte(beneficio: BeneficioFidelizacion, cargaHistorica: boolean) {
  return !cargaHistorica && beneficio === BeneficioFidelizacion.CORTE_GRATIS
    ? EstadoCicloFidelizacion.CERRADO_GRATIS
    : EstadoCicloFidelizacion.CERRADO_SIN_BENEFICIO;
}
