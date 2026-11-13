ALTER TABLE `store_products`
  ADD COLUMN `level4_price_cents` INT NULL,
  ADD COLUMN `level4_price_id` VARCHAR(64) NULL,
  ADD COLUMN `level4_price_synced_at` DATETIME(3) NULL;
