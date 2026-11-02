-- CreateTable
CREATE TABLE `organizations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Pacific/Auckland',
    `currency` CHAR(3) NOT NULL DEFAULT 'NZD',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organizations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stores` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `address` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stores_organization_id_status_idx`(`organization_id`, `status`),
    UNIQUE INDEX `stores_organization_id_code_key`(`organization_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_products` (
    `store_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `selling_price_cents` INTEGER NULL,
    `minimum_stock` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `store_products_product_id_idx`(`product_id`),
    PRIMARY KEY (`store_id`, `product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouses` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `warehouses_store_id_status_idx`(`store_id`, `status`),
    UNIQUE INDEX `warehouses_store_id_code_key`(`store_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `unit` VARCHAR(20) NOT NULL DEFAULT 'piece',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `products_organization_id_name_idx`(`organization_id`, `name`),
    UNIQUE INDEX `products_organization_id_sku_key`(`organization_id`, `sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_barcodes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `barcode` VARCHAR(128) NOT NULL,
    `barcode_type` VARCHAR(30) NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_barcodes_product_id_status_idx`(`product_id`, `status`),
    UNIQUE INDEX `product_barcodes_organization_id_barcode_key`(`organization_id`, `barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_batches` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `expiry_date` DATE NOT NULL,
    `supplier_batch_no` VARCHAR(100) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'QUARANTINED') NOT NULL DEFAULT 'ACTIVE',
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_batches_expiry_date_status_idx`(`expiry_date`, `status`),
    UNIQUE INDEX `product_batches_organization_id_product_id_expiry_date_key`(`organization_id`, `product_id`, `expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `username` VARCHAR(80) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_organization_id_username_key`(`organization_id`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `roles_organization_id_code_key`(`organization_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_store_roles` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `role_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_store_roles_store_id_role_id_idx`(`store_id`, `role_id`),
    PRIMARY KEY (`user_id`, `store_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_warehouse_permissions` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `warehouse_id` BIGINT UNSIGNED NOT NULL,
    `can_view` BOOLEAN NOT NULL DEFAULT false,
    `can_receive` BOOLEAN NOT NULL DEFAULT false,
    `can_issue` BOOLEAN NOT NULL DEFAULT false,
    `can_transfer` BOOLEAN NOT NULL DEFAULT false,
    `can_count` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`, `warehouse_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `movement_no` VARCHAR(40) NOT NULL,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `warehouse_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `movement_type` ENUM('INITIAL_STOCK', 'RECEIPT', 'MANUAL_ISSUE', 'TRANSFER_OUT', 'TRANSFER_IN', 'STOCKTAKE_GAIN', 'STOCKTAKE_LOSS', 'DAMAGE', 'EXPIRED', 'RETURN_IN', 'RETURN_TO_SUPPLIER', 'REVERSAL') NOT NULL,
    `quantity_delta` INTEGER NOT NULL,
    `reference_type` VARCHAR(30) NULL,
    `reference_id` BIGINT UNSIGNED NULL,
    `reason` VARCHAR(255) NULL,
    `reversal_of_id` BIGINT UNSIGNED NULL,
    `performed_by` BIGINT UNSIGNED NOT NULL,
    `idempotency_key` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_movements_movement_no_key`(`movement_no`),
    UNIQUE INDEX `stock_movements_reversal_of_id_key`(`reversal_of_id`),
    INDEX `stock_movements_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `stock_movements_product_id_batch_id_created_at_idx`(`product_id`, `batch_id`, `created_at`),
    INDEX `stock_movements_warehouse_id_created_at_idx`(`warehouse_id`, `created_at`),
    UNIQUE INDEX `stock_movements_organization_id_idempotency_key_key`(`organization_id`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_balances` (
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `warehouse_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_balances_warehouse_id_product_id_batch_id_idx`(`warehouse_id`, `product_id`, `batch_id`),
    PRIMARY KEY (`organization_id`, `warehouse_id`, `product_id`, `batch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `transfer_no` VARCHAR(40) NOT NULL,
    `from_warehouse_id` BIGINT UNSIGNED NOT NULL,
    `to_warehouse_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `reason` VARCHAR(255) NULL,
    `requested_by` BIGINT UNSIGNED NOT NULL,
    `dispatched_by` BIGINT UNSIGNED NULL,
    `received_by` BIGINT UNSIGNED NULL,
    `dispatched_at` DATETIME(3) NULL,
    `received_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_transfers_transfer_no_key`(`transfer_no`),
    INDEX `stock_transfers_from_warehouse_id_status_idx`(`from_warehouse_id`, `status`),
    INDEX `stock_transfers_to_warehouse_id_status_idx`(`to_warehouse_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `transfer_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,

    UNIQUE INDEX `stock_transfer_items_transfer_id_product_id_batch_id_key`(`transfer_id`, `product_id`, `batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expiry_alert_settings` (
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `early_warning_months` INTEGER NOT NULL DEFAULT 7,
    `warning_months` INTEGER NOT NULL DEFAULT 6,
    `urgent_months` INTEGER NOT NULL DEFAULT 3,
    `early_warning_label` VARCHAR(50) NOT NULL DEFAULT '提前关注',
    `warning_label` VARCHAR(50) NOT NULL DEFAULT '临期预警',
    `urgent_label` VARCHAR(50) NOT NULL DEFAULT '紧急处理',
    `expired_label` VARCHAR(50) NOT NULL DEFAULT '已到期',
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`organization_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NULL,
    `warehouse_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` VARCHAR(80) NULL,
    `request_id` VARCHAR(64) NOT NULL,
    `before_summary` JSON NULL,
    `after_summary` JSON NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `audit_logs_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stores` ADD CONSTRAINT `stores_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_products` ADD CONSTRAINT `store_products_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_products` ADD CONSTRAINT `store_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_barcodes` ADD CONSTRAINT `product_barcodes_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_barcodes` ADD CONSTRAINT `product_barcodes_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_batches` ADD CONSTRAINT `product_batches_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_batches` ADD CONSTRAINT `product_batches_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_batches` ADD CONSTRAINT `product_batches_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_store_roles` ADD CONSTRAINT `user_store_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_store_roles` ADD CONSTRAINT `user_store_roles_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_store_roles` ADD CONSTRAINT `user_store_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_warehouse_permissions` ADD CONSTRAINT `user_warehouse_permissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_warehouse_permissions` ADD CONSTRAINT `user_warehouse_permissions_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `product_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_performed_by_fkey` FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_reversal_of_id_fkey` FOREIGN KEY (`reversal_of_id`) REFERENCES `stock_movements`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `product_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_from_warehouse_id_fkey` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_to_warehouse_id_fkey` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_dispatched_by_fkey` FOREIGN KEY (`dispatched_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_received_by_fkey` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_transfer_id_fkey` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `product_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expiry_alert_settings` ADD CONSTRAINT `expiry_alert_settings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain checks not expressible in the Prisma schema.
ALTER TABLE `store_products`
    ADD CONSTRAINT `store_products_selling_price_nonnegative_check`
        CHECK (`selling_price_cents` IS NULL OR `selling_price_cents` >= 0),
    ADD CONSTRAINT `store_products_minimum_stock_nonnegative_check`
        CHECK (`minimum_stock` IS NULL OR `minimum_stock` >= 0);

ALTER TABLE `stock_movements`
    ADD CONSTRAINT `stock_movements_quantity_nonzero_check`
        CHECK (`quantity_delta` <> 0);

ALTER TABLE `inventory_balances`
    ADD CONSTRAINT `inventory_balances_quantity_nonnegative_check`
        CHECK (`quantity` >= 0),
    ADD CONSTRAINT `inventory_balances_version_nonnegative_check`
        CHECK (`version` >= 0);

ALTER TABLE `stock_transfer_items`
    ADD CONSTRAINT `stock_transfer_items_quantity_positive_check`
        CHECK (`quantity` > 0);

ALTER TABLE `expiry_alert_settings`
    ADD CONSTRAINT `expiry_alert_settings_threshold_order_check`
        CHECK (
            `early_warning_months` >= `warning_months`
            AND `warning_months` >= `urgent_months`
            AND `urgent_months` > 0
        );
