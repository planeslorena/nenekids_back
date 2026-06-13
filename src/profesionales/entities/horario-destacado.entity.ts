import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profesional } from './profesional.entity';

@Entity('horarios_destacados')
export class HorarioDestacado {
  @PrimaryGeneratedColumn({ type: 'int' })
  public id: number;

  @Column({ length: 5, nullable: false })
  public hora: string;

  @Column({ type: 'int', nullable: false })
  public orden: number;

  @ManyToOne(() => Profesional, (profesional) => profesional.horariosDestacados, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_profesional' })
  public profesional: Profesional;
}
