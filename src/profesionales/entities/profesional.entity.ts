import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProfServicio } from './prof_servicio.entity';
import { Horario } from './horario.entity';
import { Turno } from 'src/turnos/entities/turno.entity';

@Entity('profesionales')
export class Profesional {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_profesional: number;

    @Column({
        name: 'fecha_nacimiento',
        length: 50,
        nullable: false,
    })
    public fecha_nacimiento: string;

    @OneToOne(() => Usuario)
    @JoinColumn({ name: 'id_usuario' })
    public usuario: Usuario;

    @OneToMany(() => ProfServicio, (profServicio) => profServicio.id_prof_servicio)
    public profServicio: ProfServicio[];

    @OneToMany(() => Horario, (horario) => horario.profesional)
    public horarios: Horario[];

    @OneToMany(() => Turno, (turno) => turno.profesional)
    public turnos: Turno[];
}