import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaniasController } from './campanias.controller';
import { CampaniasService } from './campanias.service';
import { Campania } from './entities/campania.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Campania])],
  controllers: [CampaniasController],
  providers: [CampaniasService],
})
export class CampaniasModule {}
