const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
require('dotenv').config(); 
class UserController {
  // 用户注册（主要用于创建管理员账号）
  async register(req, res) {
    const { username, password, role = 'customer' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        code: 400,
        msg: '用户名和密码是必需的',
        data: null
      });
    }

    // 验证角色
    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).json({ 
        code: 400,
        msg: '无效的角色类型',
        data: null
      });
    }
    
    try {
      // 检查用户名是否已存在
      const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsers.length > 0) {
        return res.status(400).json({ 
          code: 400,
          msg: '用户名已存在',
          data: null
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const [result] = await db.query(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
        [username, hashedPassword, role]
      );
      
      res.status(201).json({ 
        code: 201,
        msg: '注册成功',
        data: { 
          userId: result.insertId,
          username,
          role
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '注册失败',
        error: err.message 
      });
    }
  }

  // 用户登录
  async login(req, res) {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    try {
      const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
      if (users.length === 0) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const user = users[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 生成JWT令牌
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        message: '登录成功',
        token: token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          created_at: user.created_at
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // 微信登录
  async wechatLogin(req, res) {
    const { code, nickname, avatarUrl, gender, country, province, city } = req.body || {};
    
    console.log('[wechatLogin] 收到请求:', { code, nickname, avatarUrl, gender, country, province, city });
    
    if (!code) {
      return res.status(400).json({ error: '缺少微信code' });
    }

    try {
      const useMock = (process.env.WECHAT_MOCK || 'true') === 'true';
      console.log('[wechatLogin] useMock=', useMock, 'APPID=', process.env.WECHAT_APPID);
      
      let openid = null;

      if (useMock) {
        // 开发期：用 code 生成一个稳定的 mock openid
        openid = `mock_${Buffer.from(code).toString('hex').slice(0, 28)}`;
        console.log('[wechatLogin] 使用模拟openid:', openid);
      } else {
        const appid = process.env.WECHAT_APPID;
        const secret = process.env.WECHAT_SECRET;
        if (!appid || !secret) {
          console.log('[wechatLogin] 缺少微信配置:', { appid, secret });
          return res.status(500).json({ error: '后端未配置 WECHAT_APPID/WECHAT_SECRET' });
        }
        
        console.log('[wechatLogin] 调用真实微信API');
        const apiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
        const sessionData = await new Promise((resolve, reject) => {
          https
            .get(apiUrl, (resp) => {
              let data = '';
              resp.on('data', (chunk) => (data += chunk));
              resp.on('end', () => {
                try {
                  const json = JSON.parse(data);
                  resolve(json);
                } catch (e) {
                  reject(e);
                }
              });
            })
            .on('error', reject);
        });

        console.log('[wechatLogin] 微信API响应:', sessionData);

        if (!sessionData || !sessionData.openid) {
          return res.status(401).json({ error: '微信认证失败', detail: sessionData });
        }
        openid = sessionData.openid;
        console.log('[wechatLogin] 获取到真实openid:', openid);
      }

      // 使用 openid 查找或创建用户
      const [usersByOpenid] = await db.query('SELECT * FROM users WHERE wechat_openid = ?', [openid]);
      let user = usersByOpenid[0];

      if (!user) {
        console.log('[wechatLogin] 用户不存在，创建新用户');
        // 如果不存在则创建一个新用户
        const generatedUsername = `wx_${openid.slice(-8)}`;
        const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ?', [generatedUsername]);
        const finalUsername = existingUsers.length > 0 ? `${generatedUsername}_${Date.now().toString().slice(-4)}` : generatedUsername;
        
        // 构建用户信息
        const userData = {
          username: finalUsername,
          password: '',
          role: 'customer',
          wechat_openid: openid,  
          nickname: nickname,    
          avatar_url: avatarUrl,   
          gender: gender,          
          country: country,        
          province: province,      
          city: city             
        };
        
        console.log('[wechatLogin] 创建用户数据:', userData);
        
        const [result] = await db.query(
          'INSERT INTO users (username, password, role, wechat_openid, nickname, avatar_url, gender, country, province, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userData.username, userData.password, userData.role, userData.wechat_openid, userData.nickname, userData.avatar_url, userData.gender, userData.country, userData.province, userData.city]
        );
        const [newUsers] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        user = newUsers[0];
        console.log('[wechatLogin] 新用户创建成功:', user);
      } else {
        console.log('[wechatLogin] 用户已存在:', user);
        // 如果用户已存在，更新用户信息（昵称、头像等）
        if (nickname || avatarUrl || gender || country || province || city) {
          console.log('[wechatLogin] 更新用户信息:', { nickname, avatarUrl, gender, country, province, city });
          const updateFields = [];
          const updateValues = [];
          
          if (nickname) {
            updateFields.push('nickname = ?');
            updateValues.push(nickname);
          }
          if (avatarUrl) {
            updateFields.push('avatar_url = ?');
            updateValues.push(avatarUrl);
          }
          if (gender) {
            updateFields.push('gender = ?');
            updateValues.push(gender);
          }
          if (country) {
            updateFields.push('country = ?');
            updateValues.push(country);
          }
          if (province) {
            updateFields.push('province = ?');
            updateValues.push(province);
          }
          if (city) {
            updateFields.push('city = ?');
            updateValues.push(city);
          }
          if (updateFields.length > 0) {
            updateValues.push(user.id);
            await db.query(
              `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
              updateValues
            );
            console.log('[wechatLogin] 用户信息更新成功');
          }
        }
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      const responseUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        gender: user.gender,
        country: user.country,
        province: user.province,
        city: user.city,
        created_at: user.created_at,
      };

      console.log('[wechatLogin] 返回用户信息:', responseUser);

      return res.json({
        message: '登录成功',
        token,
        user: responseUser,
      });
    } catch (err) {
      console.error('微信登录失败:', err);
      return res.status(500).json({ error: '服务器错误' });
    }
  }

  // 获取用户信息
  async getProfile(req, res) {
    try {
      const [users] = await db.query(
        'SELECT id, username, role, nickname, avatar_url, gender, country, province, city, created_at FROM users WHERE id = ?', 
        [req.user.id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '用户不存在',
          data: null
        });
      }

      res.json({
        code: 200,
        msg: '获取用户信息成功',
        data: users[0]
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取用户信息失败',
        error: err.message 
      });
    }
  }

  // 获取所有用户（管理员功能）
  async getAllUsers(req, res) {
    try {
      const { page = 1, pageSize = 10, role = '', search = '' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // 构建查询条件
      let whereConditions = ['1=1'];
      let queryParams = [];

      if (role) {
        whereConditions.push('role = ?');
        queryParams.push(role);
      }

      if (search) {
        whereConditions.push('(username LIKE ? OR nickname LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // 查询总数
      const countQuery = `SELECT COUNT(*) as total FROM users WHERE ${whereConditions.join(' AND ')}`;
      const [countResult] = await db.query(countQuery, queryParams);
      const total = countResult[0].total;

      // 查询用户列表
      const dataQuery = `
        SELECT id, username, role, nickname, avatar_url, created_at
        FROM users 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);

      res.json({
        code: 200,
        msg: '获取用户列表成功',
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
        msg: '获取用户列表失败',
        error: err.message 
      });
    }
  }

  // 管理员创建用户
  async createUserByAdmin(req, res) {
    const { username, password, role = 'customer', nickname, avatar_url, gender, country, province, city } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        code: 400,
        msg: '用户名和密码是必需的' 
      });
    }

    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).json({ 
        code: 400,
        msg: '无效的用户角色' 
      });
    }

    try {
      // 检查用户名是否已存在
      const [existingUser] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUser.length > 0) {
        return res.status(400).json({ 
          code: 400,
          msg: '用户名已存在' 
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const [result] = await db.query(
        'INSERT INTO users (username, password, role, nickname, avatar_url, gender, country, province, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, role, nickname || null, avatar_url || null, gender || null, country || null, province || null, city || null]
      );

      // 获取新创建的用户信息
      const [newUser] = await db.query(
        'SELECT id, username, role, nickname, avatar_url, gender, country, province, city, created_at FROM users WHERE id = ?',
        [result.insertId]
      );

      res.status(201).json({
        code: 201,
        msg: '用户创建成功',
        data: newUser[0]
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '创建用户失败',
        error: err.message 
      });
    }
  }

  // 管理员更新用户信息
  async updateUserByAdmin(req, res) {
    const userId = req.params.id;
    const { username, password, role, nickname, avatar_url } = req.body;

    try {
      // 检查用户是否存在
      const [existingUser] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
      if (existingUser.length === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '用户不存在',
          data: null
        });
      }

      // 构建更新字段
      let updateFields = [];
      let updateValues = [];

      if (username) {
        // 检查新用户名是否已被其他用户使用
        const [duplicateUser] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
        if (duplicateUser.length > 0) {
          return res.status(400).json({ 
            code: 400,
            msg: '用户名已被其他用户使用' 
          });
        }
        updateFields.push('username = ?');
        updateValues.push(username);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        updateValues.push(hashedPassword);
      }

      if (role && ['customer', 'admin'].includes(role)) {
        updateFields.push('role = ?');
        updateValues.push(role);
      }

      if (nickname !== undefined) {
        updateFields.push('nickname = ?');
        updateValues.push(nickname);
      }

      if (avatar_url !== undefined) {
        updateFields.push('avatar_url = ?');
        updateValues.push(avatar_url);
      }

      if (gender !== undefined) {
        updateFields.push('gender = ?');
        updateValues.push(gender);
      }

      if (country !== undefined) {
        updateFields.push('country = ?');
        updateValues.push(country);
      }

      if (province !== undefined) {
        updateFields.push('province = ?');
        updateValues.push(province);
      }

      if (city !== undefined) {
        updateFields.push('city = ?');
        updateValues.push(city);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ 
          code: 400,
          msg: '没有提供要更新的字段' 
        });
      }

      updateValues.push(userId);

      // 执行更新
      await db.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // 获取更新后的用户信息
      const [updatedUser] = await db.query(
        'SELECT id, username, role, nickname, avatar_url, created_at FROM users WHERE id = ?',
        [userId]
      );

      res.json({
        code: 200,
        msg: '用户信息更新成功',
        data: updatedUser[0]
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '更新用户信息失败',
        error: err.message 
      });
    }
  }

  // 管理员删除用户
  async deleteUserByAdmin(req, res) {
    const userId = req.params.id;

    try {
      // 检查用户是否存在
      const [existingUser] = await db.query('SELECT id, username FROM users WHERE id = ?', [userId]);
      if (existingUser.length === 0) {
        return res.status(404).json({ 
          code: 404,
          msg: '用户不存在',
          data: null
        });
      }

      // 检查是否有未完成的订单
      const [pendingOrders] = await db.query(
        'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status IN ("pending", "paid", "shipped")',
        [userId]
      );

      if (pendingOrders[0].count > 0) {
        return res.status(400).json({ 
          code: 400,
          msg: '该用户有未完成的订单，无法删除' 
        });
      }

      // 开始事务
      await db.query('START TRANSACTION');

      try {
        // 删除用户的购物车项
        await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);
        
        // 删除用户的订单项
        await db.query('DELETE oi FROM order_items oi INNER JOIN orders o ON oi.order_id = o.id WHERE o.user_id = ?', [userId]);
        
        // 删除用户的订单
        await db.query('DELETE FROM orders WHERE user_id = ?', [userId]);
        
        // 删除用户
        await db.query('DELETE FROM users WHERE id = ?', [userId]);

        // 提交事务
        await db.query('COMMIT');

        res.json({
          code: 200,
          msg: '用户删除成功',
          data: {
            userId: userId,
            username: existingUser[0].username
          }
        });
      } catch (err) {
        // 回滚事务
        await db.query('ROLLBACK');
        throw err;
      }
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '删除用户失败',
        error: err.message 
      });
    }
  }

  // 获取统计信息（管理员功能）
  async getStats(req, res) {
    try {
      // 用户统计
      const [userStats] = await db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
          COUNT(CASE WHEN role = 'customer' THEN 1 END) as customer_count,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_new_users
        FROM users
      `);

      // 商品统计
      const [productStats] = await db.query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN status = 'on' THEN 1 END) as active_products,
          COUNT(CASE WHEN status = 'off' THEN 1 END) as inactive_products,
          COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock
        FROM products
      `);

      // 订单统计
      const [orderStats] = await db.query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
          COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
          COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_orders,
          SUM(total_price) as total_revenue
        FROM orders
      `);

      // 今日销售额
      const [todayRevenue] = await db.query(`
        SELECT COALESCE(SUM(total_price), 0) as today_revenue
        FROM orders 
        WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'
      `);

      res.json({
        code: 200,
        msg: '获取统计信息成功',
        data: {
          users: userStats[0],
          products: productStats[0],
          orders: {
            ...orderStats[0],
            today_revenue: todayRevenue[0].today_revenue
          }
        }
      });
    } catch (err) {
      res.status(500).json({ 
        code: 500,
        msg: '获取统计信息失败',
        error: err.message 
      });
    }
  }
}

module.exports = new UserController();
