import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usuarios')
export class Usuario {
    @PrimaryGeneratedColumn({
        type: 'int',
    })
    public id_usuario: number;

    @Column({
        name: 'dni',
        type: 'bigint',
        nullable: false,
        unique: true,
    })
    public dni: number;

    @Column({
        name: 'nombre',
        length: 50,
        nullable: false,
    })
    public nombre: string;

    @Column({
        name: 'mail',
        length: 100,
        nullable: false,
    })
    public mail: string;

    @Column({
        name: 'telefono',
        type: 'bigint',
        nullable: false,
    })
    public telefono: number;

    @Column({
        name: 'instagram',
        length: 100,
        nullable: false,
    })
    public instagram: string;

    // ROl: 'USER' | 'ADMIN' | 'PROF'
    @Column({
        name: 'rol',
        length: 15,
        nullable: false,
    })
    public rol: string;

    @Column({
        name: 'codigo',
        type: 'int',
        nullable: true,
    })
    public codigo: number;

    @OneToMany(() => Cliente, (cliente) => cliente.adulto)
    public clientes: Cliente[];

    constructor(dni: number, nombre: string, mail: string, telefono: number, instagram: string, rol: string) {
        this.dni = dni;
        this.nombre = nombre;
        this.mail = mail;
        this.telefono = telefono;
        this.instagram = instagram;
        this.rol = rol;
    }
}
