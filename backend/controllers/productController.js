const db = require('../db');

class ProductController {
  // 获取所有商品（公开）- 支持分页、搜索、分类
  async getProducts(req, res) {
    try {
      const { 
        page = 1, 
        pageSize = 10, 
        search = '', 
        category = '', 
        minPrice = '', 
        maxPrice = '',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      // 构建查询条件
      let whereConditions = ['status = "on"'];
      let queryParams = [];

      // 搜索条件
      if (search) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // 分类条件
      if (category) {
        whereConditions.push('category = ?');
        queryParams.push(category);
      }

      // 价格范围
      if (minPrice) {
        whereConditions.push('price >= ?');
        queryParams.push(parseFloat(minPrice));
      }
      if (maxPrice) {
        whereConditions.push('price <= ?');
        queryParams.push(parseFloat(maxPrice));
      }

      // 排序验证
      const allowedSortFields = ['name', 'price', 'created_at', 'updated_at'];
      const allowedSortOrders = ['ASC', 'DESC'];
      const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const finalSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // 计算分页
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // 查询总数
      const countQuery = `SELECT COUNT(*) as total FROM products WHERE ${whereConditions.join(' AND ')}`;
      const [countResult] = await db.query(countQuery, queryParams);
      const total = countResult[0].total;

      // 查询数据
      const dataQuery = `
        SELECT 
          id, name, price, stock, description, image, category, status, 
          created_at, updated_at
        FROM products 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${finalSortBy} ${finalSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);

      // 返回统一格式
      res.json({
        code: 200,
        msg: '获取商品列表成功',
        data: {
          list: rows,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total,
            totalPages: Math.ceil(total / parseInt(pageSize))
          }
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取商品列表失败',
        error: err.message 
      });
    }
  }

  // 获取单个商品详情
  async getProduct(req, res) {
    try {
      const [rows] = await db.query('SELECT * FROM products WHERE id = ? AND status = "on"', [req.params.id]);
      if (rows.length === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '商品不存在',
          data: null
        });
      }
      res.json({
        code: 200,
        msg: '获取商品详情成功',
        data: rows[0]
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取商品详情失败',
        error: err.message 
      });
    }
  }

  // 创建商品（管理员功能）
  async createProduct(req, res) {
    const { name, price, stock, description, image, category } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ 
        code: 400,
        msg: '商品名称和价格是必需的',
        data: null
      });
    }

    try {
      const [result] = await db.query(
        'INSERT INTO products (name, price, stock, description, image, category) VALUES (?, ?, ?, ?, ?, ?)',
        [name, price, stock || 0, description, image, category]
      );
      
      res.status(201).json({ 
        code: 201,
        msg: '商品创建成功', 
        data: {
          productId: result.insertId,
          name: name
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '创建商品失败',
        error: err.message 
      });
    }
  }

  // 更新商品（管理员功能）
  async updateProduct(req, res) {
    const { name, price, stock, description, image, status, category } = req.body;
    const productId = req.params.id;
    
    try {
      let updateFields = [];
      let updateValues = [];
      
      if (name) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      
      if (price !== undefined) {
        updateFields.push('price = ?');
        updateValues.push(price);
      }
      
      if (stock !== undefined) {
        updateFields.push('stock = ?');
        updateValues.push(stock);
      }
      
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description);
      }
      
      if (image !== undefined) {
        updateFields.push('image = ?');
        updateValues.push(image);
      }
      
      if (category !== undefined) {
        updateFields.push('category = ?');
        updateValues.push(category);
      }
      
      if (status && ['on', 'off'].includes(status)) {
        updateFields.push('status = ?');
        updateValues.push(status);
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ 
          code: 400,
          msg: '没有提供要更新的字段',
          data: null
        });
      }
      
      updateValues.push(productId);
      
      const [result] = await db.query(
        `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '商品不存在',
          data: null
        });
      }
      
      res.json({ 
        code: 200,
        msg: '商品更新成功',
        data: {
          productId: productId
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '更新商品失败',
        error: err.message 
      });
    }
  }

  // 删除商品（管理员功能）
  async deleteProduct(req, res) {
    try {
      const [result] = await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '商品不存在',
          data: null
        });
      }
      
      res.json({ 
        code: 200,
        msg: '商品删除成功',
        data: {
          productId: req.params.id
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '删除商品失败',
        error: err.message 
      });
    }
  }

  // 获取所有商品（包括下架的，管理员功能）
  async getAllProducts(req, res) {
    try {
      const [rows] = await db.query('SELECT * FROM products');
      res.json({
        code: 200,
        msg: '获取所有商品成功',
        data: rows
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取所有商品失败',
        error: err.message 
      });
    }
  }

  // 获取商品分类列表
  async getCategories(req, res) {
    try {
      const [rows] = await db.query('SELECT DISTINCT category FROM products WHERE status = "on" AND category IS NOT NULL AND category != ""');
      const categories = rows.map(row => row.category);
      res.json({
        code: 200,
        msg: '获取分类列表成功',
        data: categories
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取分类列表失败',
        error: err.message 
      });
    }
  }
}

module.exports = new ProductController();
