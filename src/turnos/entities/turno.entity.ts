import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum TurnoStatus {
    PENDIENTE_PAGO = 'PENDIENTE_PAGO',
    CONFIRMADO = 'CONFIRMADO',
    CANCELADO = 'CANCELADO',
}

export enum PaymentStatus {
    NO_REQUIERE = 'NO_REQUIERE',
    PENDIENTE = 'PENDIENTE',
    APROBADO = 'APROBADO',
    CANCELADO = 'CANCELADO',
}

@Entity('turnos')
export class Turno {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_turno: number;

    @Column({
        name: 'dia',
        type: 'varchar',
        nullable: true,
    })
    public dia?: string;

    @Column({
        name: 'hora',
        type: 'varchar',
        nullable: true,
    })
    public hora?: string;

    @Column({ name: 'fechaHora', type: 'datetime', nullable: true })
    public fechaHora: Date;

    @Column({
        name: 'estado',
        type: 'enum',
        enum: TurnoStatus,
        default: TurnoStatus.CONFIRMADO,
    })
    public estado: TurnoStatus;

    @Column({
        name: 'estado_pago',
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.NO_REQUIERE,
    })
    public paymentStatus: PaymentStatus;

    @Column({ name: 'mercadoPagoPaymentId', nullable: true })
    public mercadoPagoPaymentId?: string;

    @Column({ name: 'mercadoPagoPreferenceId', nullable: true })
    public mercadoPagoPreferenceId?: string;

    @Column({ name: 'mercadoPagoInitPoint', type: 'text', nullable: true })
    public mercadoPagoInitPoint?: string;

    @Column({ name: 'externalReference', nullable: true })
    public externalReference?: string;

    @Column({ name: 'paymentAmount', type: 'int', nullable: true })
    public paymentAmount?: number;

    @Column({ name: 'paidAt', type: 'datetime', nullable: true })
    public paidAt?: Date;

    @Column({ name: 'paymentExpiresAt', type: 'datetime', nullable: true })
    public paymentExpiresAt?: Date;

    @Column({
        name: 'observaciones',
        type: 'text',
        nullable: true,
    })
    public observaciones?: string;

    @CreateDateColumn()
    public createdAt: Date;

    @ManyToOne(() => Cliente, (cliente) => cliente.turnos)
    @JoinColumn({ name: 'id_cliente' })
    public cliente: Cliente;

    @ManyToOne(() => Profesional, (profesional) => profesional.turnos)
    @JoinColumn({ name: 'id_profesional' })
    public profesional: Profesional;

    @ManyToOne(() => Servicio, (servicio) => servicio.turnos)
    @JoinColumn({ name: 'id_servicio' })
    public servicio: Servicio;

}
