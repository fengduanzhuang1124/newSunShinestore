-- Extend the existing POS sync run as the auditable sync batch record.
-- This migration only changes local synchronization metadata. It does not
-- update POS data, stock movements, or inventory balances.

ALTER TABLE `pos_sync_runs`
  ADD COLUMN `cursor_id` BIGINT UNSIGNED NULL AFTER `store_id`,
  ADD COLUMN `requested_from` CHAR(10) NULL AFTER `status`,
  ADD COLUMN `requested_to` CHAR(10) NULL AFTER `requested_from`,
  ADD COLUMN `cursor_before` DATETIME(3) NULL AFTER `requested_to`,
  ADD COLUMN `cursor_after` DATETIME(3) NULL AFTER `cursor_before`,
  ADD COLUMN `orders_skipped` INTEGER NOT NULL DEFAULT 0 AFTER `orders_updated`,
  ADD INDEX `pos_sync_runs_cursor_id_started_at_idx` (`cursor_id`, `started_at`),
  ADD CONSTRAINT `pos_sync_runs_cursor_id_fkey`
    FOREIGN KEY (`cursor_id`) REFERENCES `pos_sync_cursors` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback:
-- ALTER TABLE `pos_sync_runs` DROP FOREIGN KEY `pos_sync_runs_cursor_id_fkey`,
--   DROP INDEX `pos_sync_runs_cursor_id_started_at_idx`,
--   DROP COLUMN `orders_skipped`, DROP COLUMN `cursor_after`,
--   DROP COLUMN `cursor_before`, DROP COLUMN `requested_to`,
--   DROP COLUMN `requested_from`, DROP COLUMN `cursor_id`;
