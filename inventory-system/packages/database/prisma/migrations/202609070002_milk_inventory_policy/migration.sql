-- Carton milk products are fulfilled by an external warehouse. They remain
-- available for sales analytics but must not create local inventory movements.
SET @milk_policy_column_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'pos_milk_product_candidates'
    AND column_name = 'suggested_inventory_policy'
);
SET @add_milk_policy_column = IF(
  @milk_policy_column_exists = 0,
  'ALTER TABLE `pos_milk_product_candidates` ADD COLUMN `suggested_inventory_policy` ENUM(''LOCAL_STOCK'', ''EXTERNAL_WAREHOUSE'', ''REVIEW_REQUIRED'') NOT NULL DEFAULT ''REVIEW_REQUIRED'' AFTER `suggested_pack_quantity`',
  'SELECT 1'
);
PREPARE add_milk_policy_column_statement FROM @add_milk_policy_column;
EXECUTE add_milk_policy_column_statement;
DEALLOCATE PREPARE add_milk_policy_column_statement;

SET @milk_policy_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pos_milk_product_candidates'
    AND index_name = 'pos_milk_candidate_store_policy_idx'
);
SET @add_milk_policy_index = IF(
  @milk_policy_index_exists = 0,
  'CREATE INDEX `pos_milk_candidate_store_policy_idx` ON `pos_milk_product_candidates`(`store_id`, `suggested_inventory_policy`)',
  'SELECT 1'
);
PREPARE add_milk_policy_index_statement FROM @add_milk_policy_index;
EXECUTE add_milk_policy_index_statement;
DEALLOCATE PREPARE add_milk_policy_index_statement;
