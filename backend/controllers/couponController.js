const db = require('../db');

// 获取优惠券列表
const getCoupons = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, type, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    
    if (keyword) {
      whereClause += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM coupons ${whereClause}`;
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;
    
    // 获取数据
    const dataQuery = `
      SELECT * FROM coupons 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [coupons] = await db.execute(dataQuery, [...params, parseInt(pageSize), parseInt(offset)]);
    
    res.json({
      success: true,
      data: {
        coupons,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    console.error('获取优惠券列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取优惠券列表失败'
    });
  }
};

// 获取单个优惠券详情
const getCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'SELECT * FROM coupons WHERE id = ?';
    const [coupons] = await db.execute(query, [id]);
    
    if (coupons.length === 0) {
      return res.status(404).json({
        success: false,
        message: '优惠券不存在'
      });
    }
    
    res.json({
      success: true,
      data: coupons[0]
    });
  } catch (error) {
    console.error('获取优惠券详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取优惠券详情失败'
    });
  }
};

// 创建优惠券
const createCoupon = async (req, res) => {
  try {
    const {
      name,
      code,
      type,
      discountType,
      discountValue,
      minAmount,
      productIds,
      holidayName,
      holidayYear,
      campaignName,
      usageLimit,
      userLimit,
      startDate,
      endDate,
      description
    } = req.body;
    
    // 检查优惠券代码是否已存在
    const checkQuery = 'SELECT id FROM coupons WHERE code = ?';
    const [existing] = await db.execute(checkQuery, [code]);
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '优惠券代码已存在'
      });
    }
    
    // 插入优惠券
    const insertQuery = `
      INSERT INTO coupons (
        name, code, type, discount_type, discount_value, min_amount,
        product_ids, holiday_name, holiday_year, campaign_name,
        usage_limit, user_limit, start_date, end_date, description,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
    `;
    
    const [result] = await db.execute(insertQuery, [
      name, code, type, discountType, discountValue, minAmount,
      JSON.stringify(productIds || []), holidayName, holidayYear, campaignName,
      usageLimit, userLimit, startDate, endDate, description
    ]);
    
    res.json({
      success: true,
      message: '优惠券创建成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('创建优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '创建优惠券失败'
    });
  }
};

// 更新优惠券
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      type,
      discountType,
      discountValue,
      minAmount,
      productIds,
      holidayName,
      holidayYear,
      campaignName,
      usageLimit,
      userLimit,
      startDate,
      endDate,
      description
    } = req.body;
    
    // 检查优惠券是否存在
    const checkQuery = 'SELECT id FROM coupons WHERE id = ?';
    const [existing] = await db.execute(checkQuery, [id]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '优惠券不存在'
      });
    }
    
    // 检查优惠券代码是否被其他优惠券使用
    const codeCheckQuery = 'SELECT id FROM coupons WHERE code = ? AND id != ?';
    const [codeExisting] = await db.execute(codeCheckQuery, [code, id]);
    
    if (codeExisting.length > 0) {
      return res.status(400).json({
        success: false,
        message: '优惠券代码已被其他优惠券使用'
      });
    }
    
    // 更新优惠券
    const updateQuery = `
      UPDATE coupons SET
        name = ?, code = ?, type = ?, discount_type = ?, discount_value = ?, min_amount = ?,
        product_ids = ?, holiday_name = ?, holiday_year = ?, campaign_name = ?,
        usage_limit = ?, user_limit = ?, start_date = ?, end_date = ?, description = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.execute(updateQuery, [
      name, code, type, discountType, discountValue, minAmount,
      JSON.stringify(productIds || []), holidayName, holidayYear, campaignName,
      usageLimit, userLimit, startDate, endDate, description, id
    ]);
    
    res.json({
      success: true,
      message: '优惠券更新成功'
    });
  } catch (error) {
    console.error('更新优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '更新优惠券失败'
    });
  }
};

// 删除优惠券
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查优惠券是否存在
    const checkQuery = 'SELECT id FROM coupons WHERE id = ?';
    const [existing] = await db.execute(checkQuery, [id]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '优惠券不存在'
      });
    }
    
    // 删除优惠券
    const deleteQuery = 'DELETE FROM coupons WHERE id = ?';
    await db.execute(deleteQuery, [id]);
    
    res.json({
      success: true,
      message: '优惠券删除成功'
    });
  } catch (error) {
    console.error('删除优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '删除优惠券失败'
    });
  }
};

// 切换优惠券状态
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updateQuery = 'UPDATE coupons SET status = ?, updated_at = NOW() WHERE id = ?';
    await db.execute(updateQuery, [status, id]);
    
    res.json({
      success: true,
      message: '优惠券状态更新成功'
    });
  } catch (error) {
    console.error('更新优惠券状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新优惠券状态失败'
    });
  }
};

// 批量操作优惠券
const batchOperation = async (req, res) => {
  try {
    const { action, couponIds } = req.body;
    
    if (!couponIds || couponIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要操作的优惠券'
      });
    }
    
    let updateQuery = '';
    let message = '';
    
    switch (action) {
      case 'enable':
        updateQuery = 'UPDATE coupons SET status = "active", updated_at = NOW() WHERE id IN (?)';
        message = '批量启用成功';
        break;
      case 'disable':
        updateQuery = 'UPDATE coupons SET status = "disabled", updated_at = NOW() WHERE id IN (?)';
        message = '批量禁用成功';
        break;
      case 'delete':
        updateQuery = 'DELETE FROM coupons WHERE id IN (?)';
        message = '批量删除成功';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '无效的操作类型'
        });
    }
    
    const placeholders = couponIds.map(() => '?').join(',');
    const finalQuery = updateQuery.replace('?', placeholders);
    
    await db.execute(finalQuery, couponIds);
    
    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('批量操作失败:', error);
    res.status(500).json({
      success: false,
      message: '批量操作失败'
    });
  }
};

// 获取优惠券统计信息
const getCouponStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabled,
        SUM(used_count) as totalUsed
      FROM coupons
    `;
    
    const [stats] = await db.execute(statsQuery);
    
    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('获取优惠券统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取优惠券统计失败'
    });
  }
};

module.exports = {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  batchOperation,
  getCouponStats
};
