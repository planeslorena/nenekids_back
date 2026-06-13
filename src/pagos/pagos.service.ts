import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import MercadoPagoConfig, { Payment, Preference } from 'mercadopago';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { PaymentStatus, Turno, TurnoStatus } from 'src/turnos/entities/turno.entity';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { Repository } from 'typeorm';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Turno)
    private readonly turnoRepository: Repository<Turno>,
    private readonly whatsappService: WhatsappService,
  ) {}

  private getClient() {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new BadRequestException('Mercado Pago no esta configurado');
    }
    return new MercadoPagoConfig({ accessToken });
  }

  usarSandbox() {
    return this.configService.get<string>('MP_ACCESS_TOKEN')?.startsWith('TEST-') ?? false;
  }

  getCheckoutUrl(preferencia: { init_point?: string; sandbox_init_point?: string }) {
    return this.usarSandbox()
      ? preferencia.sandbox_init_point || preferencia.init_point
      : preferencia.init_point;
  }

  async crearPreferencia(turno: Turno, servicio: Servicio) {
    if (!servicio.monto_reserva || Number(servicio.monto_reserva) <= 0) {
      throw new BadRequestException('El servicio no requiere pago de reserva');
    }

    const preference = new Preference(this.getClient());
    const frontendUrl = this.getRequiredUrl('FRONTEND_URL');
    const backendUrl = this.getRequiredUrl('BACKEND_URL');

    return preference.create({
      body: {
        items: [{
          id: turno.id_turno.toString(),
          title: servicio.nombre,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: Number(servicio.monto_reserva),
        }],
        external_reference: turno.id_turno.toString(),
        back_urls: {
          success: `${frontendUrl}/turnos/pago/exitoso`,
          failure: `${frontendUrl}/turnos/pago/fallido`,
          pending: `${frontendUrl}/turnos/pago/pendiente`,
        },
        notification_url: `${backendUrl}/pagos/webhook`,
        payment_methods: { installments: 1 },
        statement_descriptor: 'NENE KIDS',
      },
    });
  }

  async crearPreferenciaGrupo(turnos: Turno[], servicio: Servicio, externalReference: string) {
    if (!servicio.monto_reserva || Number(servicio.monto_reserva) <= 0) {
      throw new BadRequestException('El servicio no requiere pago de reserva');
    }
    if (!turnos.length) {
      throw new BadRequestException('No hay turnos para generar la preferencia');
    }

    const preference = new Preference(this.getClient());
    const frontendUrl = this.getRequiredUrl('FRONTEND_URL');
    const backendUrl = this.getRequiredUrl('BACKEND_URL');

    return preference.create({
      body: {
        items: [{
          id: externalReference,
          title: `${servicio.nombre} x ${turnos.length}`,
          quantity: turnos.length,
          currency_id: 'ARS',
          unit_price: Number(servicio.monto_reserva),
        }],
        external_reference: externalReference,
        back_urls: {
          success: `${frontendUrl}/turnos/pago/exitoso`,
          failure: `${frontendUrl}/turnos/pago/fallido`,
          pending: `${frontendUrl}/turnos/pago/pendiente`,
        },
        notification_url: `${backendUrl}/pagos/webhook`,
        payment_methods: { installments: 1 },
        statement_descriptor: 'NENE KIDS',
      },
    });
  }

  async procesarPago(paymentId: string) {
    if (!paymentId) throw new BadRequestException('paymentId es requerido');

    const payment = new Payment(this.getClient());
    const data = await payment.get({ id: paymentId });
    const turnoId = data.external_reference ? String(data.external_reference) : '';
    if (!turnoId) {
      this.logger.warn(`Pago ${paymentId} sin external_reference`);
      return null;
    }

    if (turnoId.startsWith('grupo:')) {
      const turnos = await this.turnoRepository.find({ where: { externalReference: turnoId } });
      if (!turnos.length) throw new NotFoundException('Turnos asociados al pago no encontrados');

      const updated = turnos.map((turno) => {
        turno.mercadoPagoPaymentId = paymentId;
        if (data.status === 'approved') {
          turno.estado = TurnoStatus.CONFIRMADO;
          turno.paymentStatus = PaymentStatus.APROBADO;
          turno.paidAt = new Date();
        }
        if (['rejected', 'cancelled'].includes(data.status)) {
          turno.estado = TurnoStatus.CANCELADO;
          turno.paymentStatus = PaymentStatus.CANCELADO;
        }
        return turno;
      });

      const saved = await this.turnoRepository.save(updated);
      if (data.status === 'approved') {
        saved.forEach((turno) => void this.whatsappService.sendTurnoConfirmation(turno.id_turno));
      }
      return saved;
    }

    const turno = await this.turnoRepository.findOne({ where: { id_turno: Number(turnoId) } });
    if (!turno) throw new NotFoundException('Turno asociado al pago no encontrado');

    turno.mercadoPagoPaymentId = paymentId;
    if (data.status === 'approved') {
      turno.estado = TurnoStatus.CONFIRMADO;
      turno.paymentStatus = PaymentStatus.APROBADO;
      turno.paidAt = new Date();
      const saved = await this.turnoRepository.save(turno);
      void this.whatsappService.sendTurnoConfirmation(saved.id_turno);
      return saved;
    }

    if (['rejected', 'cancelled'].includes(data.status)) {
      turno.estado = TurnoStatus.CANCELADO;
      turno.paymentStatus = PaymentStatus.CANCELADO;
      return this.turnoRepository.save(turno);
    }

    return turno;
  }

  webhook(payload: any) {
    const paymentId = payload?.data?.id || payload?.id;
    if (paymentId) void this.procesarPago(String(paymentId));
    return { received: true };
  }

  private getRequiredUrl(key: string) {
    const value = this.configService.get<string>(key)?.trim().replace(/\/+$/, '');
    if (!value) throw new BadRequestException(`Falta configurar ${key}`);
    return value;
  }
}
