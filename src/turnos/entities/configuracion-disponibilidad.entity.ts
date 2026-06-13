import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('configuracion_disponibilidad')
export class ConfiguracionDisponibilidad {
  @PrimaryColumn({ length: 80 })
  public clave: string;

  @Column({ type: 'int', nullable: false })
  public valor: number;
}
