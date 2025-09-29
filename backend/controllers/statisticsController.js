const db = require('../db');

class StatisticsController {
  // 获取系统总体统计
  async getSystemStats(req, res) {
    try {
      // 获取用户总数
      const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
      
      // 获取商品总数
      const [productCount] = await db.query('SELECT COUNT(*) as count FROM products WHERE status = "on"');
      
      // 获取订单总数
      const [orderCount] = await db.query('SELECT COUNT(*) as count FROM orders');
      
      // 获取总销售额
      const [salesResult] = await db.query(`
        SELECT COALESCE(SUM(total_price), 0) as total_sales 
        FROM orders 
        WHERE status IN ('paid', 'shipped', 'finished')
      `);

      res.json({
        code: 200,
        msg: '获取系统统计成功',
        data: {
          userCount: userCount[0].count,
          productCount: productCount[0].count,
          orderCount: orderCount[0].count,
          totalSales: parseFloat(salesResult[0].total_sales).toFixed(2)
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取系统统计失败',
        error: err.message 
      });
    }
  }

  // 获取热卖商品统计
  async getHotProducts(req, res) {
    try {
      const { period = 'week', limit = 10 } = req.query; // week, month, year
      
      // 根据时间段计算销量
      let dateCondition = '';
      switch (period) {
        case 'week':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
          break;
        case 'month':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
          break;
        case 'year':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
          break;
      }

      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.name,
          COALESCE(SUM(oi.quantity), 0) as total_sales,
          COALESCE(SUM(oi.quantity * oi.price), 0) as total_gmv
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('paid', 'shipped', 'finished') ${dateCondition}
        WHERE p.status = 'on'
        GROUP BY p.id, p.name
        ORDER BY total_sales DESC
        LIMIT ?
      `, [parseInt(limit)]);

      res.json({
        code: 200,
        msg: '获取热卖商品统计成功',
        data: rows.map(row => ({
          id: row.id,
          name: row.name,
          weekSales: row.total_sales,
          weekGMV: parseFloat(row.total_gmv).toFixed(2)
        }))
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取热卖商品统计失败',
        error: err.message 
      });
    }
  }

  // 获取热卖分类统计
  async getHotCategories(req, res) {
    try {
      const { period = 'week', limit = 10 } = req.query;
      
      // 根据时间段计算销量
      let dateCondition = '';
      switch (period) {
        case 'week':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
          break;
        case 'month':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
          break;
        case 'year':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
          break;
      }

      const [rows] = await db.query(`
        SELECT 
          p.category,
          COALESCE(SUM(oi.quantity), 0) as total_sales,
          COALESCE(SUM(oi.quantity * oi.price), 0) as total_gmv
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('paid', 'shipped', 'finished') ${dateCondition}
        WHERE p.status = 'on' AND p.category IS NOT NULL AND p.category != ''
        GROUP BY p.category
        ORDER BY total_sales DESC
        LIMIT ?
      `, [parseInt(limit)]);

      res.json({
        code: 200,
        msg: '获取热卖分类统计成功',
        data: rows.map((row, index) => ({
          id: index + 1,
          name: row.category,
          weekSales: row.total_sales,
          weekGMV: parseFloat(row.total_gmv).toFixed(2)
        }))
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取热卖分类统计失败',
        error: err.message 
      });
    }
  }

  // 获取销售趋势数据
  async getSalesTrend(req, res) {
    try {
      const { period = 'week' } = req.query; // week, month, year
      
      let dateFormat = '';
      let interval = '';
      
      switch (period) {
        case 'week':
          dateFormat = '%Y-%m-%d';
          interval = '1 DAY';
          break;
        case 'month':
          dateFormat = '%Y-%m-%d';
          interval = '1 DAY';
          break;
        case 'year':
          dateFormat = '%Y-%m';
          interval = '1 MONTH';
          break;
      }

      const [rows] = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, ?) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(total_price), 0) as total_sales
        FROM orders 
        WHERE status IN ('paid', 'shipped', 'finished')
        AND created_at >= DATE_SUB(NOW(), INTERVAL 1 ${period.toUpperCase()})
        GROUP BY DATE_FORMAT(created_at, ?)
        ORDER BY date ASC
      `, [dateFormat, dateFormat]);

      res.json({
        code: 200,
        msg: '获取销售趋势成功',
        data: rows.map(row => ({
          date: row.date,
          orderCount: row.order_count,
          totalSales: parseFloat(row.total_sales).toFixed(2)
        }))
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取销售趋势失败',
        error: err.message 
      });
    }
  }
}

module.exports = new StatisticsController();
