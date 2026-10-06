import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fidelizacion1770283200000 implements MigrationInterface {
  name = 'Fidelizacion1770283200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `servicios` ADD `fidelizable` tinyint NOT NULL DEFAULT 0");
    await queryRunner.query("ALTER TABLE `turnos` ADD `fidelizacion_elegible` tinyint NOT NULL DEFAULT 0, ADD `fidelizacion_pendiente_cliente_id` int NULL, ADD `fidelizacion_beneficio` enum ('NINGUNO','DESCUENTO_50','CORTE_GRATIS') NOT NULL DEFAULT 'NINGUNO', ADD `fidelizacion_beneficio_aplicado` tinyint NOT NULL DEFAULT 0, ADD `fidelizacion_acreditado_at` datetime NULL");
    await queryRunner.query("CREATE UNIQUE INDEX `UQ_turnos_fidelizacion_pendiente_cliente` ON `turnos` (`fidelizacion_pendiente_cliente_id`)");
    await queryRunner.query("CREATE TABLE `fidelizacion_ciclos` (`id` int NOT NULL AUTO_INCREMENT, `id_cliente` int NOT NULL, `fecha_inicio` datetime NOT NULL, `fecha_vencimiento` datetime NOT NULL, `fecha_cierre` datetime NULL, `estado` enum ('ACTIVO','CERRADO_50','CERRADO_GRATIS','VENCIDO') NOT NULL DEFAULT 'ACTIVO', `cantidad_cortes` int NOT NULL DEFAULT 0, `renuncio_50` tinyint NOT NULL DEFAULT 0, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_fidelizacion_ciclo_cliente_inicio` (`id_cliente`,`fecha_inicio`), PRIMARY KEY (`id`), CONSTRAINT `FK_fidelizacion_ciclo_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `clientes`(`id_cliente`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `fidelizacion_movimientos` (`id` int NOT NULL AUTO_INCREMENT, `id_cliente` int NOT NULL, `id_ciclo` int NULL, `id_turno` int NULL, `tipo` enum ('ACREDITACION','BENEFICIO_APLICADO','REVERSA','VENCIMIENTO','REASIGNACION','CARGA_HISTORICA') NOT NULL, `detalle` text NULL, `actor_id` int NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_fidelizacion_movimiento_turno_tipo` (`id_turno`,`tipo`), PRIMARY KEY (`id`), CONSTRAINT `FK_fidelizacion_movimiento_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `clientes`(`id_cliente`), CONSTRAINT `FK_fidelizacion_movimiento_ciclo` FOREIGN KEY (`id_ciclo`) REFERENCES `fidelizacion_ciclos`(`id`) ON DELETE SET NULL, CONSTRAINT `FK_fidelizacion_movimiento_turno` FOREIGN KEY (`id_turno`) REFERENCES `turnos`(`id_turno`)) ENGINE=InnoDB");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `fidelizacion_movimientos`");
    await queryRunner.query("DROP TABLE `fidelizacion_ciclos`");
    await queryRunner.query("DROP INDEX `UQ_turnos_fidelizacion_pendiente_cliente` ON `turnos`");
    await queryRunner.query("ALTER TABLE `turnos` DROP COLUMN `fidelizacion_acreditado_at`, DROP COLUMN `fidelizacion_beneficio_aplicado`, DROP COLUMN `fidelizacion_beneficio`, DROP COLUMN `fidelizacion_pendiente_cliente_id`, DROP COLUMN `fidelizacion_elegible`");
    await queryRunner.query("ALTER TABLE `servicios` DROP COLUMN `fidelizable`");
  }
}
