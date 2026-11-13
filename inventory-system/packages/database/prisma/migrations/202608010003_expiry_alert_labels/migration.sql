ALTER TABLE `expiry_alert_settings`
    ALTER COLUMN `urgent_label` SET DEFAULT '紧急临期',
    ALTER COLUMN `expired_label` SET DEFAULT '已过期';
