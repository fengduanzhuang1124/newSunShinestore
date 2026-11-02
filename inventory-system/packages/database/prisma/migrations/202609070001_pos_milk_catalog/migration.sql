CREATE TABLE `pos_milk_product_candidates` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `external_product_id` VARCHAR(64) NOT NULL,
    `source_sku` VARCHAR(64) NULL,
    `barcode` VARCHAR(128) NULL,
    `source_name` VARCHAR(255) NOT NULL,
    `suggested_english_name` VARCHAR(255) NOT NULL,
    `suggested_chinese_name` VARCHAR(255) NULL,
    `suggested_brand` VARCHAR(80) NOT NULL,
    `suggested_pack_quantity` INTEGER NULL,
    `carton_price_matched` BOOLEAN NOT NULL DEFAULT false,
    `sale_price` DECIMAL(14, 2) NULL,
    `source_status` VARCHAR(32) NULL,
    `recognition_reason` VARCHAR(255) NOT NULL,
    `review_status` ENUM('PENDING', 'APPROVED', 'IGNORED') NOT NULL DEFAULT 'PENDING',
    `translation_status` ENUM('UNTRANSLATED', 'DRAFT', 'APPROVED') NOT NULL DEFAULT 'UNTRANSLATED',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_milk_product_candidates_store_id_external_product_id_key`(`store_id`, `external_product_id`),
    INDEX `pos_milk_product_candidates_organization_id_brand_review_idx`(`organization_id`, `suggested_brand`, `review_status`),
    INDEX `pos_milk_product_candidates_store_id_status_review_idx`(`store_id`, `status`, `review_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pos_milk_product_candidates`
    ADD CONSTRAINT `pos_milk_product_candidates_organization_id_fkey`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `pos_milk_product_candidates`
    ADD CONSTRAINT `pos_milk_product_candidates_store_id_fkey`
    FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- This table is observational only. It does not create stock movements or change balances.
