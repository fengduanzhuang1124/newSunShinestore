const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateUser } = require('../middleware/auth');

// 仪表板数据接口
router.get('/stats', authenticateUser, dashboardController.getDashboardStats);
router.get('/hot-products', authenticateUser, dashboardController.getHotProducts);
router.get('/hot-brands', authenticateUser, dashboardController.getHotBrands);
router.get('/hot-categories', authenticateUser, dashboardController.getHotCategories);

module.exports = router;
