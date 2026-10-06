import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum EstadoCicloFidelizacion { ACTIVO = 'ACTIVO', CERRADO_50 = 'CERRADO_50', CERRADO_GRATIS = 'CERRADO_GRATIS', CERRADO_SIN_BENEFICIO = 'CERRADO_SIN_BENEFICIO', VENCIDO = 'VENCIDO' }

@Entity('fidelizacion_ciclos')
@Index('IDX_fidelizacion_ciclo_cliente_inicio', ['cliente', 'fechaInicio'])
export class CicloFidelizacion {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Cliente, { nullable: false }) @JoinColumn({ name: 'id_cliente' }) cliente: Cliente;
  @Column({ name: 'fecha_inicio', type: 'datetime' }) fechaInicio: Date;
  @Column({ name: 'fecha_vencimiento', type: 'datetime' }) fechaVencimiento: Date;
  @Column({ name: 'fecha_cierre', type: 'datetime', nullable: true }) fechaCierre?: Date | null;
  @Column({ type: 'enum', enum: EstadoCicloFidelizacion, default: EstadoCicloFidelizacion.ACTIVO }) estado: EstadoCicloFidelizacion;
  @Column({ name: 'cantidad_cortes', type: 'int', default: 0 }) cantidadCortes: number;
  @Column({ name: 'renuncio_50', type: 'boolean', default: false }) renuncio50: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
