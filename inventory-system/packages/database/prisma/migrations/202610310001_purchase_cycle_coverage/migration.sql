-- Purchase cycle and coverage (CR-009 P1, P3).
-- Upgrade:
--   1. purchase_order_items gains coverage_weeks (weeks of stock the line aims for, default 2) and quantity_edited
--      (whether a person changed the ordered quantity, so a recalculation leaves it alone). Existing lines get the
--      defaults; their quantities are not changed.
--   2. Purchase orders now run Wednesday to Tuesday instead of Monday to Sunday. week_start holds the UTC date of the
--      cycle's first local midnight (Pacific/Auckland is ahead of UTC, so a Monday cycle is stored as the Sunday).
--      Existing orders move forward two days into the cycle they were written for, so this week's draft stays current.
--      The shift keeps every (organization, store, week_start) distinct.

-- AlterTable
ALTER TABLE `purchase_order_items`
    ADD COLUMN `coverage_weeks` TINYINT NOT NULL DEFAULT 2,
    ADD COLUMN `quantity_edited` BOOLEAN NOT NULL DEFAULT false;

-- Move Monday-based cycles to Wednesday-based cycles.
UPDATE `purchase_orders` SET `week_start` = DATE_ADD(`week_start`, INTERVAL 2 DAY) WHERE DAYOFWEEK(`week_start`) = 1;

-- Rollback:
--   UPDATE `purchase_orders` SET `week_start` = DATE_SUB(`week_start`, INTERVAL 2 DAY) WHERE DAYOFWEEK(`week_start`) = 3;
--   ALTER TABLE `purchase_order_items` DROP COLUMN `coverage_weeks`, DROP COLUMN `quantity_edited`;
