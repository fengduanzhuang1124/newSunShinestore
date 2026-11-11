-- REQ-016 A6: store sub-category label typed in by a person (e.g. "高级洗发", "香皂/伴手礼"). It takes part in category,
-- function and audience recognition together with the product names. Nullable, so existing rows and older code are
-- unaffected.
-- Rollback: ALTER TABLE products DROP COLUMN store_label;
--           DELETE FROM _prisma_migrations WHERE migration_name = '202611110002_product_store_label';
ALTER TABLE `products` ADD COLUMN `store_label` VARCHAR(60) NULL AFTER `category_name`;
