import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Profesional } from 'src/profesionales/entities/profesional.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';


@Entity('turnos')
export class Turno {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_turno: number;

    @Column({
        name: 'dia',
        type: 'varchar',
        nullable: false,
    })
    public dia: string;

    @Column({
        name: 'hora',
        type: 'varchar',
        nullable: false,
    })
    public hora: string;

    @ManyToOne(() => Cliente, (cliente) => cliente.turnos)
    @JoinColumn({ name: 'id_cliente' })
    public cliente: Cliente;

    @ManyToOne(() => Profesional, (profesional) => profesional.turnos)
    @JoinColumn({ name: 'id_profesional' })
    public profesional: Profesional;

    @ManyToOne(() => Servicio, (servicio) => servicio.turnos)
    @JoinColumn({ name: 'id_servicio' })
    public servicio: Servicio;

}