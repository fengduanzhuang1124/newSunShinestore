-- Historical inventory reconciliation may reveal sales that predate the imported
-- opening balance. Preserve that discrepancy as a negative balance so it can be
-- audited instead of silently clamping it to zero.
--
-- Normal issue, manual decrease and receipt reversal paths continue to enforce
-- sufficient stock in application transactions. This migration only removes the
-- database-wide check that prevented controlled reconciliation imports.
ALTER TABLE `inventory_balances`
    DROP CHECK `inventory_balances_quantity_nonnegative_check`;

-- Rollback (only after all negative balances have been investigated and corrected):
-- ALTER TABLE `inventory_balances`
--     ADD CONSTRAINT `inventory_balances_quantity_nonnegative_check`
--         CHECK (`quantity` >= 0);
