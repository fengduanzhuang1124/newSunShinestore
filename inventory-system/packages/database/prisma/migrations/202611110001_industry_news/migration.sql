-- Industry news feeds (REQ-016 part 3).
-- Upgrade: adds two new tables and the first four public RSS sources for every organization; no existing table or
-- row is changed.
--   news_sources  public RSS / Atom addresses, their region and the result of the last read
--   news_items    one row per article link (title, feed summary, link, publish date)
-- Compatibility: the running API ignores these tables until the news code is deployed.
-- Rollback:
--   DROP TABLE `news_items`, `news_sources`;
--   DELETE FROM `_prisma_migrations` WHERE `migration_name` = '202611110001_industry_news';

-- CreateTable
CREATE TABLE `news_sources` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `region` ENUM('ANZ', 'ASIA', 'GLOBAL') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_success_at` DATETIME(3) NULL,
    `last_failure_at` DATETIME(3) NULL,
    `last_error` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `news_sources_organization_id_url_key`(`organization_id`, `url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` BIGINT UNSIGNED NOT NULL,
    `source_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `summary` VARCHAR(600) NULL,
    `link` VARCHAR(700) NOT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `news_items_organization_id_link_key`(`organization_id`, `link`),
    INDEX `news_items_organization_id_published_at_idx`(`organization_id`, `published_at`),
    INDEX `news_items_source_id_created_at_idx`(`source_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `news_sources` ADD CONSTRAINT `news_sources_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_items` ADD CONSTRAINT `news_items_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_items` ADD CONSTRAINT `news_items_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `news_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- First sources (REQ-016 C1), checked to return RSS on 2026-11-11. NutraIngredients Asia is left out: its feed
-- returns the same articles as NutraIngredients. Administrators can switch sources off or add more.
INSERT INTO `news_sources` (`organization_id`, `name`, `url`, `region`, `updated_at`)
SELECT o.`id`, s.`name`, s.`url`, s.`region`, CURRENT_TIMESTAMP(3)
FROM `organizations` o
CROSS JOIN (
    SELECT 'NutraIngredients' AS `name`, 'https://www.nutraingredients.com/arc/outboundfeeds/rss/' AS `url`, 'GLOBAL' AS `region`
    UNION ALL SELECT 'FoodNavigator-Asia', 'https://www.foodnavigator-asia.com/arc/outboundfeeds/rss/', 'ASIA'
    UNION ALL SELECT 'Campaign Brief', 'https://www.campaignbrief.com/feed/', 'ANZ'
    UNION ALL SELECT 'StopPress', 'https://stoppress.co.nz/feed/', 'ANZ'
) s;
