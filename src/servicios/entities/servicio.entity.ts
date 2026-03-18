import { ProfServicio } from 'src/profesionales/entities/prof_servicio.entity';
import { Turno } from 'src/turnos/entities/turno.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('servicios')
export class Servicio {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_servicio: number;

    @Column({
        name: 'nombre',
        length: 50,
        nullable: false,
    })
    public nombre: string;

    @Column({
        name: 'duracion',
        type: 'int',
        nullable: false,
    })
    public duracion: number;

    @Column({
        name: 'precio',
        type: 'int',
        nullable: false,
    })
    public precio: number;

    @OneToMany(() => ProfServicio, (profServicio) => profServicio.servicio)
    public profServicios: ProfServicio[];

    @OneToMany(() => Turno, (turno) => turno.servicio)
    public turnos: Turno[];
}