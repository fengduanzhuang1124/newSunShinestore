CREATE TABLE `warehouse_locations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `warehouse_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `zone` VARCHAR(40) NULL,
  `aisle` VARCHAR(40) NULL,
  `shelf` VARCHAR(40) NULL,
  `level` VARCHAR(40) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_by` BIGINT UNSIGNED NOT NULL,
  `updated_by` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `warehouse_locations_warehouse_id_code_key` (`warehouse_id`, `code`),
  INDEX `warehouse_locations_warehouse_id_status_name_idx` (`warehouse_id`, `status`, `name`),
  PRIMARY KEY (`id`),
  CONSTRAINT `warehouse_locations_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `warehouse_locations_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `warehouse_locations_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_placements` (
  `organization_id` BIGINT UNSIGNED NOT NULL,
  `warehouse_id` BIGINT UNSIGNED NOT NULL,
  `location_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `batch_id` BIGINT UNSIGNED NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `inventory_placements_warehouse_id_product_id_batch_id_idx` (`warehouse_id`, `product_id`, `batch_id`),
  INDEX `inventory_placements_location_id_product_id_idx` (`location_id`, `product_id`),
  PRIMARY KEY (`organization_id`, `warehouse_id`, `location_id`, `product_id`, `batch_id`),
  CONSTRAINT `inventory_placements_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_placements_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `warehouse_locations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_placements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_placements_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `product_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
