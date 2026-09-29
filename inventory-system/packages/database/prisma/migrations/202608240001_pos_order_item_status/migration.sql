-- Preserve POS line history while excluding lines removed by a later source reconciliation.
ALTER TABLE `pos_order_items`
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE' AFTER `disposition`;

CREATE INDEX `pos_order_items_order_id_status_idx`
    ON `pos_order_items`(`order_id`, `status`);

-- Rollback (only after confirming no reconciliation history depends on this field):
-- DROP INDEX `pos_order_items_order_id_status_idx` ON `pos_order_items`;
-- ALTER TABLE `pos_order_items` DROP COLUMN `status`;
