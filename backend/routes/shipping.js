const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shippingController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

// 运费规则管理
router.get('/rules', authenticateUser, shippingController.getShippingRules);
router.get('/rules/:id', authenticateUser, shippingController.getShippingRule);
router.post('/rules', authenticateUser, shippingController.createShippingRule);
router.put('/rules/:id', authenticateUser, shippingController.updateShippingRule);
router.delete('/rules/:id', authenticateUser, shippingController.deleteShippingRule);
router.patch('/rules/:id/toggle', authenticateUser, shippingController.toggleShippingRuleStatus);

// 地区运费配置
router.get('/regions', authenticateUser, shippingController.getRegionShippingConfig);
router.put('/regions', authenticateUser, shippingController.updateRegionShippingConfig);

// 运费计算
router.post('/calculate', authenticateUser, shippingController.calculateShipping);

module.exports = router;
