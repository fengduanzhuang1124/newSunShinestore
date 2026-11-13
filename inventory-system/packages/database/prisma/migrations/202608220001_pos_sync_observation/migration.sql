-- POS observation tables only. This migration does not alter inventory balances or stock movements.
-- Rollback: drop foreign keys/tables in reverse order from pos_refund_reviews through pos_product_mappings.

CREATE TABLE `pos_product_mappings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `external_product_id` VARCHAR(64) NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `barcode` VARCHAR(128) NOT NULL,
    `source_name` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_product_mappings_store_id_external_product_id_key`(`store_id`, `external_product_id`),
    INDEX `pos_product_mappings_organization_id_barcode_idx`(`organization_id`, `barcode`),
    INDEX `pos_product_mappings_product_id_status_idx`(`product_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_sync_runs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(30) NOT NULL DEFAULT 'MONI',
    `stream` VARCHAR(30) NOT NULL DEFAULT 'ORDERS',
    `status` ENUM('RUNNING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `orders_observed` INTEGER NOT NULL DEFAULT 0,
    `orders_inserted` INTEGER NOT NULL DEFAULT 0,
    `orders_updated` INTEGER NOT NULL DEFAULT 0,
    `items_observed` INTEGER NOT NULL DEFAULT 0,
    `exceptions_count` INTEGER NOT NULL DEFAULT 0,
    `error_code` VARCHAR(50) NULL,
    `error_message` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pos_sync_runs_organization_id_started_at_idx`(`organization_id`, `started_at`),
    INDEX `pos_sync_runs_store_id_status_started_at_idx`(`store_id`, `status`, `started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `sync_run_id` BIGINT UNSIGNED NULL,
    `external_order_no` VARCHAR(64) NOT NULL,
    `external_invoice_no` VARCHAR(64) NULL,
    `source_status` VARCHAR(32) NOT NULL,
    `order_type` VARCHAR(32) NULL,
    `payment_type` VARCHAR(50) NULL,
    `order_amount` DECIMAL(14, 2) NULL,
    `refund_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `ordered_at` DATETIME(3) NOT NULL,
    `inventory_status` ENUM('OBSERVED', 'SIMULATED', 'APPLIED', 'REVERSED', 'REVIEW_REQUIRED') NOT NULL DEFAULT 'OBSERVED',
    `source_fingerprint` CHAR(64) NOT NULL,
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_orders_store_id_external_order_no_key`(`store_id`, `external_order_no`),
    INDEX `pos_orders_organization_id_ordered_at_idx`(`organization_id`, `ordered_at`),
    INDEX `pos_orders_store_id_source_status_ordered_at_idx`(`store_id`, `source_status`, `ordered_at`),
    INDEX `pos_orders_sync_run_id_idx`(`sync_run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `line_key` VARCHAR(100) NOT NULL,
    `external_product_id` VARCHAR(64) NOT NULL,
    `mapping_id` BIGINT UNSIGNED NULL,
    `product_id` BIGINT UNSIGNED NULL,
    `barcode` VARCHAR(128) NULL,
    `source_name` VARCHAR(255) NULL,
    `quantity` DECIMAL(14, 4) NOT NULL,
    `unit_price` DECIMAL(14, 2) NULL,
    `is_minus` BOOLEAN NOT NULL DEFAULT false,
    `disposition` ENUM('INVENTORY', 'NON_INVENTORY', 'UNMAPPED', 'REVIEW_REQUIRED') NOT NULL DEFAULT 'UNMAPPED',
    `exclusion_reason` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_order_items_order_id_line_key_key`(`order_id`, `line_key`),
    INDEX `pos_order_items_external_product_id_idx`(`external_product_id`),
    INDEX `pos_order_items_product_id_disposition_idx`(`product_id`, `disposition`),
    INDEX `pos_order_items_mapping_id_idx`(`mapping_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_sync_cursors` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(30) NOT NULL DEFAULT 'MONI',
    `stream` VARCHAR(30) NOT NULL DEFAULT 'ORDERS',
    `last_source_timestamp` DATETIME(3) NULL,
    `last_external_order_no` VARCHAR(64) NULL,
    `overlap_seconds` INTEGER NOT NULL DEFAULT 300,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_sync_cursors_store_id_provider_stream_key`(`store_id`, `provider`, `stream`),
    INDEX `pos_sync_cursors_organization_id_updated_at_idx`(`organization_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_refund_reviews` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'PENDING',
    `observed_refund_amount` DECIMAL(14, 2) NOT NULL,
    `original_items_available` BOOLEAN NOT NULL DEFAULT false,
    `reason` VARCHAR(255) NOT NULL,
    `resolution_notes` VARCHAR(500) NULL,
    `resolved_by` BIGINT UNSIGNED NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_refund_reviews_order_id_key`(`order_id`),
    INDEX `pos_refund_reviews_status_created_at_idx`(`status`, `created_at`),
    INDEX `pos_refund_reviews_resolved_by_idx`(`resolved_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pos_product_mappings` ADD CONSTRAINT `pos_product_mappings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_product_mappings` ADD CONSTRAINT `pos_product_mappings_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_product_mappings` ADD CONSTRAINT `pos_product_mappings_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_sync_runs` ADD CONSTRAINT `pos_sync_runs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_sync_runs` ADD CONSTRAINT `pos_sync_runs_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_orders` ADD CONSTRAINT `pos_orders_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_orders` ADD CONSTRAINT `pos_orders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_orders` ADD CONSTRAINT `pos_orders_sync_run_id_fkey` FOREIGN KEY (`sync_run_id`) REFERENCES `pos_sync_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `pos_order_items` ADD CONSTRAINT `pos_order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `pos_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_order_items` ADD CONSTRAINT `pos_order_items_mapping_id_fkey` FOREIGN KEY (`mapping_id`) REFERENCES `pos_product_mappings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `pos_order_items` ADD CONSTRAINT `pos_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `pos_sync_cursors` ADD CONSTRAINT `pos_sync_cursors_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_sync_cursors` ADD CONSTRAINT `pos_sync_cursors_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_refund_reviews` ADD CONSTRAINT `pos_refund_reviews_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `pos_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_refund_reviews` ADD CONSTRAINT `pos_refund_reviews_resolved_by_fkey` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
