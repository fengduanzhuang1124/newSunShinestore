INSERT IGNORE INTO `permissions` (`code`, `description`) VALUES
  ('management.overview.view', '查看经营总览与门店经营基线'),
  ('management.sales.view', '查看销售分析与商品品牌分析'),
  ('management.inventory.view', '查看库存经营分析'),
  ('management.pos.sync', '查看同步状态并执行POS手动同步'),
  ('management.pos.issues', '查看POS异常与待复核记录'),
  ('management.permissions.manage', '管理经营系统角色权限');

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT `roles`.`id`, `permissions`.`id`
FROM `roles`
CROSS JOIN `permissions`
WHERE `roles`.`code` = 'ADMIN'
  AND `permissions`.`code` IN (
    'management.overview.view',
    'management.sales.view',
    'management.inventory.view',
    'management.pos.sync',
    'management.pos.issues',
    'management.permissions.manage'
  );
