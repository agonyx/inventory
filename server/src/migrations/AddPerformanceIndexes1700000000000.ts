import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_status" ON "orders" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_createdAt" ON "orders" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_inventory_levels_locationId" ON "inventory_levels" ("locationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_inventory_levels_variantId" ON "inventory_levels" ("variantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_sku" ON "products" ("sku")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transfers_status" ON "transfers" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stocktakes_status" ON "stocktakes" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_read" ON "notifications" ("read")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_returns_status" ON "returns" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_returns_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stocktakes_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transfers_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_sku"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_levels_variantId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_levels_locationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_status"`);
  }
}
