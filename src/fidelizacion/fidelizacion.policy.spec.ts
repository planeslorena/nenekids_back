import { BadRequestException } from '@nestjs/common';
import { BeneficioFidelizacion } from 'src/turnos/entities/turno.entity';
import { cicloVencido, estadoAlDecimoCorte, resolverBeneficioReserva } from './fidelizacion.policy';
import { EstadoCicloFidelizacion } from './entities/ciclo-fidelizacion.entity';

describe('politica de fidelizacion', () => {
  it('exige la decision del adulto para el quinto corte', () => {
    expect(() => resolverBeneficioReserva(4)).toThrow(BadRequestException);
  });

  it('vincula el descuento elegido sin aplicarlo', () => {
    expect(resolverBeneficioReserva(4, true)).toBe(BeneficioFidelizacion.DESCUENTO_50);
  });

  it('permite renunciar al descuento y continuar al decimo', () => {
    expect(resolverBeneficioReserva(4, false)).toBe(BeneficioFidelizacion.NINGUNO);
  });

  it('asigna automaticamente el corte gratis al decimo', () => {
    expect(resolverBeneficioReserva(9)).toBe(BeneficioFidelizacion.CORTE_GRATIS);
  });

  it('rechaza decisiones fuera del quinto corte', () => {
    expect(() => resolverBeneficioReserva(3, true)).toThrow(BadRequestException);
  });

  it('vence exactamente al cumplirse un anio calendario', () => {
    const vencimiento = new Date('2027-01-15T10:00:00-03:00');
    expect(cicloVencido(new Date('2027-01-15T09:59:59-03:00'), vencimiento)).toBe(false);
    expect(cicloVencido(new Date('2027-01-15T10:00:00-03:00'), vencimiento)).toBe(true);
  });

  it('cierra el decimo corte historico sin atribuir un beneficio', () => {
    expect(estadoAlDecimoCorte(BeneficioFidelizacion.NINGUNO, true)).toBe(EstadoCicloFidelizacion.CERRADO_SIN_BENEFICIO);
  });

  it('aplica gratuidad solo al decimo corte que la tenia asignada', () => {
    expect(estadoAlDecimoCorte(BeneficioFidelizacion.CORTE_GRATIS, false)).toBe(EstadoCicloFidelizacion.CERRADO_GRATIS);
    expect(estadoAlDecimoCorte(BeneficioFidelizacion.NINGUNO, false)).toBe(EstadoCicloFidelizacion.CERRADO_SIN_BENEFICIO);
  });
});
