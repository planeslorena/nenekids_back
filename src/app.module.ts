import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { TurnosModule } from './turnos/turnos.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProfesionalesModule } from './profesionales/profesionales.module';
import { ServiciosModule } from './servicios/servicios.module';
import { UsuariosModule } from './usuarios/usuarios.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      username: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB,
      synchronize: true,
      entities: ['dist/**/*.entity.js'],
      logging: 'all',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    ClientesModule,
    ProfesionalesModule,
    ServiciosModule,
    TurnosModule,
    UsuariosModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }