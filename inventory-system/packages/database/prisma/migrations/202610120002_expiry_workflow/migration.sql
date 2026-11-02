CREATE TABLE `expiry_alert_actions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `warehouse_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `handling_method` VARCHAR(500) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    `created_by` BIGINT UNSIGNED NOT NULL,
    `updated_by` BIGINT UNSIGNED NOT NULL,
    `completed_by` BIGINT UNSIGNED NULL,
    `completed_at` DATETIME(3) NULL,
    `ignored_at` DATETIME(3) NULL,
    `deleted_by` BIGINT UNSIGNED NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `expiry_alert_actions_org_warehouse_batch_key` (`organization_id`, `warehouse_id`, `batch_id`),
    INDEX `expiry_alert_actions_warehouse_status_deleted_idx` (`warehouse_id`, `status`, `deleted_at`),
    INDEX `expiry_alert_actions_batch_deleted_idx` (`batch_id`, `deleted_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `expiry_alert_actions_status_check` CHECK (`status` IN ('OPEN', 'COMPLETED', 'IGNORED')),
    CONSTRAINT `expiry_alert_actions_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `product_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_completed_by_fkey` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `expiry_alert_actions_deleted_by_fkey` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Rollback: DROP TABLE `expiry_alert_actions`;
-- Batch date corrections use the existing audit_logs table and require no destructive rollback.
