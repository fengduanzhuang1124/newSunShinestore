CREATE TABLE `stock_receipts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `receipt_no` VARCHAR(40) NOT NULL,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `warehouse_id` BIGINT UNSIGNED NOT NULL,
    `receipt_date` DATE NOT NULL,
    `status` ENUM('OPEN', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `opened_by` BIGINT UNSIGNED NOT NULL,
    `completed_by` BIGINT UNSIGNED NULL,
    `completed_at` DATETIME(3) NULL,
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_receipts_receipt_no_key`(`receipt_no`),
    INDEX `stock_receipts_organization_id_receipt_date_idx`(`organization_id`, `receipt_date`),
    INDEX `stock_receipts_warehouse_id_status_receipt_date_idx`(`warehouse_id`, `status`, `receipt_date`),
    INDEX `stock_receipts_opened_by_status_receipt_date_idx`(`opened_by`, `status`, `receipt_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `stock_receipt_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `receipt_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `movement_id` BIGINT UNSIGNED NOT NULL,
    `barcode` VARCHAR(128) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_receipt_items_movement_id_key`(`movement_id`),
    INDEX `stock_receipt_items_receipt_id_created_at_idx`(`receipt_id`, `created_at`),
    INDEX `stock_receipt_items_product_id_batch_id_idx`(`product_id`, `batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_opened_by_fkey` FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_receipts` ADD CONSTRAINT `stock_receipts_completed_by_fkey` FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `stock_receipts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `product_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_movement_id_fkey` FOREIGN KEY (`movement_id`) REFERENCES `stock_movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_quantity_positive` CHECK (`quantity` > 0);
