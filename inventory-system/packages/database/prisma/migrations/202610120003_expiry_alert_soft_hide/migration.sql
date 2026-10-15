ALTER TABLE `expiry_alert_actions`
    ADD COLUMN `alert_hidden_reason` VARCHAR(255) NULL,
    ADD COLUMN `alert_hidden_by` BIGINT UNSIGNED NULL,
    ADD COLUMN `alert_hidden_at` DATETIME(3) NULL,
    ADD INDEX `expiry_alert_actions_warehouse_hidden_idx` (`warehouse_id`, `alert_hidden_at`),
    ADD CONSTRAINT `expiry_alert_actions_alert_hidden_by_fkey` FOREIGN KEY (`alert_hidden_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rollback: ALTER TABLE `expiry_alert_actions` DROP FOREIGN KEY `expiry_alert_actions_alert_hidden_by_fkey`, DROP INDEX `expiry_alert_actions_warehouse_hidden_idx`, DROP COLUMN `alert_hidden_at`, DROP COLUMN `alert_hidden_by`, DROP COLUMN `alert_hidden_reason`;
