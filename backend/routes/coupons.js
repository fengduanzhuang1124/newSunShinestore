const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

// 获取优惠券列表
router.get('/', authenticateUser, couponController.getCoupons);

// 获取优惠券详情
router.get('/:id', authenticateUser, couponController.getCoupon);

// 创建优惠券
router.post('/', authenticateUser, requireAdmin, couponController.createCoupon);

// 更新优惠券
router.put('/:id', authenticateUser, requireAdmin, couponController.updateCoupon);

// 删除优惠券
router.delete('/:id', authenticateUser, requireAdmin, couponController.deleteCoupon);

// 切换优惠券状态
router.patch('/:id/status', authenticateUser, requireAdmin, couponController.toggleCouponStatus);

// 批量操作
router.post('/batch', authenticateUser, requireAdmin, couponController.batchOperation);

// 获取统计信息
router.get('/stats/overview', authenticateUser, couponController.getCouponStats);

module.exports = router;
