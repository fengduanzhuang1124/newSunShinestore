const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

// 管理员接口：获取系统总体统计
router.get('/system', authenticateUser, requireAdmin, statisticsController.getSystemStats);

// 管理员接口：获取热卖商品统计
router.get('/hot-products', authenticateUser, requireAdmin, statisticsController.getHotProducts);

// 管理员接口：获取热卖分类统计
router.get('/hot-categories', authenticateUser, requireAdmin, statisticsController.getHotCategories);

// 管理员接口：获取销售趋势
router.get('/sales-trend', authenticateUser, requireAdmin, statisticsController.getSalesTrend);

module.exports = router;
