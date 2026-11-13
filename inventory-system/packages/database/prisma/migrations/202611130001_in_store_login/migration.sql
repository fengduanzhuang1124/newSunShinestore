-- CR-025: staff accounts that may sign in only inside the store, checked against the store's position at login.
-- Columns only, with defaults, so existing rows and older code are unaffected.
-- Rollback: ALTER TABLE users DROP COLUMN in_store_only;
--           ALTER TABLE stores DROP COLUMN latitude, DROP COLUMN longitude, DROP COLUMN login_radius_m;
--           DELETE FROM _prisma_migrations WHERE migration_name = '202611130001_in_store_login';
ALTER TABLE `users` ADD COLUMN `in_store_only` BOOLEAN NOT NULL DEFAULT false AFTER `must_change_password`;
ALTER TABLE `stores`
  ADD COLUMN `latitude` DECIMAL(9, 6) NULL AFTER `address`,
  ADD COLUMN `longitude` DECIMAL(9, 6) NULL AFTER `latitude`,
  ADD COLUMN `login_radius_m` INT UNSIGNED NOT NULL DEFAULT 300 AFTER `longitude`;
