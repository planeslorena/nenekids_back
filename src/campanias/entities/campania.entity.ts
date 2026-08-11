import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('campanias')
export class Campania {
  @PrimaryGeneratedColumn({ type: 'int' })
  public id_campania: number;

  @Column({ name: 'nombre', length: 100, nullable: false })
  public nombre: string;

  @Column({ name: 'imagen_url', length: 500, nullable: false })
  public imagen_url: string;

  @Column({ name: 'imagen_pathname', length: 255, nullable: false })
  public imagen_pathname: string;

  @Column({ name: 'fecha_desde', type: 'date', nullable: false })
  public fecha_desde: string;

  @Column({ name: 'fecha_hasta', type: 'date', nullable: false })
  public fecha_hasta: string;

  @CreateDateColumn({ name: 'createdAt' })
  public createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  public updatedAt: Date;
}
