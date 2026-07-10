import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import dayjs from 'src/common/date.util';
import { Turno, TurnoStatus } from 'src/turnos/entities/turno.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Between, Repository } from 'typeorm';
import { WhatsappApiRequest } from './dto/whatsapp-api-request.dto';
import {
  WhatsappMessageLog,
  WhatsappMessageStatus,
  WhatsappMessageType,
} from './entities/whatsapp-message-log.entity';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly familyTemplateImageUrl = 'https://nj7sbuhsg7gmdxf6.public.blob.vercel-storage.com/log_pelunene.png';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(WhatsappMessageLog)
    private readonly logRepository: Repository<WhatsappMessageLog>,
    @InjectRepository(Turno)
    private readonly turnoRepository: Repository<Turno>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async sendTurnoConfirmation(turnoId: number) {
    await this.sendTurnoTemplate(turnoId, WhatsappMessageType.CONFIRMACION);
    await this.sendAdminTurnoConfirmation(turnoId);
  }

  async sendTurnoReminder(turnoId: number) {
    await this.sendTurnoTemplate(turnoId, WhatsappMessageType.RECORDATORIO);
  }

  async sendAdminTurnoConfirmation(turnoId: number) {
    const turno = await this.getTurnoWithRelations(turnoId);
    if (!turno || turno.estado !== TurnoStatus.CONFIRMADO) return;

    const templateName = this.getTemplateName(WhatsappMessageType.ADMIN_CONFIRMACION);
    if (!templateName) {
      this.logger.warn('Falta configurar WHATSAPP_ADMIN_CONFIRMATION_TEMPLATE');
      return;
    }

    const admins = await this.usuarioRepository.find({ where: { rol: 'ADMIN' } });
    const phones = Array.from(new Set(admins.map((admin) => this.formatPhone(admin.telefono)).filter(Boolean)));

    if (!phones.length) {
      this.logger.warn('No hay usuarios ADMIN con telefono valido para WhatsApp');
      return;
    }

    for (const phone of phones) {
      const request = this.prepareAdminConfirmationMessage(turno, phone, templateName);
      await this.sendAndLog(turno, WhatsappMessageType.ADMIN_CONFIRMACION, phone, templateName, request);
    }
  }

  @Cron('0 15 * * *', { timeZone: 'America/Argentina/Buenos_Aires' })
  async sendTomorrowReminders() {
    if (!this.isEnabled()) return;

    const tomorrow = dayjs().add(1, 'day');
    const turnos = await this.turnoRepository.find({
      where: {
        estado: TurnoStatus.CONFIRMADO,
        fechaHora: Between(tomorrow.startOf('day').toDate(), tomorrow.endOf('day').toDate()),
      },
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio', 'servicios_adicionales'],
      order: { fechaHora: 'ASC' },
    });

    for (const turno of turnos) {
      await this.sendTurnoReminder(turno.id_turno);
    }
  }

  async updateMessageStatus(messageId: string, status: string, timestamp: Date, errorDetails?: string) {
    if (!messageId) return;

    const knownStatuses = Object.values(WhatsappMessageStatus) as string[];
    if (!knownStatuses.includes(status)) {
      this.logger.warn(`Estado de WhatsApp desconocido: ${status}`);
      return;
    }

    const log = await this.logRepository.findOne({ where: { messageId } });
    if (!log) {
      this.logger.warn(`Log de WhatsApp no encontrado para message_id ${messageId}`);
      return;
    }

    log.status = status as WhatsappMessageStatus;
    log.statusAt = timestamp;
    if (errorDetails) log.errorDetails = errorDetails;

    await this.logRepository.save(log);
  }

  private async sendTurnoTemplate(turnoId: number, messageType: WhatsappMessageType.CONFIRMACION | WhatsappMessageType.RECORDATORIO) {
    const turno = await this.getTurnoWithRelations(turnoId);
    if (!turno || turno.estado !== TurnoStatus.CONFIRMADO) return;

    const templateName = this.getTemplateName(messageType);
    if (!templateName) {
      this.logger.warn(`Falta configurar template para ${messageType}`);
      return;
    }

    const recipientPhone = this.formatPhone(turno.cliente?.adulto?.telefono);
    if (!recipientPhone) {
      this.logger.warn(`Turno ${turnoId} sin telefono valido para WhatsApp`);
      return;
    }

    const request = this.prepareFamilyMessage(turno, recipientPhone, templateName);
    await this.sendAndLog(turno, messageType, recipientPhone, templateName, request);
  }

  private async sendAndLog(
    turno: Turno,
    messageType: WhatsappMessageType,
    recipientPhone: string,
    templateName: string,
    request: WhatsappApiRequest,
  ) {
    const existingLog = await this.logRepository.findOne({
      where: {
        turnoId: turno.id_turno,
        messageType,
        recipientPhone,
      },
    });
    if (existingLog) return;

    const log = await this.logRepository.save(
      this.logRepository.create({
        turnoId: turno.id_turno,
        messageType,
        status: this.canSend() ? WhatsappMessageStatus.PENDING : WhatsappMessageStatus.DISABLED,
        recipientPhone,
        templateName,
        sentAt: new Date(),
        errorDetails: this.canSend() ? null : this.getDisabledReason(),
      }),
    );

    if (!this.canSend()) return;

    try {
      const result = await this.sendMessage(request);
      log.messageId = result.messageId;
      log.status = WhatsappMessageStatus.SENT;
      log.statusAt = new Date();
      await this.logRepository.save(log);
    } catch (error: any) {
      log.status = WhatsappMessageStatus.FAILED;
      log.statusAt = new Date();
      log.errorDetails = this.getErrorDetails(error);
      await this.logRepository.save(log);
      this.logger.error(`Error enviando WhatsApp para turno ${turno.id_turno}: ${log.errorDetails}`);
    }
  }

  private async sendMessage(request: WhatsappApiRequest): Promise<{ success: boolean; to: string; messageId: string | null }> {
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const token = this.configService.get<string>('WHATSAPP_API_TOKEN');
    const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `WhatsApp API respondio ${response.status}`);
    }

    return {
      success: true,
      to: request.to,
      messageId: data?.messages?.[0]?.id || null,
    };
  }

  private getTurnoWithRelations(turnoId: number) {
    return this.turnoRepository.findOne({
      where: { id_turno: turnoId },
      relations: ['cliente', 'cliente.adulto', 'profesional', 'profesional.usuario', 'servicio', 'servicios_adicionales'],
    });
  }

  private prepareFamilyMessage(
    turno: Turno,
    recipientPhone: string,
    templateName: string,
  ): WhatsappApiRequest {
    const nino = turno.cliente?.nombre || 'Nene';
    const servicio = this.getServicioLabel(turno);
    const profesional = turno.profesional?.usuario?.nombre || 'Profesional asignado';
    const fecha = dayjs(turno.fechaHora).format('DD/MM/YYYY');
    const hora = dayjs(turno.fechaHora).format('HH:mm');
    const informacionServicio = turno.servicio?.descripcion?.trim() || 'Te compartiremos los detalles del servicio al llegar.';

    return this.prepareTemplateRequestWithImage(recipientPhone, templateName, this.familyTemplateImageUrl, [
      { type: 'text', text: nino },
      { type: 'text', text: fecha },
      { type: 'text', text: hora },
      { type: 'text', text: servicio },
      { type: 'text', text: profesional },
      { type: 'text', text: informacionServicio },
    ]);
  }

  private prepareAdminConfirmationMessage(turno: Turno, recipientPhone: string, templateName: string): WhatsappApiRequest {
    const nino = turno.cliente?.nombre || 'Nene';
    const telefono = turno.cliente?.adulto?.telefono?.toString() || 'Sin telefono';
    const servicio = this.getServicioLabel(turno);
    const profesional = turno.profesional?.usuario?.nombre || 'Profesional asignado';
    const fechaHora = dayjs(turno.fechaHora).format('DD/MM/YYYY HH:mm');
    const reserva = Number(turno.monto_reserva_total ?? turno.paymentAmount ?? turno.servicio?.monto_reserva ?? 0);

    return this.prepareTemplateRequest(recipientPhone, templateName, [
      { type: 'text', parameter_name: 'nino', text: nino },
      { type: 'text', parameter_name: 'turno', text: fechaHora },
      { type: 'text', parameter_name: 'telefono', text: telefono },
      { type: 'text', parameter_name: 'servicio', text: servicio },
      { type: 'text', parameter_name: 'profesional', text: profesional },
      { type: 'text', parameter_name: 'reserva', text: reserva > 0 ? `$${reserva}` : 'Sin reserva' },
    ]);
  }

  private prepareTemplateRequest(
    to: string,
    templateName: string,
    parameters: Extract<WhatsappApiRequest['template']['components'][number], { type: 'body' }>['parameters'],
  ): WhatsappApiRequest {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: this.configService.get<string>('WHATSAPP_TEMPLATE_LANGUAGE') || 'es_AR',
        },
        components: [{ type: 'body', parameters }],
      },
    };
  }

  private prepareTemplateRequestWithImage(
    to: string,
    templateName: string,
    imageUrl: string,
    parameters: Extract<WhatsappApiRequest['template']['components'][number], { type: 'body' }>['parameters'],
  ): WhatsappApiRequest {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: this.configService.get<string>('WHATSAPP_TEMPLATE_LANGUAGE') || 'es_AR',
        },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { link: imageUrl },
              },
            ],
          },
          { type: 'body', parameters },
        ],
      },
    };
  }

  private getTemplateName(messageType: WhatsappMessageType) {
    const keyByType = {
      [WhatsappMessageType.CONFIRMACION]: 'WHATSAPP_CONFIRMATION_TEMPLATE',
      [WhatsappMessageType.RECORDATORIO]: 'WHATSAPP_REMINDER_TEMPLATE',
      [WhatsappMessageType.ADMIN_CONFIRMACION]: 'WHATSAPP_ADMIN_CONFIRMATION_TEMPLATE',
    };

    return this.configService.get<string>(keyByType[messageType])?.trim();
  }

  private getServicioLabel(turno: Turno) {
    const adicionales = (turno.servicios_adicionales || []).map((servicio) => servicio.nombre);
    return [turno.servicio?.nombre || 'Servicio', ...adicionales].join(' + ');
  }

  private isEnabled() {
    return this.configService.get<string>('WHATSAPP_ENABLED') === 'true';
  }

  private canSend() {
    return Boolean(
      this.isEnabled()
      && this.configService.get<string>('WHATSAPP_API_TOKEN')
      && this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
    );
  }

  private getDisabledReason() {
    if (!this.isEnabled()) return 'WhatsApp deshabilitado por WHATSAPP_ENABLED';
    return 'Faltan WHATSAPP_API_TOKEN o WHATSAPP_PHONE_NUMBER_ID';
  }

  private formatPhone(phone?: number | string | null) {
    if (!phone) return null;

    let digits = phone.toString().replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('549')) return digits;
    if (digits.startsWith('54')) return `549${digits.slice(2)}`;
    if (digits.startsWith('0')) digits = digits.slice(1);
    return `549${digits}`;
  }

  private getErrorDetails(error: any) {
    return error?.message || 'Error desconocido enviando WhatsApp';
  }
}
