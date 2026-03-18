import { Turno } from 'src/turnos/entities/turno.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('clientes')
export class Cliente {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_cliente: number;

    @Column({
        name: 'nombre',
        length: 50,
        nullable: false,
    })
    public nombre: string;

    @Column({
        name: 'fecha_nacimiento',
        length: 50,
        nullable: false,
    })
    public fecha_nacimiento: string;

    @ManyToOne(() => Usuario, (usuario) => usuario.clientes)
    @JoinColumn({ name: 'id_usuario' })
    public adulto: Usuario;

    @OneToMany(() => Turno, (turno) => turno.cliente)
    public turnos: Turno[];
}