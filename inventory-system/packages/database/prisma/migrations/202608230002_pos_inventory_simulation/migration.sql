-- POS inventory simulation only. These tables never update stock_movements or inventory_balances.
-- Rollback is allowed only for disposable simulation data:
-- DROP TABLE pos_inventory_simulation_items; DROP TABLE pos_inventory_simulations;

CREATE TABLE `pos_inventory_simulations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('READY', 'INSUFFICIENT', 'REVIEW_REQUIRED') NOT NULL,
    `inventory_snapshot` DATETIME(3) NOT NULL,
    `source_fingerprint` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_inventory_simulations_order_id_key`(`order_id`),
    INDEX `pos_inventory_simulations_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `pos_inventory_simulations_store_id_status_created_at_idx`(`store_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_inventory_simulation_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `simulation_id` BIGINT UNSIGNED NOT NULL,
    `order_item_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `sold_quantity` INTEGER NOT NULL,
    `quantity_before` INTEGER NOT NULL,
    `projected_quantity` INTEGER NOT NULL,
    `status` ENUM('READY', 'INSUFFICIENT', 'REVIEW_REQUIRED') NOT NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_inventory_simulation_items_order_item_id_key`(`order_item_id`),
    INDEX `pos_inventory_simulation_items_simulation_id_status_idx`(`simulation_id`, `status`),
    INDEX `pos_inventory_simulation_items_product_id_status_idx`(`product_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pos_inventory_simulations` ADD CONSTRAINT `pos_inventory_simulations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_inventory_simulations` ADD CONSTRAINT `pos_inventory_simulations_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_inventory_simulations` ADD CONSTRAINT `pos_inventory_simulations_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `pos_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_inventory_simulation_items` ADD CONSTRAINT `pos_inventory_simulation_items_simulation_id_fkey` FOREIGN KEY (`simulation_id`) REFERENCES `pos_inventory_simulations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_inventory_simulation_items` ADD CONSTRAINT `pos_inventory_simulation_items_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `pos_order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pos_inventory_simulation_items` ADD CONSTRAINT `pos_inventory_simulation_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
