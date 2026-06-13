import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum TipoBloqueo {
  DIA_COMPLETO = 'DIA_COMPLETO',
  RANGO_HORARIO = 'RANGO_HORARIO',
}

@Entity('bloqueos')
export class Bloqueo {
  @PrimaryGeneratedColumn({ type: 'int' })
  public id_bloqueo: number;

  @Column({ name: 'dia', length: 20, nullable: false })
  public dia: string;

  @Column({ name: 'tipo', type: 'enum', enum: TipoBloqueo, default: TipoBloqueo.RANGO_HORARIO })
  public tipo: TipoBloqueo;

  @Column({ name: 'hora_inicio', length: 5, nullable: true })
  public hora_inicio?: string;

  @Column({ name: 'hora_fin', length: 5, nullable: true })
  public hora_fin?: string;

  @Column({ name: 'motivo', length: 150, nullable: true })
  public motivo?: string;

  @ManyToOne(() => Profesional)
  @JoinColumn({ name: 'id_profesional' })
  public profesional: Profesional;

  get id() {
    return this.id_bloqueo;
  }

  get fecha() {
    return this.dia;
  }
}
