import { MigrationInterface, QueryRunner } from 'typeorm';

export class CierreSinBeneficioFidelizacion1791223200000 implements MigrationInterface {
  name = 'CierreSinBeneficioFidelizacion1791223200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `fidelizacion_ciclos` MODIFY COLUMN `estado` enum ('ACTIVO','CERRADO_50','CERRADO_GRATIS','CERRADO_SIN_BENEFICIO','VENCIDO') NOT NULL DEFAULT 'ACTIVO'");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `fidelizacion_ciclos` MODIFY COLUMN `estado` enum ('ACTIVO','CERRADO_50','CERRADO_GRATIS','VENCIDO') NOT NULL DEFAULT 'ACTIVO'");
  }
}
