ALTER TABLE `pos_milk_product_candidates`
  ADD COLUMN `last_review_request_id` VARCHAR(64) NULL,
  ADD COLUMN `reviewed_at` DATETIME(3) NULL,
  ADD UNIQUE INDEX `pos_milk_candidate_review_request_key`(`last_review_request_id`);
