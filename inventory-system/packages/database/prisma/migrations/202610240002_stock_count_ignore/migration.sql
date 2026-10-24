-- Stock count items can be ignored (CR-004): discontinued products leave the recount list without a count.
-- Upgrade: adds the enum value IGNORED; existing rows keep PENDING / CONFIRMED and stock is not touched.

-- AlterTable
ALTER TABLE `stock_count_task_items` MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'IGNORED') NOT NULL DEFAULT 'PENDING';

-- Rollback (ignoring never wrote stock movements; audit rows stay):
--   UPDATE `stock_count_task_items` SET `status` = 'PENDING' WHERE `status` = 'IGNORED';
--   ALTER TABLE `stock_count_task_items` MODIFY `status` ENUM('PENDING', 'CONFIRMED') NOT NULL DEFAULT 'PENDING';
