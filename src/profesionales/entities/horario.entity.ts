import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profesional } from './profesional.entity';

@Entity('horarios')
export class Horario {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_horario: number;

    @Column({
        name: 'dia',
        length: 50,
        nullable: false,
    })
    public dia: string;

    @Column({
        name: 'hora_inicio',
        length: 50,
        nullable: false,
    })
    public hora_inicio: string;

    @Column({
        name: 'hora_fin',
        length: 50,
        nullable: false,
    })
    public hora_fin: string;

    @ManyToOne(() => Profesional, (profesional) => profesional.horarios)
    @JoinColumn({ name: 'id_profesional' })
    public profesional: Profesional;
}
