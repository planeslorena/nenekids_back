import { ProfServicio } from 'src/profesionales/entities/prof_servicio.entity';
import { Turno } from 'src/turnos/entities/turno.entity';
import { Column, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

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
        name: 'descripcion',
        length: 255,
        nullable: true,
    })
    public descripcion?: string;

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

    @Column({
        name: 'monto_reserva',
        type: 'int',
        default: 0,
    })
    public monto_reserva: number;

    @Column({
        name: 'visible',
        type: 'boolean',
        default: true,
    })
    public visible: boolean;

    @DeleteDateColumn({ name: 'deletedAt', nullable: true })
    public deletedAt?: Date | null;

    get reserva() {
        return this.monto_reserva;
    }

    get visible_cliente() {
        return this.visible;
    }

    @OneToMany(() => ProfServicio, (profServicio) => profServicio.servicio)
    public profServicios: ProfServicio[];

    @OneToMany(() => Turno, (turno) => turno.servicio)
    public turnos: Turno[];
}
