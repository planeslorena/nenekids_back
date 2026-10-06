import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Turno } from 'src/turnos/entities/turno.entity';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CicloFidelizacion } from './ciclo-fidelizacion.entity';

export enum TipoMovimientoFidelizacion { ACREDITACION = 'ACREDITACION', BENEFICIO_APLICADO = 'BENEFICIO_APLICADO', REVERSA = 'REVERSA', VENCIMIENTO = 'VENCIMIENTO', REASIGNACION = 'REASIGNACION', CARGA_HISTORICA = 'CARGA_HISTORICA' }

@Entity('fidelizacion_movimientos')
@Index('UQ_fidelizacion_movimiento_turno_tipo', ['turno', 'tipo'], { unique: true })
export class MovimientoFidelizacion {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Cliente, { nullable: false }) @JoinColumn({ name: 'id_cliente' }) cliente: Cliente;
  @ManyToOne(() => CicloFidelizacion, { nullable: true }) @JoinColumn({ name: 'id_ciclo' }) ciclo?: CicloFidelizacion | null;
  @ManyToOne(() => Turno, { nullable: true }) @JoinColumn({ name: 'id_turno' }) turno?: Turno | null;
  @Column({ type: 'enum', enum: TipoMovimientoFidelizacion }) tipo: TipoMovimientoFidelizacion;
  @Column({ type: 'text', nullable: true }) detalle?: string | null;
  @Column({ name: 'actor_id', type: 'int', nullable: true }) actorId?: number | null;
  @CreateDateColumn() createdAt: Date;
}
