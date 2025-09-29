const db = require('../db');

// 获取仪表板统计数据
const getDashboardStats = async (req, res) => {
  try {
    // 获取今日GMV和订单数
    const today = new Date().toISOString().split('T')[0];
    const [todayStats] = await db.query(`
      SELECT 
        COALESCE(SUM(final_price), 0) as todayGMV,
        COUNT(*) as todayOrders
      FROM orders 
      WHERE DATE(created_at) = ?
    `, [today]);

    // 获取昨日GMV和订单数
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [yesterdayStats] = await db.query(`
      SELECT 
        COALESCE(SUM(final_price), 0) as yesterdayGMV,
        COUNT(*) as yesterdayOrders
      FROM orders 
      WHERE DATE(created_at) = ?
    `, [yesterday]);

    // 获取本周GMV和订单数
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const [weekStats] = await db.query(`
      SELECT 
        COALESCE(SUM(final_price), 0) as weekGMV,
        COUNT(*) as weekOrders
      FROM orders 
      WHERE DATE(created_at) >= ?
    `, [startOfWeek.toISOString().split('T')[0]]);

    // 获取上周GMV和订单数
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const [lastWeekStats] = await db.query(`
      SELECT 
        COALESCE(SUM(final_price), 0) as lastWeekGMV,
        COUNT(*) as lastWeekOrders
      FROM orders 
      WHERE DATE(created_at) >= ? AND DATE(created_at) < ?
    `, [startOfLastWeek.toISOString().split('T')[0], startOfWeek.toISOString().split('T')[0]]);

    // 计算变化百分比
    const todayGMVChange = yesterdayStats[0].yesterdayGMV > 0 
      ? ((todayStats[0].todayGMV - yesterdayStats[0].yesterdayGMV) / yesterdayStats[0].yesterdayGMV * 100).toFixed(2)
      : '0.00';
    
    const todayOrdersChange = yesterdayStats[0].yesterdayOrders > 0 
      ? ((todayStats[0].todayOrders - yesterdayStats[0].yesterdayOrders) / yesterdayStats[0].yesterdayOrders * 100).toFixed(2)
      : '0.00';

    const weekGMVChange = lastWeekStats[0].lastWeekGMV > 0 
      ? ((weekStats[0].weekGMV - lastWeekStats[0].lastWeekGMV) / lastWeekStats[0].lastWeekGMV * 100).toFixed(2)
      : '0.00';

    const weekOrdersChange = lastWeekStats[0].lastWeekOrders > 0 
      ? ((weekStats[0].weekOrders - lastWeekStats[0].lastWeekOrders) / lastWeekStats[0].lastWeekOrders * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      data: {
        todayGMV: todayStats[0].todayGMV,
        todayOrders: todayStats[0].todayOrders,
        weekGMV: weekStats[0].weekGMV,
        weekOrders: weekStats[0].weekOrders,
        todayGMVChange,
        todayOrdersChange,
        weekGMVChange,
        weekOrdersChange
      }
    });
  } catch (error) {
    console.error('获取仪表板统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取仪表板统计数据失败',
      error: error.message
    });
  }
};

// 获取热卖商品
const getHotProducts = async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id as productId,
        p.name,
        COALESCE(SUM(oi.quantity), 0) as weeklySales,
        COALESCE(SUM(oi.quantity * oi.price), 0) as weeklyGMV,
        c.name as category,
        b.name as brand
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY p.id, p.name, c.name, b.name
      ORDER BY weeklySales DESC
      LIMIT 10
    `;
    
    const [products] = await db.query(query);
    
    res.json({
      success: true,
      data: {
        products: products || []
      }
    });
  } catch (error) {
    console.error('获取热卖商品失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热卖商品失败',
      error: error.message
    });
  }
};

// 获取热卖品牌
const getHotBrands = async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id as brandId,
        b.name,
        COALESCE(SUM(oi.quantity), 0) as weeklySales,
        COALESCE(SUM(oi.quantity * oi.price), 0) as weeklyGMV
      FROM brands b
      LEFT JOIN products p ON b.id = p.brand_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY b.id, b.name
      ORDER BY weeklySales DESC
      LIMIT 10
    `;
    
    const [brands] = await db.query(query);
    
    res.json({
      success: true,
      data: {
        brands: brands || []
      }
    });
  } catch (error) {
    console.error('获取热卖品牌失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热卖品牌失败',
      error: error.message
    });
  }
};

// 获取热卖分类
const getHotCategories = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id as categoryId,
        c.name,
        COALESCE(SUM(oi.quantity), 0) as weeklySales,
        COALESCE(SUM(oi.quantity * oi.price), 0) as weeklyGMV
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY c.id, c.name
      ORDER BY weeklySales DESC
      LIMIT 10
    `;
    
    const [categories] = await db.query(query);
    
    res.json({
      success: true,
      data: {
        categories: categories || []
      }
    });
  } catch (error) {
    console.error('获取热卖分类失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热卖分类失败',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getHotProducts,
  getHotBrands,
  getHotCategories
};
