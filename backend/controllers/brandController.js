const db = require('../db');

class BrandController {
  // 获取所有品牌
  async getBrands(req, res) {
    try {
      const { page = 1, pageSize = 10, search = '', status = '' } = req.query;
      
      // 构建查询条件
      let whereConditions = [];
      let queryParams = [];

      if (search) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // 计算分页
      const offset = (page - 1) * pageSize;
      
      // 获取总数
      const [countResult] = await db.query(`SELECT COUNT(*) as total FROM brands ${whereClause}`, queryParams);
      const total = countResult[0].total;
      
      // 获取数据
      const [rows] = await db.query(
        `SELECT * FROM brands ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...queryParams, parseInt(pageSize), offset]
      );

      res.json({
        code: 200,
        msg: '获取品牌列表成功',
        data: {
          list: rows,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取品牌列表失败',
        error: err.message 
      });
    }
  }

  // 获取单个品牌详情
  async getBrand(req, res) {
    try {
      const { id } = req.params;
      const [rows] = await db.query('SELECT * FROM brands WHERE id = ?', [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          msg: '品牌不存在'
        });
      }

      res.json({
        code: 200,
        msg: '获取品牌详情成功',
        data: rows[0]
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取品牌详情失败',
        error: err.message 
      });
    }
  }

  // 创建品牌
  async createBrand(req, res) {
    try {
      const { name, logo, description, status = 'on' } = req.body;
      
      if (!name) {
        return res.status(400).json({
          code: 400,
          msg: '品牌名称不能为空'
        });
      }

      // 检查品牌名称是否已存在
      const [existing] = await db.query('SELECT id FROM brands WHERE name = ?', [name]);
      if (existing.length > 0) {
        return res.status(400).json({
          code: 400,
          msg: '品牌名称已存在'
        });
      }

      const [result] = await db.query(
        'INSERT INTO brands (name, logo, description, status) VALUES (?, ?, ?, ?)',
        [name, logo, description, status]
      );

      res.status(201).json({
        code: 201,
        msg: '品牌创建成功',
        data: { id: result.insertId }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '品牌创建失败',
        error: err.message 
      });
    }
  }

  // 更新品牌
  async updateBrand(req, res) {
    try {
      const { id } = req.params;
      const { name, logo, description, status } = req.body;
      
      // 检查品牌是否存在
      const [existing] = await db.query('SELECT id FROM brands WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({
          code: 404,
          msg: '品牌不存在'
        });
      }

      // 如果更新名称，检查是否重复
      if (name) {
        const [duplicate] = await db.query('SELECT id FROM brands WHERE name = ? AND id != ?', [name, id]);
        if (duplicate.length > 0) {
          return res.status(400).json({
            code: 400,
            msg: '品牌名称已存在'
          });
        }
      }

      // 构建更新字段
      const updateFields = [];
      const updateValues = [];
      
      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      if (logo !== undefined) {
        updateFields.push('logo = ?');
        updateValues.push(logo);
      }
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description);
      }
      if (status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(status);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          code: 400,
          msg: '没有要更新的字段'
        });
      }

      updateValues.push(id);
      await db.query(
        `UPDATE brands SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      res.json({
        code: 200,
        msg: '品牌更新成功'
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '品牌更新失败',
        error: err.message 
      });
    }
  }

  // 删除品牌
  async deleteBrand(req, res) {
    try {
      const { id } = req.params;
      
      // 检查品牌是否存在
      const [existing] = await db.query('SELECT id FROM brands WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({
          code: 404,
          msg: '品牌不存在'
        });
      }

      // 检查是否有商品使用该品牌
      const [products] = await db.query('SELECT id FROM products WHERE brand_id = ?', [id]);
      if (products.length > 0) {
        return res.status(400).json({
          code: 400,
          msg: '该品牌下还有商品，无法删除'
        });
      }

      await db.query('DELETE FROM brands WHERE id = ?', [id]);

      res.json({
        code: 200,
        msg: '品牌删除成功'
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '品牌删除失败',
        error: err.message 
      });
    }
  }

  // 获取品牌统计信息
  async getBrandStats(req, res) {
    try {
      const { period = 'week' } = req.query; // week, month, year
      
      // 根据时间段计算销量和GMV
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
          b.id,
          b.name,
          COALESCE(SUM(oi.quantity), 0) as total_sales,
          COALESCE(SUM(oi.quantity * oi.price), 0) as total_gmv
        FROM brands b
        LEFT JOIN products p ON b.id = p.brand_id
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('paid', 'shipped', 'finished') ${dateCondition}
        WHERE b.status = 'on'
        GROUP BY b.id, b.name
        ORDER BY total_sales DESC
        LIMIT 10
      `);

      res.json({
        code: 200,
        msg: '获取品牌统计成功',
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
        msg: '获取品牌统计失败',
        error: err.message 
      });
    }
  }
}

module.exports = new BrandController();
