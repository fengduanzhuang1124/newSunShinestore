const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

// 公开接口：获取所有品牌
router.get('/', brandController.getBrands);

// 公开接口：获取单个品牌详情
router.get('/:id', brandController.getBrand);

// 公开接口：获取品牌统计信息
router.get('/stats/ranking', brandController.getBrandStats);

// 管理员接口：创建品牌
router.post('/', authenticateUser, requireAdmin, brandController.createBrand);

// 管理员接口：更新品牌
router.put('/:id', authenticateUser, requireAdmin, brandController.updateBrand);

// 管理员接口：删除品牌
router.delete('/:id', authenticateUser, requireAdmin, brandController.deleteBrand);

module.exports = router;
