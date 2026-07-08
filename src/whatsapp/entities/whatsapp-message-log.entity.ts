import { Turno } from 'src/turnos/entities/turno.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum WhatsappMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  DISABLED = 'disabled',
}

export enum WhatsappMessageType {
  CONFIRMACION = 'CONFIRMACION',
  RECORDATORIO = 'RECORDATORIO',
  ADMIN_CONFIRMACION = 'ADMIN_CONFIRMACION',
}

@Entity('whatsapp_message_logs')
@Index('IDX_whatsapp_turno_tipo_telefono', ['turnoId', 'messageType', 'recipientPhone'], { unique: true })
export class WhatsappMessageLog {
  @PrimaryGeneratedColumn({ name: 'id_whatsapp_message_log', type: 'int' })
  public id_whatsapp_message_log: number;

  @Column({ name: 'message_id', type: 'varchar', length: 255, nullable: true })
  @Index('IDX_whatsapp_message_id')
  public messageId?: string | null;

  @Column({ name: 'turno_id', type: 'int' })
  public turnoId: number;

  @ManyToOne(() => Turno, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'turno_id' })
  public turno: Turno;

  @Column({ name: 'message_type', type: 'enum', enum: WhatsappMessageType })
  public messageType: WhatsappMessageType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: WhatsappMessageStatus,
    default: WhatsappMessageStatus.PENDING,
  })
  public status: WhatsappMessageStatus;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 30 })
  public recipientPhone: string;

  @Column({ name: 'template_name', type: 'varchar', length: 100 })
  public templateName: string;

  @Column({ name: 'sent_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public sentAt: Date;

  @Column({ name: 'status_at', type: 'datetime', nullable: true })
  public statusAt?: Date | null;

  @Column({ name: 'error_details', type: 'text', nullable: true })
  public errorDetails?: string | null;
}
