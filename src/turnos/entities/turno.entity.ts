import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum TurnoStatus {
    PENDIENTE_PAGO = 'PENDIENTE_PAGO',
    CONFIRMADO = 'CONFIRMADO',
    ATENDIDO = 'ATENDIDO',
    CANCELADO = 'CANCELADO',
}

export enum MedioPagoTurno {
    EFECTIVO = 'EFECTIVO',
    TRANSFERENCIA = 'TRANSFERENCIA',
}

export enum PaymentStatus {
    NO_REQUIERE = 'NO_REQUIERE',
    PENDIENTE = 'PENDIENTE',
    APROBADO = 'APROBADO',
    CANCELADO = 'CANCELADO',
}

export enum BeneficioFidelizacion {
    NINGUNO = 'NINGUNO',
    DESCUENTO_50 = 'DESCUENTO_50',
    CORTE_GRATIS = 'CORTE_GRATIS',
}

@Entity('turnos')
@Index('IDX_turnos_estado_pago_vencimiento', ['paymentStatus', 'paymentExpiresAt'])
@Index('IDX_turnos_profesional_fechaHora', ['profesional', 'fechaHora'])
@Index('UQ_turnos_fidelizacion_pendiente_cliente', ['fidelizacionPendienteClienteId'], { unique: true })
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

    @Column({ name: 'precio_total', type: 'int', nullable: true })
    public precio_total?: number | null;

    @Column({ name: 'importe_final', type: 'int', nullable: true })
    public importe_final?: number | null;

    @Column({ name: 'medio_pago', type: 'enum', enum: MedioPagoTurno, nullable: true })
    public medioPago?: MedioPagoTurno | null;

    @Column({ name: 'monto_reserva_total', type: 'int', nullable: true })
    public monto_reserva_total?: number | null;

    @Column({ name: 'duracion_total', type: 'int', nullable: true })
    public duracion_total?: number | null;

    @Column({ name: 'paidAt', type: 'datetime', nullable: true })
    public paidAt?: Date;

    @Column({ name: 'reservaRefundedAt', type: 'datetime', nullable: true })
    public reservaRefundedAt?: Date;

    @Column({ name: 'paymentExpiresAt', type: 'datetime', nullable: true })
    public paymentExpiresAt?: Date;

    @Column({
        name: 'observaciones',
        type: 'text',
        nullable: true,
    })
    public observaciones?: string;

    @Column({ name: 'fidelizacion_elegible', type: 'boolean', default: false })
    public fidelizacionElegible: boolean;

    @Column({ name: 'fidelizacion_pendiente_cliente_id', type: 'int', nullable: true })
    public fidelizacionPendienteClienteId?: number | null;

    @Column({ name: 'fidelizacion_beneficio', type: 'enum', enum: BeneficioFidelizacion, default: BeneficioFidelizacion.NINGUNO })
    public fidelizacionBeneficio: BeneficioFidelizacion;

    @Column({ name: 'fidelizacion_beneficio_aplicado', type: 'boolean', default: false })
    public fidelizacionBeneficioAplicado: boolean;

    @Column({ name: 'fidelizacion_acreditado_at', type: 'datetime', nullable: true })
    public fidelizacionAcreditadoAt?: Date | null;

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

    @ManyToMany(() => Servicio, (servicio) => servicio.turnosComoAdicional)
    @JoinTable({
        name: 'turnos_servicios_adicionales',
        joinColumn: { name: 'id_turno', referencedColumnName: 'id_turno' },
        inverseJoinColumn: { name: 'id_servicio', referencedColumnName: 'id_servicio' },
    })
    public servicios_adicionales: Servicio[];

}
