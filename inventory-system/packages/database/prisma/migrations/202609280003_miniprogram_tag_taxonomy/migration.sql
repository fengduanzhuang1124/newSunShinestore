ALTER TABLE `product_insight_tags`
  MODIFY `dimension` ENUM('BUSINESS_CATEGORY', 'AUDIENCE', 'HEALTH_NEED', 'USE_CASE', 'OPERATION', 'MARKETING') NOT NULL,
  ADD COLUMN `parent_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `source` VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `external_id` VARCHAR(64) NULL,
  ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX `product_insight_tags_organization_id_source_external_id_key` (`organization_id`, `source`, `external_id`),
  ADD INDEX `product_insight_tags_parent_id_sort_order_idx` (`parent_id`, `sort_order`);

ALTER TABLE `product_insight_tags`
  ADD CONSTRAINT `product_insight_tags_parent_id_fkey`
  FOREIGN KEY (`parent_id`) REFERENCES `product_insight_tags`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT IGNORE INTO `product_insight_tags`
  (`organization_id`, `code`, `name`, `dimension`, `description`, `source`, `external_id`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT `id`, 'miniprogram.3', '买赠专区', 'MARKETING', '来自小程序分类', 'MINIPROGRAM', '3', 10, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.11', '新品速递', 'OPERATION', '来自小程序分类', 'MINIPROGRAM', '11', 20, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.4', '新西兰奶粉', 'BUSINESS_CATEGORY', '来自小程序分类', 'MINIPROGRAM', '4', 30, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.355', '新西兰蜂蜜', 'BUSINESS_CATEGORY', '来自小程序分类', 'MINIPROGRAM', '355', 40, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.2', '保健食品', 'BUSINESS_CATEGORY', '来自小程序分类', 'MINIPROGRAM', '2', 50, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.6', '母婴用品', 'BUSINESS_CATEGORY', '来自小程序分类', 'MINIPROGRAM', '6', 60, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.8', '洗护化妆', 'BUSINESS_CATEGORY', '来自小程序分类', 'MINIPROGRAM', '8', 70, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.16', '澳新好物', 'BUSINESS_CATEGORY', '来自小程序分类', 'MINIPROGRAM', '16', 80, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.12', '女性专区', 'AUDIENCE', '来自小程序分类', 'MINIPROGRAM', '12', 90, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.5', '热销爆款', 'OPERATION', '来自小程序分类', 'MINIPROGRAM', '5', 100, 'ACTIVE', NOW(), NOW() FROM `organizations`
UNION ALL SELECT `id`, 'miniprogram.10', '全部品牌', 'BUSINESS_CATEGORY', '来自小程序分类', 'MINIPROGRAM', '10', 110, 'ACTIVE', NOW(), NOW() FROM `organizations`;

INSERT IGNORE INTO `product_insight_tags`
  (`organization_id`, `code`, `name`, `dimension`, `description`, `parent_id`, `source`, `external_id`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT o.`id`, CONCAT('miniprogram.', child.external_id), child.name, 'HEALTH_NEED', '来自小程序保健食品子分类', parent.`id`, 'MINIPROGRAM', child.external_id, child.sort_order, 'ACTIVE', NOW(), NOW()
FROM `organizations` o
JOIN `product_insight_tags` parent ON parent.`organization_id` = o.`id` AND parent.`source` = 'MINIPROGRAM' AND parent.`external_id` = '2'
JOIN (
  SELECT '370' external_id, '角鲨烯+磷虾油' name, 10 sort_order UNION ALL
  SELECT '356', '深海鱼油', 20 UNION ALL SELECT '357', '护心辅酶', 30 UNION ALL
  SELECT '358', '卵磷脂', 40 UNION ALL SELECT '359', '护肝排毒', 50 UNION ALL
  SELECT '360', '护眼通鼻', 60 UNION ALL SELECT '361', '睡眠管理', 70 UNION ALL
  SELECT '362', '羊胎素', 80 UNION ALL SELECT '363', '综合维生素', 90 UNION ALL
  SELECT '364', '胶原蛋白', 100 UNION ALL SELECT '365', '抗氧化防衰', 110 UNION ALL
  SELECT '367', '女性健康', 120 UNION ALL SELECT '366', '儿童长高-钙镁锌', 130 UNION ALL
  SELECT '368', '血糖血脂', 140 UNION ALL SELECT '428', '补钙VD', 150 UNION ALL
  SELECT '369', '关节维护', 160 UNION ALL SELECT '371', '清肺润喉', 170 UNION ALL
  SELECT '373', '男士保健', 180 UNION ALL SELECT '372', '免疫力增强', 190 UNION ALL
  SELECT '374', '纤体排毒', 200 UNION ALL SELECT '375', '健脑缓压', 210 UNION ALL
  SELECT '451', '补铁补血', 220 UNION ALL SELECT '450', '甲状腺保健', 230 UNION ALL
  SELECT '418', '乳铁蛋白', 240 UNION ALL SELECT '399', '家庭药品', 250 UNION ALL
  SELECT '380', '肠胃益生菌', 260 UNION ALL SELECT '232', '宠物保健', 270
) child;
