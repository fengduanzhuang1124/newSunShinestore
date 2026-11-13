-- Per-store POS inventory baseline and per-line POS sale application.
-- Upgrade: adds nullable columns only; existing rows and behaviour are unchanged until the API reads them.
-- The baseline falls back to POS_INVENTORY_BASELINE_AT while stores.pos_inventory_baseline_at is NULL.

ALTER TABLE `stores`
  ADD COLUMN `pos_inventory_baseline_at` DATETIME(3) NULL;

-- inventory_applied_quantity: units actually deducted for the line (NULL = not processed yet).
-- inventory_review_reason: why a line was not fully deducted (UNMAPPED, REVIEW_REQUIRED, RETURN_LINE,
-- INVALID_QUANTITY, INSUFFICIENT_INVENTORY); NULL when fully deducted or not an inventory line.
ALTER TABLE `pos_order_items`
  ADD COLUMN `inventory_applied_quantity` INT NULL,
  ADD COLUMN `inventory_review_reason` VARCHAR(40) NULL,
  ADD INDEX `pos_order_items_inventory_review_reason_idx` (`inventory_review_reason`);

-- Rollback (stock movements written meanwhile stay; they are the source of truth):
--   ALTER TABLE `pos_order_items` DROP INDEX `pos_order_items_inventory_review_reason_idx`,
--     DROP COLUMN `inventory_review_reason`, DROP COLUMN `inventory_applied_quantity`;
--   ALTER TABLE `stores` DROP COLUMN `pos_inventory_baseline_at`;
-- then restore POS_INVENTORY_BASELINE_AT in .env before restarting the API.
