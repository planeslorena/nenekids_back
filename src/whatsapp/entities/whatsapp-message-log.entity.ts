import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('whatsapp_message_logs')
export class WhatsappMessageLog {
  @PrimaryGeneratedColumn({ type: 'int' })
  public id_whatsapp_message_log: number;

  @Column({ name: 'telefono', length: 30, nullable: false })
  public telefono: string;

  @Column({ name: 'template', length: 100, nullable: true })
  public template?: string;

  @Column({ name: 'estado', length: 30, nullable: false })
  public estado: string;

  @Column({ name: 'payload', type: 'text', nullable: true })
  public payload?: string;

  @CreateDateColumn({ name: 'created_at' })
  public created_at: Date;
}
