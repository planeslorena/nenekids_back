import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profesional } from './profesional.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';

@Entity('prof_servicios')
export class ProfServicio {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_prof_servicio: number;

    @ManyToOne(() => Profesional, (profesional) => profesional.profServicio)
    @JoinColumn({ name: 'id_profesional' })
    public profesional: Profesional;

    @ManyToOne(() => Servicio, (servicio) => servicio.profServicios)
    @JoinColumn({ name: 'id_servicio' })
    public servicio: Servicio;
}
