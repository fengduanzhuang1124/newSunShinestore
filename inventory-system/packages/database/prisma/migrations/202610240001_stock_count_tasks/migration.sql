-- Stock count tasks (REQ-012): a recount list worked through product by product on the phone.
-- Upgrade: creates two new tables only; existing tables, rows and behaviour are unchanged until a task is
-- imported. Confirming an item writes ordinary STOCKTAKE_GAIN / STOCKTAKE_LOSS movements (reference_type
-- STOCK_COUNT); POS sale lines ordered before a product's confirmation are marked COVERED_BY_STOCKTAKE in
-- pos_order_items.inventory_review_reason (existing VARCHAR column) instead of being deducted.
-- CreateTable
CREATE TABLE `stock_count_tasks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `warehouse_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `status` ENUM('OPEN', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `created_by` BIGINT UNSIGNED NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_count_tasks_warehouse_id_status_idx`(`warehouse_id`, `status`),
    UNIQUE INDEX `stock_count_tasks_organization_id_code_key`(`organization_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_count_task_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `priority` TINYINT UNSIGNED NOT NULL,
    `reasons` VARCHAR(500) NOT NULL,
    `source` ENUM('PLANNED', 'ADDED') NOT NULL DEFAULT 'PLANNED',
    `status` ENUM('PENDING', 'CONFIRMED') NOT NULL DEFAULT 'PENDING',
    `system_quantity` INTEGER NULL,
    `counted_quantity` INTEGER NULL,
    `confirm_count` INTEGER NOT NULL DEFAULT 0,
    `confirmed_by` BIGINT UNSIGNED NULL,
    `confirmed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_count_task_items_task_id_status_priority_idx`(`task_id`, `status`, `priority`),
    INDEX `stock_count_task_items_product_id_confirmed_at_idx`(`product_id`, `confirmed_at`),
    UNIQUE INDEX `stock_count_task_items_task_id_product_id_key`(`task_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_count_tasks` ADD CONSTRAINT `stock_count_tasks_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_tasks` ADD CONSTRAINT `stock_count_tasks_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_tasks` ADD CONSTRAINT `stock_count_tasks_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_tasks` ADD CONSTRAINT `stock_count_tasks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_task_items` ADD CONSTRAINT `stock_count_task_items_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `stock_count_tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_task_items` ADD CONSTRAINT `stock_count_task_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_task_items` ADD CONSTRAINT `stock_count_task_items_confirmed_by_fkey` FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Rollback (stock movements written by confirmations stay; they are the source of truth):
--   DROP TABLE `stock_count_task_items`;
--   DROP TABLE `stock_count_tasks`;
-- POS lines already marked COVERED_BY_STOCKTAKE keep that marker: the API version before REQ-012 lists them
-- in the data center review lines but never re-deducts them (reapply only picks UNMAPPED, REVIEW_REQUIRED and
-- INSUFFICIENT_INVENTORY).
