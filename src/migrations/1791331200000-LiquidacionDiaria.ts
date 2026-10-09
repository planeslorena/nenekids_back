import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiquidacionDiaria1791331200000 implements MigrationInterface {
  name = 'LiquidacionDiaria1791331200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `turnos` MODIFY COLUMN `estado` enum ('PENDIENTE_PAGO','CONFIRMADO','ATENDIDO','CANCELADO') NOT NULL DEFAULT 'CONFIRMADO'");
    await queryRunner.query("ALTER TABLE `turnos` ADD COLUMN `importe_final` int NULL AFTER `precio_total`");
    await queryRunner.query("ALTER TABLE `turnos` ADD COLUMN `medio_pago` enum ('EFECTIVO','TRANSFERENCIA') NULL AFTER `importe_final`");
    await queryRunner.query("ALTER TABLE `profesionales` ADD COLUMN `porcentaje_comision` int NOT NULL DEFAULT 50 AFTER `fecha_nacimiento`");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `profesionales` DROP COLUMN `porcentaje_comision`");
    await queryRunner.query("ALTER TABLE `turnos` DROP COLUMN `medio_pago`");
    await queryRunner.query("ALTER TABLE `turnos` DROP COLUMN `importe_final`");
    await queryRunner.query("ALTER TABLE `turnos` MODIFY COLUMN `estado` enum ('PENDIENTE_PAGO','CONFIRMADO','CANCELADO') NOT NULL DEFAULT 'CONFIRMADO'");
  }
}
