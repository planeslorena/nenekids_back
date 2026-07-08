import { ProfServicio } from 'src/profesionales/entities/prof_servicio.entity';
import { Turno } from 'src/turnos/entities/turno.entity';
import { Column, DeleteDateColumn, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

export type ServicioImagen = {
    url: string;
    pathname: string;
    alt?: string;
    orden?: number;
};

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
        name: 'precio_transferencia',
        type: 'int',
        nullable: true,
    })
    public precio_transferencia?: number | null;

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

    @Column({
        name: 'visible_como_complemento',
        type: 'boolean',
        default: false,
    })
    public visible_como_complemento: boolean;

    @Column({
        name: 'imagenes',
        type: 'simple-json',
        nullable: true,
    })
    public imagenes?: ServicioImagen[] | null;

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

    @ManyToMany(() => Servicio, (servicio) => servicio.serviciosQueLoPermiten)
    @JoinTable({
        name: 'servicios_complementos',
        joinColumn: { name: 'id_servicio', referencedColumnName: 'id_servicio' },
        inverseJoinColumn: { name: 'id_complemento', referencedColumnName: 'id_servicio' },
    })
    public complementos_permitidos: Servicio[];

    @ManyToMany(() => Servicio, (servicio) => servicio.complementos_permitidos)
    public serviciosQueLoPermiten: Servicio[];

    @ManyToMany(() => Turno, (turno) => turno.servicios_adicionales)
    public turnosComoAdicional: Turno[];
}
