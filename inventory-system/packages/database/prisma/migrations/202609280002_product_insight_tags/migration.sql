CREATE TABLE `product_insight_tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `dimension` ENUM('AUDIENCE', 'HEALTH_NEED', 'USE_CASE') NOT NULL,
  `description` VARCHAR(255) NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `product_insight_tags_organization_id_code_key`(`organization_id`, `code`),
  INDEX `product_insight_tags_organization_id_dimension_status_idx`(`organization_id`, `dimension`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_insight_tag_assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` BIGINT UNSIGNED NOT NULL,
  `confidence` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  `evidence` VARCHAR(255) NULL,
  `source` VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  `review_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `assigned_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `product_insight_tag_assignments_product_id_tag_id_key`(`product_id`, `tag_id`),
  INDEX `product_insight_tag_assignments_organization_id_review_status_idx`(`organization_id`, `review_status`),
  INDEX `product_insight_tag_assignments_tag_id_review_status_idx`(`tag_id`, `review_status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product_insight_tags` ADD CONSTRAINT `product_insight_tags_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `product_insight_tag_assignments` ADD CONSTRAINT `product_insight_tag_assignments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `product_insight_tag_assignments` ADD CONSTRAINT `product_insight_tag_assignments_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `product_insight_tag_assignments` ADD CONSTRAINT `product_insight_tag_assignments_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `product_insight_tags`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `product_insight_tag_assignments` ADD CONSTRAINT `product_insight_tag_assignments_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `product_insight_tags` (`organization_id`, `code`, `name`, `dimension`, `description`, `updated_at`)
SELECT `id`, 'audience.children_family', '儿童家庭', 'AUDIENCE', '商品需求倾向于儿童或有儿童的家庭，不代表购买者真实年龄', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'audience.young_adult', '年轻人倾向', 'AUDIENCE', '商品需求倾向于年轻消费群体，不代表购买者真实年龄', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'audience.middle_age', '中年人倾向', 'AUDIENCE', '商品需求倾向于中年消费群体，不代表购买者真实年龄', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'audience.older_adult', '中老年倾向', 'AUDIENCE', '商品需求倾向于中老年健康需求，不代表购买者真实年龄', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'audience.women', '女性需求倾向', 'AUDIENCE', '商品需求具有女性消费倾向，不代表购买者真实性别', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'audience.sports', '运动人群倾向', 'AUDIENCE', '商品需求倾向于运动与恢复场景', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'health.cardiovascular', '心血管健康', 'HEALTH_NEED', '心血管与血脂管理相关需求', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'health.joint', '关节健康', 'HEALTH_NEED', '关节、骨骼与行动力相关需求', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'health.immune', '免疫支持', 'HEALTH_NEED', '免疫支持相关需求', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'health.sleep', '睡眠与情绪', 'HEALTH_NEED', '睡眠、压力与情绪支持相关需求', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'health.eye', '护眼需求', 'HEALTH_NEED', '眼部健康与视力支持相关需求', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'health.digestive', '肠胃健康', 'HEALTH_NEED', '消化、肠道与益生菌相关需求', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'health.beauty', '美容与抗衰', 'HEALTH_NEED', '美容、皮肤、头发及抗衰相关需求', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'use.daily', '日常保健', 'USE_CASE', '日常营养补充与长期保健', CURRENT_TIMESTAMP(3) FROM `organizations`
UNION ALL SELECT `id`, 'use.gift', '礼赠倾向', 'USE_CASE', '包装或组合更适合作为礼赠用途', CURRENT_TIMESTAMP(3) FROM `organizations`;
