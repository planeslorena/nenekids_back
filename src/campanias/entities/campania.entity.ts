import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CampaniaUbicacion {
  HOME = 'HOME',
  CONFIRMACION_TURNO = 'CONFIRMACION_TURNO',
}

export enum CampaniaTipo {
  FLYER = 'FLYER',
  BANNER = 'BANNER',
}

@Entity('campanias')
export class Campania {
  @PrimaryGeneratedColumn({ type: 'int' })
  public id_campania: number;

  @Column({ name: 'nombre', length: 100, nullable: false })
  public nombre: string;

  @Column({
    name: 'tipo',
    type: 'enum',
    enum: CampaniaTipo,
    default: CampaniaTipo.FLYER,
  })
  public tipo: CampaniaTipo;

  @Column({ name: 'imagen_url', length: 500, nullable: true })
  public imagen_url: string | null;

  @Column({ name: 'imagen_pathname', length: 255, nullable: true })
  public imagen_pathname: string | null;

  @Column({ name: 'texto', length: 300, nullable: true })
  public texto: string | null;

  @Column({ name: 'enlace', length: 500, nullable: true })
  public enlace: string | null;

  @Column({ name: 'fecha_desde', type: 'date', nullable: false })
  public fecha_desde: string;

  @Column({ name: 'fecha_hasta', type: 'date', nullable: false })
  public fecha_hasta: string;

  @Column({
    name: 'ubicacion',
    type: 'enum',
    enum: CampaniaUbicacion,
    default: CampaniaUbicacion.HOME,
  })
  public ubicacion: CampaniaUbicacion;

  @CreateDateColumn({ name: 'createdAt' })
  public createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  public updatedAt: Date;
}
