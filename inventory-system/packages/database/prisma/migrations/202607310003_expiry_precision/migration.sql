ALTER TABLE `product_batches`
  ADD COLUMN `expiry_precision` ENUM('MONTH', 'DATE') NOT NULL DEFAULT 'DATE';

CREATE INDEX `product_batches_organization_id_idx`
  ON `product_batches`(`organization_id`);

DROP INDEX `product_batches_organization_id_product_id_expiry_date_key`
  ON `product_batches`;

CREATE UNIQUE INDEX `product_batches_org_product_expiry_precision_key`
  ON `product_batches`(`organization_id`, `product_id`, `expiry_date`, `expiry_precision`);

-- Rollback (only before month-precision data is used):
-- DROP INDEX `product_batches_org_product_expiry_precision_key` ON `product_batches`;
-- CREATE UNIQUE INDEX `product_batches_organization_id_product_id_expiry_date_key` ON `product_batches`(`organization_id`, `product_id`, `expiry_date`);
-- ALTER TABLE `product_batches` DROP COLUMN `expiry_precision`;
