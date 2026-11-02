ALTER TABLE `expiry_alert_settings`
    ALTER COLUMN `early_warning_months` SET DEFAULT 6,
    ALTER COLUMN `warning_months` SET DEFAULT 3,
    ALTER COLUMN `urgent_months` SET DEFAULT 2;

UPDATE `expiry_alert_settings`
SET
    `early_warning_months` = 6,
    `warning_months` = 3,
    `urgent_months` = 2,
    `early_warning_label` = '提前关注',
    `warning_label` = '临期预警',
    `urgent_label` = '紧急临期',
    `expired_label` = '已过期';
