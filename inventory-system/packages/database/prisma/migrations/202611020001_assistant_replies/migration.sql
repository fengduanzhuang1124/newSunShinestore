-- 阳光小助手 stage 2 (REQ-015).
-- Upgrade: adds four new tables only; no existing table or row is changed.
--   mail_milk_profiles    shipping line, pack, transit, ship-from and promotion of mail-order milk products (price stays on store_products)
--   assistant_aliases     customer wording mapped to words in product names
--   assistant_answers     fixed answers and questions that must go to a person
--   assistant_reply_logs  suggested replies and what staff did with them (no customer personal data)
-- Compatibility: the running API ignores these tables until the assistant code is deployed.
-- Rollback:
--   DROP TABLE `assistant_reply_logs`, `assistant_answers`, `assistant_aliases`, `mail_milk_profiles`;
--   DELETE FROM `_prisma_migrations` WHERE `migration_name` = '202611020001_assistant_replies';

-- CreateTable
CREATE TABLE `mail_milk_profiles` (
    `product_id` BIGINT UNSIGNED NOT NULL,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `display_name` VARCHAR(120) NOT NULL,
    `line` ENUM('NORMAL', 'EXPRESS') NOT NULL,
    `stage` TINYINT NULL,
    `pack_count` TINYINT NOT NULL,
    `pack_unit` VARCHAR(10) NOT NULL,
    `transit_text` VARCHAR(60) NOT NULL,
    `ship_from` VARCHAR(20) NOT NULL DEFAULT '新西兰',
    `promo_text` VARCHAR(120) NULL,
    `promo_discount_cents` INTEGER NULL,
    `out_of_stock` BOOLEAN NOT NULL DEFAULT false,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `mail_milk_profiles_organization_id_enabled_idx`(`organization_id`, `enabled`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assistant_aliases` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `term` VARCHAR(60) NOT NULL,
    `keyword` VARCHAR(120) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assistant_aliases_organization_id_term_key`(`organization_id`, `term`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assistant_answers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `topic` VARCHAR(60) NOT NULL,
    `keywords` VARCHAR(255) NOT NULL,
    `reply` TEXT NOT NULL,
    `handoff` BOOLEAN NOT NULL DEFAULT false,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assistant_answers_organization_id_enabled_idx`(`organization_id`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assistant_reply_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `question` TEXT NOT NULL,
    `intents` VARCHAR(120) NOT NULL,
    `reply` TEXT NOT NULL,
    `facts` JSON NOT NULL,
    `needs_human` BOOLEAN NOT NULL,
    `outcome` ENUM('PENDING', 'ADOPTED', 'EDITED', 'REJECTED', 'HANDOFF') NOT NULL DEFAULT 'PENDING',
    `edited_reply` TEXT NULL,
    `feedback_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `assistant_reply_logs_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `assistant_reply_logs_store_id_outcome_idx`(`store_id`, `outcome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mail_milk_profiles` ADD CONSTRAINT `mail_milk_profiles_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mail_milk_profiles` ADD CONSTRAINT `mail_milk_profiles_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assistant_aliases` ADD CONSTRAINT `assistant_aliases_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assistant_answers` ADD CONSTRAINT `assistant_answers_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assistant_reply_logs` ADD CONSTRAINT `assistant_reply_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assistant_reply_logs` ADD CONSTRAINT `assistant_reply_logs_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assistant_reply_logs` ADD CONSTRAINT `assistant_reply_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

