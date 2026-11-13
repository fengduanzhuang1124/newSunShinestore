-- Apply eligible POS sales to the immutable stock ledger.
-- Existing orders remain untouched until an authorized operator explicitly applies them.

ALTER TABLE `stock_movements`
  MODIFY COLUMN `movement_type` ENUM(
    'INITIAL_STOCK',
    'RECEIPT',
    'SALE_OUT',
    'MANUAL_ISSUE',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'STOCKTAKE_GAIN',
    'STOCKTAKE_LOSS',
    'DAMAGE',
    'EXPIRED',
    'RETURN_IN',
    'RETURN_TO_SUPPLIER',
    'REVERSAL'
  ) NOT NULL;

ALTER TABLE `pos_orders`
  ADD COLUMN `inventory_applied_at` DATETIME(3) NULL,
  ADD COLUMN `inventory_applied_by` BIGINT UNSIGNED NULL,
  ADD INDEX `pos_orders_inventory_applied_by_inventory_applied_at_idx` (`inventory_applied_by`, `inventory_applied_at`),
  ADD CONSTRAINT `pos_orders_inventory_applied_by_fkey`
    FOREIGN KEY (`inventory_applied_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback requires first confirming no SALE_OUT rows exist, then dropping the
-- foreign key/index/columns and restoring the previous movement_type enum.
