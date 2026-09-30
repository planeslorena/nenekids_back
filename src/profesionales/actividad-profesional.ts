import { BadRequestException } from '@nestjs/common';
import dayjs, { nowArgentina } from '../common/date.util';

// DATETIME stores Argentina wall time, consistently with existing appointments.
export function fechaBajaLocal(
  value: Date | string | null | undefined,
): string | null {
  return value ? dayjs(value).format('YYYY-MM-DDTHH:mm:ss') : null;
}

export function resolverFechaBaja(fecha?: string): string {
  if (fecha !== undefined) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      !dayjs(fecha, 'YYYY-MM-DD', true).isValid() ||
      fecha < nowArgentina().format('YYYY-MM-DD')
    ) {
      throw new BadRequestException(
        'La fecha de baja debe ser valida y no anterior a hoy',
      );
    }
    return `${fecha}T00:00:00`;
  }
  return nowArgentina().format('YYYY-MM-DDTHH:mm:ss');
}

export function estadoActividad(baja: Date | string | null | undefined) {
  const fecha = fechaBajaLocal(baja);
  return !fecha
    ? 'ACTIVA'
    : fecha <= nowArgentina().format('YYYY-MM-DDTHH:mm:ss')
      ? 'INACTIVA'
      : 'BAJA_PROGRAMADA';
}

export function admiteReserva(
  baja: Date | string | null | undefined,
  fecha: string,
  hora = '23:59:59',
) {
  const limite = fechaBajaLocal(baja);
  return (
    !limite ||
    (estadoActividad(baja) !== 'INACTIVA' &&
      `${fecha}T${hora.length === 5 ? `${hora}:00` : hora}` < limite)
  );
}
