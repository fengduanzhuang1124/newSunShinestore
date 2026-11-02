-- Direct-ship products (CR-005): sold through the POS but shipped to customers from elsewhere, so their sales do
-- not deduct store stock and they are never suggested for purchase.
-- Upgrade: adds a column defaulting to false; behaviour is unchanged until a product is marked.

-- AlterTable
ALTER TABLE `store_products` ADD COLUMN `direct_ship` BOOLEAN NOT NULL DEFAULT false;

-- Rollback (POS lines already marked DIRECT_SHIP keep the marker and are not re-deducted):
--   ALTER TABLE `store_products` DROP COLUMN `direct_ship`;
