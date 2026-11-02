-- Product home locations (CR-008 F4): one location per product and warehouse, set one at a time or in bulk by brand.
-- Upgrade: new table only; existing tables and data are not touched. inventory_placements (batch + quantity) stays as is.

-- CreateTable
CREATE TABLE `product_locations` (
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `warehouse_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `location_id` BIGINT UNSIGNED NOT NULL,
    `updated_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_locations_location_id_idx`(`location_id`),
    INDEX `product_locations_product_id_idx`(`product_id`),
    INDEX `product_locations_warehouse_id_idx`(`warehouse_id`),
    PRIMARY KEY (`organization_id`, `warehouse_id`, `product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_locations` ADD CONSTRAINT `product_locations_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `product_locations` ADD CONSTRAINT `product_locations_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `product_locations` ADD CONSTRAINT `product_locations_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `warehouse_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rollback (no other table refers to it; audit rows stay):
--   DROP TABLE `product_locations`;
